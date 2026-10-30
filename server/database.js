/**
 * SQLite Database Connection & Seeding for Vaayu
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'vaayu.db');
const db = new Database(DB_PATH);

// Enable WAL mode for high performance concurrent reads/writes
db.pragma('journal_mode = WAL');

const INITIAL_NODES = [
  {
    name: 'Secunderabad Station Junction',
    lat: 17.4344,
    lng: 78.5011,
    alert_radius_m: 500,
    route_order: 1,
    officer_name: 'Insp. K. Ramesh',
  },
  {
    name: 'Paradise Circle',
    lat: 17.4428,
    lng: 78.4872,
    alert_radius_m: 500,
    route_order: 2,
    officer_name: 'SI S. Naidu',
  },
  {
    name: 'Begumpet Flyover Junction',
    lat: 17.4442,
    lng: 78.4682,
    alert_radius_m: 600,
    route_order: 3,
    officer_name: 'Insp. M. Varma',
  },
  {
    name: 'Prakash Nagar Metro Junction',
    lat: 17.4418,
    lng: 78.4570,
    alert_radius_m: 450,
    route_order: 4,
    officer_name: 'SI A. Krishna',
  },
  {
    name: 'Ameerpet Cross Roads',
    lat: 17.4375,
    lng: 78.4482,
    alert_radius_m: 550,
    route_order: 5,
    officer_name: 'Insp. G. Reddy',
  },
  {
    name: 'Panjagutta Circle',
    lat: 17.4265,
    lng: 78.4511,
    alert_radius_m: 500,
    route_order: 6,
    officer_name: 'Insp. P. Venkatesh',
  },
  {
    name: 'Banjara Hills Rd No 1 (City Center)',
    lat: 17.4190,
    lng: 78.4485,
    alert_radius_m: 500,
    route_order: 7,
    officer_name: 'SI B. Chandu',
  },
  {
    name: 'Jubilee Hills Checkpost',
    lat: 17.4285,
    lng: 78.4125,
    alert_radius_m: 600,
    route_order: 8,
    officer_name: 'Insp. R. Shiva',
  },
];

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      alert_radius_m INTEGER NOT NULL DEFAULT 500,
      route_order INTEGER NOT NULL,
      officer_name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS trips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      ended_at DATETIME,
      status TEXT NOT NULL DEFAULT 'in_progress'
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trip_id INTEGER NOT NULL,
      node_id INTEGER NOT NULL,
      event_type TEXT NOT NULL, -- 'approaching', 'alert', 'cleared'
      distance_m REAL NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (trip_id) REFERENCES trips (id) ON DELETE CASCADE,
      FOREIGN KEY (node_id) REFERENCES nodes (id) ON DELETE CASCADE
    );
  `);

  const count = db.prepare('SELECT count(*) as count FROM nodes').get().count;
  if (count === 0) {
    seedDemoNodes();
  }
}

function seedDemoNodes() {
  const insert = db.prepare(`
    INSERT INTO nodes (name, lat, lng, alert_radius_m, route_order, officer_name)
    VALUES (@name, @lat, @lng, @alert_radius_m, @route_order, @officer_name)
  `);

  const insertMany = db.transaction((nodes) => {
    for (const node of nodes) {
      insert.run(node);
    }
  });

  insertMany(INITIAL_NODES);
}

function resetDemoData() {
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM events').run();
    db.prepare('DELETE FROM trips').run();
    db.prepare('DELETE FROM nodes').run();
    seedDemoNodes();
  });
  transaction();
}

initDb();

module.exports = {
  db,
  resetDemoData,
  INITIAL_NODES,
};
