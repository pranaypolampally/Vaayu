/**
 * GPS Provider Interface and Simulated GPS Provider for Vaayu
 *
 * NOTE FOR LIVE HARDWARE INTEGRATION:
 * Swappable interface: To connect live ambulance hardware (e.g., NEO-6M, SIM800L, ESP32 via UART/Cellular MQTT):
 * 1. Create `class HardwareGpsProvider extends GpsProvider`
 * 2. In `start()`, subscribe to serial port (e.g., using `serialport` node module) or MQTT topic
 * 3. Parse standard NMEA $GPRMC sentences: latitude, longitude, speed in knots -> km/h
 * 4. Call `this.emitLocation({ lat, lng, speed, ... })` on each fix
 *
 * NOTE FOR ROAD ROUTING:
 * To use realistic street turn-by-turn geometry rather than straight-line interpolation:
 * Call OSRM (Open Source Routing Machine) or Google Directions API with the junction coordinates
 * and sample points along the returned GeoJSON polyline geometry.
 */

const { haversineDistance, calculateBearing, interpolatePoint } = require('./geoUtils');

/**
 * Base abstract GpsProvider interface
 */
class GpsProvider {
  constructor() {
    this.listeners = [];
  }

  onLocation(callback) {
    this.listeners.push(callback);
  }

  emitLocation(data) {
    for (const cb of this.listeners) {
      cb(data);
    }
  }

  start() {
    throw new Error('start() must be implemented');
  }

  pause() {
    throw new Error('pause() must be implemented');
  }

  reset() {
    throw new Error('reset() must be implemented');
  }

  setSpeed(speedKmh) {
    throw new Error('setSpeed() must be implemented');
  }

  setMultiplier(multiplier) {
    throw new Error('setMultiplier() must be implemented');
  }

  getStatus() {
    throw new Error('getStatus() must be implemented');
  }
}

/**
 * Simulated GPS Provider
 * Simulates an ambulance moving smoothly along the waypoint polyline.
 */
class SimulatedGpsProvider extends GpsProvider {
  constructor(nodes = [], options = {}) {
    super();
    this.speedKmh = Math.max(20, Math.min(80, options.speedKmh || 45)); // 20 to 80 km/h
    this.multiplier = options.multiplier || 1; // 1x, 5x, 10x
    this.intervalId = null;
    this.isRunning = false;
    this.isCompleted = false;

    this.currentDistanceMeters = 0;
    this.totalDistanceMeters = 0;
    this.segments = [];
    this.nodes = [];

    this.setNodes(nodes);
  }

  /**
   * Configure or update route waypoints
   */
  setNodes(nodes) {
    this.nodes = (nodes || []).slice().sort((a, b) => a.route_order - b.route_order);
    this.segments = [];
    this.totalDistanceMeters = 0;

    if (this.nodes.length >= 2) {
      for (let i = 0; i < this.nodes.length - 1; i++) {
        const from = this.nodes[i];
        const to = this.nodes[i + 1];
        const dist = haversineDistance(from.lat, from.lng, to.lat, to.lng);
        const bearing = calculateBearing(from.lat, from.lng, to.lat, to.lng);
        this.segments.push({
          from,
          to,
          startIndex: i,
          targetIndex: i + 1,
          startDist: this.totalDistanceMeters,
          endDist: this.totalDistanceMeters + dist,
          distance: dist,
          bearing,
        });
        this.totalDistanceMeters += dist;
      }
    }
  }

  /**
   * Start or resume simulation
   */
  start() {
    if (this.isRunning) return;
    if (this.isCompleted) {
      this.reset();
    }
    this.isRunning = true;
    this.intervalId = setInterval(() => this.tick(), 1000);
    // Emit immediate status
    this.tick(0);
  }

  /**
   * Pause simulation
   */
  pause() {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Reset simulation to starting junction
   */
  reset() {
    this.pause();
    this.currentDistanceMeters = 0;
    this.isCompleted = false;
    this.tick(0);
  }

  setSpeed(speedKmh) {
    this.speedKmh = Math.max(20, Math.min(80, Number(speedKmh) || 45));
  }

  setMultiplier(multiplier) {
    const val = Number(multiplier);
    if ([1, 2, 5, 10].includes(val)) {
      this.multiplier = val;
    }
  }

  /**
   * 1-second interval execution
   * @param {number} deltaSeconds Default 1
   */
  tick(deltaSeconds = 1) {
    if (this.nodes.length < 2) return;

    if (deltaSeconds > 0 && this.isRunning && !this.isCompleted) {
      // Speed in m/s = (km/h * 1000) / 3600 = km/h / 3.6
      const metersPerSec = (this.speedKmh * 1000) / 3600;
      const stepDistance = metersPerSec * this.multiplier * deltaSeconds;
      this.currentDistanceMeters += stepDistance;

      if (this.currentDistanceMeters >= this.totalDistanceMeters) {
        this.currentDistanceMeters = this.totalDistanceMeters;
        this.isCompleted = true;
        this.pause();
      }
    }

    const telemetry = this.computeCurrentPosition();
    this.emitLocation(telemetry);
  }

  /**
   * Calculate current lat/lng, bearing, next upcoming node from current elapsed distance
   */
  computeCurrentPosition() {
    if (this.nodes.length === 0) {
      return {
        lat: 17.4344,
        lng: 78.5011,
        speed: this.speedKmh,
        multiplier: this.multiplier,
        heading: 0,
        distanceTravelled: 0,
        distanceRemaining: 0,
        totalDistance: 0,
        nextNode: null,
        isRunning: this.isRunning,
        isCompleted: this.isCompleted,
      };
    }

    if (this.segments.length === 0) {
      const single = this.nodes[0];
      return {
        lat: single.lat,
        lng: single.lng,
        speed: this.speedKmh,
        multiplier: this.multiplier,
        heading: 0,
        distanceTravelled: 0,
        distanceRemaining: 0,
        totalDistance: 0,
        nextNode: single,
        isRunning: this.isRunning,
        isCompleted: this.isCompleted,
      };
    }

    // Find which segment ambulance is currently traversing
    let activeSegment = this.segments[this.segments.length - 1];
    for (const seg of this.segments) {
      if (this.currentDistanceMeters <= seg.endDist) {
        activeSegment = seg;
        break;
      }
    }

    const distInSegment = Math.max(0, this.currentDistanceMeters - activeSegment.startDist);
    const fraction = activeSegment.distance > 0 ? Math.min(1, distInSegment / activeSegment.distance) : 0;

    const coords = interpolatePoint(activeSegment.from, activeSegment.to, fraction);

    // Upcoming next node: find the first node whose cumulative distance along route > current distance
    let nextNode = null;
    let accDist = 0;
    for (let i = 0; i < this.nodes.length; i++) {
      if (i > 0) {
        accDist += this.segments[i - 1].distance;
      }
      if (accDist > this.currentDistanceMeters) {
        nextNode = this.nodes[i];
        break;
      }
    }
    if (!nextNode) {
      nextNode = this.nodes[this.nodes.length - 1];
    }

    return {
      lat: Number(coords.lat.toFixed(6)),
      lng: Number(coords.lng.toFixed(6)),
      speed: this.speedKmh,
      multiplier: this.multiplier,
      heading: Math.round(activeSegment.bearing),
      distanceTravelled: Math.round(this.currentDistanceMeters),
      distanceRemaining: Math.round(Math.max(0, this.totalDistanceMeters - this.currentDistanceMeters)),
      totalDistance: Math.round(this.totalDistanceMeters),
      nextNode,
      isRunning: this.isRunning,
      isCompleted: this.isCompleted,
      timestamp: new Date().toISOString(),
    };
  }

  getStatus() {
    return this.computeCurrentPosition();
  }
}

// TODO: Plug hardware GPS parser here (NEO-6M / ESP32 via UART/Serial or MQTT broker)
// class HardwareGpsProvider extends GpsProvider { ... }

// TODO: Connect OSRM or Google Directions API for high-resolution road snapping
// async function fetchRoadPolyline(nodes) { ... }

module.exports = {
  GpsProvider,
  SimulatedGpsProvider,
};
