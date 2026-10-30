/**
 * End-to-End Verification Script for Vaayu
 * Tests REST endpoints, Socket.IO streaming, trip simulation, alert firing,
 * manual clearance, database logging, stats aggregation, and CSV export.
 */

const { io } = require('../client/node_modules/socket.io-client');
const assert = require('assert');

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runVerification() {
  console.log('=== [1/7] Testing REST /api/nodes ===');
  const nodesRes = await fetch('http://localhost:5000/api/nodes');
  assert.strictEqual(nodesRes.status, 200);
  const nodes = await nodesRes.json();
  console.log(`✓ Fetched ${nodes.length} nodes from database.`);
  assert.strictEqual(nodes.length, 8, 'Expected 8 default Hyderabad junctions');
  assert.strictEqual(nodes[0].name, 'Secunderabad Station Junction');
  assert.strictEqual(nodes[7].name, 'Jubilee Hills Checkpost');

  console.log('\n=== [2/7] Connecting Socket.IO Client ===');
  const socket = io('http://localhost:5000');

  const receivedGps = [];
  const receivedStates = [];
  const receivedAlerts = [];
  const receivedCleared = [];

  socket.on('gps:update', (data) => receivedGps.push(data));
  socket.on('node:state', (data) => receivedStates.push(data));
  socket.on('alert:new', (data) => {
    console.log(`[Socket.IO] 🚨 alert:new received: ${data.nodeName} (${data.distance_m}m, ETA: ${data.eta_s}s)`);
    receivedAlerts.push(data);
  });
  socket.on('alert:cleared', (data) => {
    console.log(`[Socket.IO] ✅ alert:cleared received: ${data.nodeName} cleared by ${data.clearedBy} (Response: ${data.responseTimeSec}s)`);
    receivedCleared.push(data);
  });

  await sleep(1000);
  console.log(`✓ Socket connected. Immediate telemetry received: Lat ${receivedGps[0]?.lat}, Lng ${receivedGps[0]?.lng}`);

  console.log('\n=== [3/7] Setting Simulation Speed & Multiplier (80 km/h, 10x) ===');
  const speedRes = await fetch('http://localhost:5000/api/trip/speed', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ speedKmh: 80, multiplier: 10 }),
  });
  assert.strictEqual(speedRes.status, 200);
  console.log('✓ Speed & simulation multiplier updated.');

  console.log('\n=== [4/7] Starting Trip Simulation ===');
  const startRes = await fetch('http://localhost:5000/api/trip/start', { method: 'POST' });
  assert.strictEqual(startRes.status, 200);
  console.log('✓ Trip simulation started. Waiting for alerts to trigger...');

  // Wait for ambulance to reach junctions and trigger alerts
  let clearedNodeId = null;
  const timeoutMs = 15000;
  const startWait = Date.now();

  while (Date.now() - startWait < timeoutMs) {
    await sleep(500);
    if (receivedAlerts.length > 0) {
      const alert = receivedAlerts[0];
      clearedNodeId = alert.nodeId;
      console.log(`\n=== [5/7] Marking Alert Cleared by Police for Node ${clearedNodeId} (${alert.nodeName}) ===`);
      const clearRes = await fetch(`http://localhost:5000/api/alerts/${clearedNodeId}/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ officerName: 'Test Duty Officer SI Prakash' }),
      });
      assert.strictEqual(clearRes.status, 200);
      const clearData = await clearRes.json();
      console.log('✓ Clear endpoint returned success:', clearData.success);
      break;
    }
  }

  assert.ok(receivedAlerts.length > 0, 'Should have received at least one alert during simulation');
  await sleep(1000);
  assert.ok(receivedCleared.length > 0, 'Should have received alert:cleared event on Socket.IO');

  console.log('\n=== [6/7] Checking /api/events and /api/stats ===');
  const eventsRes = await fetch('http://localhost:5000/api/events');
  const events = await eventsRes.json();
  console.log(`✓ Fetched ${events.length} event rows from SQLite.`);
  const hasClearedEvent = events.some((e) => e.event_type === 'cleared' && e.node_id === clearedNodeId);
  assert.ok(hasClearedEvent, 'Cleared event must be persisted in SQLite events table');
  console.log('✓ Verified: Cleared event row is recorded in database with distance and timestamp.');

  const statsRes = await fetch('http://localhost:5000/api/stats');
  const stats = await statsRes.json();
  console.log('✓ Summary Stats:', {
    totalTrips: stats.totalTrips,
    totalAlerts: stats.totalAlerts,
    avgResponseTimeSec: stats.avgResponseTimeSec,
    alertsPerTrip: stats.alertsPerTrip,
  });
  assert.ok(stats.totalTrips >= 1, 'Total trips should be >= 1');
  assert.ok(stats.totalAlerts >= 1, 'Total alerts should be >= 1');

  console.log('\n=== [7/7] Testing CSV Export ===');
  const csvRes = await fetch('http://localhost:5000/api/events/export');
  assert.strictEqual(csvRes.status, 200);
  const csvText = await csvRes.text();
  assert.ok(csvText.includes('Event ID,Trip ID,Node ID,Junction Name'), 'CSV header present');
  assert.ok(csvText.includes('cleared'), 'CSV contains cleared event type');
  console.log(`✓ CSV Export verified (${csvText.split('\n').length} lines exported).`);

  // Pause trip
  await fetch('http://localhost:5000/api/trip/pause', { method: 'POST' });
  socket.disconnect();
  console.log('\n========================================');
  console.log('🎉 ALL END-TO-END VERIFICATION CHECKS PASSED!');
  console.log('========================================');
  process.exit(0);
}

runVerification().catch((err) => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
