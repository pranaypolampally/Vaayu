/**
 * Unit Tests for Vaayu Geolocation and Alert Engine
 * Run with: npm test (or node tests/alertEngine.test.js)
 */

const assert = require('assert');
const test = require('node:test');
const { haversineDistance, calculateBearing, interpolatePoint } = require('../geoUtils');
const AlertEngine = require('../alertEngine');

test('Haversine Distance Calculations', (t) => {
  // Test 1: Distance between identical points is 0
  const dZero = haversineDistance(17.4344, 78.5011, 17.4344, 78.5011);
  assert.strictEqual(Math.round(dZero), 0, 'Distance between identical points must be 0');

  // Test 2: Distance between Secunderabad Station and Paradise Circle (~1.74 km)
  const dSecToParadise = haversineDistance(17.4344, 78.5011, 17.4428, 78.4872);
  assert.ok(
    dSecToParadise > 1650 && dSecToParadise < 1850,
    `Expected ~1740m, got ${Math.round(dSecToParadise)}m`
  );

  // Test 3: Symmetry property: dist(A, B) === dist(B, A)
  const dRev = haversineDistance(17.4428, 78.4872, 17.4344, 78.5011);
  assert.strictEqual(Math.round(dSecToParadise), Math.round(dRev), 'Haversine distance must be symmetric');

  // Test 4: Interpolate midpoint
  const p1 = { lat: 10, lng: 20 };
  const p2 = { lat: 20, lng: 40 };
  const mid = interpolatePoint(p1, p2, 0.5);
  assert.strictEqual(mid.lat, 15);
  assert.strictEqual(mid.lng, 30);
});

test('Alert Engine State Lifecycle & Transition Rules', (t) => {
  // Mock SQLite DB
  const recordedEvents = [];
  const mockDb = {
    prepare: () => ({
      run: (tripId, nodeId, eventType, distanceMeters) => {
        recordedEvents.push({ tripId, nodeId, eventType, distanceMeters });
        return { lastInsertRowid: recordedEvents.length };
      },
    }),
  };

  // Mock Socket.IO
  const emittedEvents = [];
  const mockIo = {
    emit: (event, payload) => {
      emittedEvents.push({ event, payload });
    },
  };

  const engine = new AlertEngine(mockDb, mockIo);

  const testNodes = [
    {
      id: 101,
      name: 'Test Junction 1',
      lat: 17.4400,
      lng: 78.4800,
      alert_radius_m: 500,
      route_order: 1,
      officer_name: 'Officer A',
    },
    {
      id: 102,
      name: 'Test Junction 2',
      lat: 17.4500,
      lng: 78.4900,
      alert_radius_m: 400,
      route_order: 2,
      officer_name: 'Officer B',
    },
  ];

  engine.init(testNodes, 1);

  // 1. Initial State: node 101 is 'idle'
  let state = engine.nodeStates.get(101);
  assert.strictEqual(state.state, 'idle', 'Initial state must be idle');
  assert.strictEqual(state.alertTriggered, false, 'Alert triggered must start false');

  // 2. Far away: GPS at 17.4000, 78.4000 (> 5km away)
  engine.processGpsTick({ lat: 17.4000, lng: 78.4000, speed: 50, nextNode: testNodes[0] });
  state = engine.nodeStates.get(101);
  assert.strictEqual(state.state, 'idle', 'Should remain idle when far away');

  // 3. Approaching: distance <= 500 * 1.5 = 750m, but > 500m
  // Junction 101 is at (17.4400, 78.4800).
  // A point ~650m away is at approx (17.4445, 78.4835)
  const distApproaching = haversineDistance(17.4445, 78.4835, 17.4400, 78.4800);
  assert.ok(distApproaching <= 750 && distApproaching > 500, `Distance is ${distApproaching}m`);

  engine.processGpsTick({ lat: 17.4445, lng: 78.4835, speed: 50, nextNode: testNodes[0] });
  state = engine.nodeStates.get(101);
  assert.strictEqual(state.state, 'approaching', 'Should transition to approaching');
  assert.ok(
    recordedEvents.some((e) => e.nodeId === 101 && e.eventType === 'approaching'),
    'Approaching event must be recorded in SQLite'
  );

  // 4. Alert: within radius (e.g. ~300m away)
  // Approx (17.4420, 78.4815)
  const distAlert = haversineDistance(17.4420, 78.4815, 17.4400, 78.4800);
  assert.ok(distAlert <= 500, `Alert distance is ${distAlert}m`);

  engine.processGpsTick({ lat: 17.4420, lng: 78.4815, speed: 50, nextNode: testNodes[0] });
  state = engine.nodeStates.get(101);
  assert.strictEqual(state.state, 'alert', 'Should transition to alert');
  assert.strictEqual(state.alertTriggered, true, 'alertTriggered flag must be set');

  const alertEventsCount = recordedEvents.filter((e) => e.nodeId === 101 && e.eventType === 'alert').length;
  assert.strictEqual(alertEventsCount, 1, 'Alert event must be recorded');

  // 5. Test alert firing strictly ONCE per node per trip:
  // Another tick inside alert zone should NOT fire another alert event
  engine.processGpsTick({ lat: 17.4410, lng: 78.4808, speed: 50, nextNode: testNodes[0] });
  const alertEventsCountAfterSecondTick = recordedEvents.filter((e) => e.nodeId === 101 && e.eventType === 'alert').length;
  assert.strictEqual(alertEventsCountAfterSecondTick, 1, 'Alert must not fire multiple times per trip');

  // 6. Manual clearance by Police Officer
  const clearResult = engine.clearNodeManually(101, 'Officer A');
  assert.strictEqual(clearResult.success, true, 'Clear node manually should succeed');
  state = engine.nodeStates.get(101);
  assert.strictEqual(state.state, 'cleared', 'State should be cleared');
  assert.strictEqual(state.clearedBy, 'Officer A', 'clearedBy should be recorded');
  assert.ok(
    recordedEvents.some((e) => e.nodeId === 101 && e.eventType === 'cleared'),
    'Cleared event must be recorded in DB'
  );

  // 7. Auto-clearance on ambulance passing:
  // Move ambulance to Node 102 area (now past Node 101, nextNode is 102 or beyond)
  // Node 102 should be alert or approaching, and any uncleared prior node transitions to auto-cleared
  engine.processGpsTick({ lat: 17.4500, lng: 78.4900, speed: 50, nextNode: testNodes[1] });
  const node102State = engine.nodeStates.get(102);
  assert.strictEqual(node102State.state, 'alert', 'Node 102 should be in alert state when ambulance is on it');
});
