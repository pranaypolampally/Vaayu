/**
 * Alert Engine for Vaayu Ambulance Priority System
 *
 * Evaluates ambulance proximity to upcoming traffic junctions on each GPS tick.
 * Manages the node state lifecycle:
 *   [ idle ] -> [ approaching ] (within radius * 1.5)
 *            -> [ alert ]       (within radius)
 *            -> [ cleared ]     (by police action or auto-cleared when ambulance passes)
 *
 * Ensures alerts are fired strictly ONCE per node per trip.
 * Records every state change as an event in SQLite.
 *
 * NOTE ON TRAFFIC SIGNAL INTEGRATION:
 * // TODO: Connect to SCATS / SCOOT / ITMS controller API or relay board (e.g. via NTCIP 1202 / MQTT)
 * // When state enters 'alert', dispatch preemption request:
 * // trafficSignalController.requestGreenWave({ junctionId: node.id, priority: 'EMERGENCY_AMBULANCE', direction: 'EB' });
 *
 * NOTE ON PUSH NOTIFICATIONS:
 * // TODO: Dispatch high-priority push notifications to traffic police devices via FCM / SMS:
 * // pushService.sendToOfficer({ officerId: node.officer_name, title: 'Ambulance Approaching', eta: etaSeconds });
 */

const { haversineDistance } = require('./geoUtils');

class AlertEngine {
  /**
   * @param {import('better-sqlite3').Database} db
   * @param {import('socket.io').Server} io
   */
  constructor(db, io) {
    this.db = db;
    this.io = io;

    this.currentTripId = null;
    this.nodes = [];
    // nodeStates: Map<nodeId, { state, distance_m, eta_s, alertTriggered, alertTimestamp, clearedTimestamp, minDistanceObserved, passed }>
    this.nodeStates = new Map();
  }

  /**
   * Load nodes and initialize or bind to a trip
   */
  init(nodes = [], tripId = null) {
    this.nodes = (nodes || []).slice().sort((a, b) => a.route_order - b.route_order);
    this.currentTripId = tripId;

    this.nodeStates.clear();
    for (const node of this.nodes) {
      this.nodeStates.set(node.id, {
        nodeId: node.id,
        nodeName: node.name,
        officerName: node.officer_name,
        alertRadius: node.alert_radius_m || 500,
        routeOrder: node.route_order,
        lat: node.lat,
        lng: node.lng,
        state: 'idle', // 'idle' | 'approaching' | 'alert' | 'cleared'
        distance_m: null,
        eta_s: null,
        alertTriggered: false,
        alertTimestamp: null,
        clearedTimestamp: null,
        clearedBy: null,
        minDistanceObserved: Infinity,
        hasPassed: false,
      });
    }
  }

  /**
   * Update active nodes (e.g., after admin CRUD)
   */
  updateNodes(nodes) {
    this.nodes = (nodes || []).slice().sort((a, b) => a.route_order - b.route_order);
    const existingMap = new Map(this.nodeStates);
    this.nodeStates.clear();

    for (const node of this.nodes) {
      if (existingMap.has(node.id)) {
        const prev = existingMap.get(node.id);
        this.nodeStates.set(node.id, {
          ...prev,
          nodeName: node.name,
          officerName: node.officer_name,
          alertRadius: node.alert_radius_m,
          routeOrder: node.route_order,
          lat: node.lat,
          lng: node.lng,
        });
      } else {
        this.nodeStates.set(node.id, {
          nodeId: node.id,
          nodeName: node.name,
          officerName: node.officer_name,
          alertRadius: node.alert_radius_m || 500,
          routeOrder: node.route_order,
          lat: node.lat,
          lng: node.lng,
          state: 'idle',
          distance_m: null,
          eta_s: null,
          alertTriggered: false,
          alertTimestamp: null,
          clearedTimestamp: null,
          clearedBy: null,
          minDistanceObserved: Infinity,
          hasPassed: false,
        });
      }
    }
  }

  /**
   * Start a new trip or bind to active trip
   */
  startTrip(tripId) {
    this.currentTripId = tripId;
    for (const [, stateObj] of this.nodeStates) {
      stateObj.state = 'idle';
      stateObj.alertTriggered = false;
      stateObj.alertTimestamp = null;
      stateObj.clearedTimestamp = null;
      stateObj.clearedBy = null;
      stateObj.minDistanceObserved = Infinity;
      stateObj.hasPassed = false;
    }
  }

  /**
   * Record an event in the SQLite database and return the inserted row id
   */
  recordEvent(nodeId, eventType, distanceMeters) {
    if (!this.currentTripId) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO events (trip_id, node_id, event_type, distance_m, timestamp)
        VALUES (?, ?, ?, ?, datetime('now', 'localtime'))
      `);
      const result = stmt.run(this.currentTripId, nodeId, eventType, Math.round(distanceMeters));
      return result.lastInsertRowid;
    } catch (err) {
      console.error('Error recording event in database:', err.message);
      return null;
    }
  }

  /**
   * Tick function called on every GPS update
   * Computes Haversine distance from ambulance to all nodes and manages state transitions
   * @param {{ lat: number, lng: number, speed: number, distanceTravelled: number, nextNode: any }} gpsData
   */
  processGpsTick(gpsData) {
    if (!gpsData || !gpsData.lat || !gpsData.lng) return;

    // Speed in meters/second (speed is in km/h)
    const speedKmh = Math.max(1, gpsData.speed || 40);
    const speedMps = (speedKmh * 1000) / 3600;

    for (const node of this.nodes) {
      const stateObj = this.nodeStates.get(node.id);
      if (!stateObj) continue;

      const distance = haversineDistance(gpsData.lat, gpsData.lng, node.lat, node.lng);
      stateObj.distance_m = Math.round(distance);

      // ETA in seconds = distance (m) / current speed (m/s)
      stateObj.eta_s = Math.max(0, Math.round(distance / speedMps));

      // Track closest approach
      if (distance < stateObj.minDistanceObserved) {
        stateObj.minDistanceObserved = distance;
      }

      // Check if ambulance has passed this node:
      // Condition: ambulance has been inside approaching/alert (minDistance < radius * 1.5)
      // and is now moving away (> minDistance + 80m and distance > radius)
      // OR nextNode route_order is strictly greater than this node's route_order
      const isPastNode =
        (stateObj.minDistanceObserved <= stateObj.alertRadius * 1.5 &&
          distance > stateObj.minDistanceObserved + 100 &&
          distance > stateObj.alertRadius) ||
        (gpsData.nextNode && gpsData.nextNode.route_order > node.route_order);

      if (isPastNode && !stateObj.hasPassed) {
        stateObj.hasPassed = true;
      }

      const approachingThreshold = stateObj.alertRadius * 1.5;
      const alertThreshold = stateObj.alertRadius;

      // STATE MACHINE TRANSITIONS:
      // 1. idle -> approaching
      if (stateObj.state === 'idle') {
        if (distance <= alertThreshold && !stateObj.hasPassed) {
          // Rapid approach straight into alert zone
          this.transitionToAlert(stateObj, distance);
        } else if (distance <= approachingThreshold && !stateObj.hasPassed) {
          this.transitionToApproaching(stateObj, distance);
        }
      }
      // 2. approaching -> alert
      else if (stateObj.state === 'approaching') {
        if (distance <= alertThreshold && !stateObj.hasPassed) {
          this.transitionToAlert(stateObj, distance);
        }
      }
      // 3. alert or approaching -> cleared (auto-cleared after ambulance passes)
      else if (stateObj.state === 'alert' || stateObj.state === 'approaching') {
        if (stateObj.hasPassed) {
          this.autoClearNode(stateObj, distance);
        }
      }

      // Emit continuous node status for HUD / map
      this.io.emit('node:state', {
        nodeId: stateObj.nodeId,
        nodeName: stateObj.nodeName,
        officerName: stateObj.officerName,
        state: stateObj.state,
        distance_m: stateObj.distance_m,
        eta_s: stateObj.eta_s,
        alertRadius: stateObj.alertRadius,
        routeOrder: stateObj.routeOrder,
        hasPassed: stateObj.hasPassed,
        alertTriggered: stateObj.alertTriggered,
      });
    }
  }

  transitionToApproaching(stateObj, distance) {
    stateObj.state = 'approaching';
    this.recordEvent(stateObj.nodeId, 'approaching', distance);
  }

  transitionToAlert(stateObj, distance) {
    stateObj.state = 'alert';
    if (!stateObj.alertTriggered) {
      stateObj.alertTriggered = true;
      stateObj.alertTimestamp = Date.now();

      const eventId = this.recordEvent(stateObj.nodeId, 'alert', distance);

      // Broadcast high-priority alert to police
      this.io.emit('alert:new', {
        eventId,
        tripId: this.currentTripId,
        nodeId: stateObj.nodeId,
        nodeName: stateObj.nodeName,
        officerName: stateObj.officerName,
        distance_m: Math.round(distance),
        eta_s: stateObj.eta_s,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Manual clearance by Police Officer via button
   */
  clearNodeManually(nodeId, officerName = null) {
    const stateObj = this.nodeStates.get(Number(nodeId));
    if (!stateObj) return { success: false, error: 'Node not found' };

    stateObj.state = 'cleared';
    stateObj.clearedTimestamp = Date.now();
    stateObj.clearedBy = officerName || stateObj.officerName;

    const responseTimeMs = stateObj.alertTimestamp ? stateObj.clearedTimestamp - stateObj.alertTimestamp : 0;
    const distance = stateObj.distance_m || 0;

    const eventId = this.recordEvent(stateObj.nodeId, 'cleared', distance);

    const payload = {
      eventId,
      nodeId: stateObj.nodeId,
      nodeName: stateObj.nodeName,
      clearedBy: stateObj.clearedBy,
      timestamp: new Date().toISOString(),
      responseTimeMs,
      responseTimeSec: Math.round(responseTimeMs / 100) / 10,
    };

    this.io.emit('alert:cleared', payload);

    this.io.emit('node:state', {
      nodeId: stateObj.nodeId,
      nodeName: stateObj.nodeName,
      officerName: stateObj.officerName,
      state: stateObj.state,
      distance_m: stateObj.distance_m,
      eta_s: stateObj.eta_s,
      alertRadius: stateObj.alertRadius,
      routeOrder: stateObj.routeOrder,
      hasPassed: stateObj.hasPassed,
      alertTriggered: stateObj.alertTriggered,
      clearedBy: stateObj.clearedBy,
    });

    return { success: true, event: payload };
  }

  /**
   * Auto-clear after ambulance safely passes junction
   */
  autoClearNode(stateObj, distance) {
    if (stateObj.state === 'cleared') return;

    stateObj.state = 'cleared';
    stateObj.clearedTimestamp = Date.now();
    stateObj.clearedBy = 'Auto-cleared (Ambulance Passed)';

    const responseTimeMs = stateObj.alertTimestamp ? stateObj.clearedTimestamp - stateObj.alertTimestamp : 0;
    const eventId = this.recordEvent(stateObj.nodeId, 'cleared', distance);

    const payload = {
      eventId,
      nodeId: stateObj.nodeId,
      nodeName: stateObj.nodeName,
      clearedBy: stateObj.clearedBy,
      timestamp: new Date().toISOString(),
      responseTimeMs,
      responseTimeSec: Math.round(responseTimeMs / 100) / 10,
    };

    this.io.emit('alert:cleared', payload);
  }

  /**
   * Get all active alerts and current states snapshot
   */
  getSnapshot() {
    const states = [];
    const activeAlerts = [];

    for (const [, stateObj] of this.nodeStates) {
      states.push({
        nodeId: stateObj.nodeId,
        nodeName: stateObj.nodeName,
        officerName: stateObj.officerName,
        state: stateObj.state,
        distance_m: stateObj.distance_m,
        eta_s: stateObj.eta_s,
        alertRadius: stateObj.alertRadius,
        routeOrder: stateObj.routeOrder,
        alertTriggered: stateObj.alertTriggered,
        hasPassed: stateObj.hasPassed,
        clearedBy: stateObj.clearedBy,
      });

      if (stateObj.state === 'alert') {
        activeAlerts.push({
          nodeId: stateObj.nodeId,
          nodeName: stateObj.nodeName,
          officerName: stateObj.officerName,
          distance_m: stateObj.distance_m,
          eta_s: stateObj.eta_s,
          timestamp: stateObj.alertTimestamp ? new Date(stateObj.alertTimestamp).toISOString() : new Date().toISOString(),
        });
      }
    }

    return {
      currentTripId: this.currentTripId,
      states,
      activeAlerts,
    };
  }
}

module.exports = AlertEngine;
