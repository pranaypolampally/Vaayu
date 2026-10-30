export interface NodeItem {
  id: number;
  name: string;
  lat: number;
  lng: number;
  alert_radius_m: number;
  route_order: number;
  officer_name: string;
  created_at?: string;
}

export type NodeLifecycleState = 'idle' | 'approaching' | 'alert' | 'cleared';

export interface NodeLiveState {
  nodeId: number;
  nodeName: string;
  officerName: string;
  state: NodeLifecycleState;
  distance_m: number | null;
  eta_s: number | null;
  alertRadius: number;
  routeOrder: number;
  hasPassed?: boolean;
  alertTriggered?: boolean;
  clearedBy?: string | null;
}

export interface Telemetry {
  lat: number;
  lng: number;
  speed: number;
  multiplier: number;
  heading: number;
  distanceTravelled: number;
  distanceRemaining: number;
  totalDistance: number;
  nextNode: NodeItem | null;
  isRunning: boolean;
  isCompleted: boolean;
  timestamp: string;
}

export interface AlertNotification {
  eventId?: number;
  tripId?: number;
  nodeId: number;
  nodeName: string;
  officerName: string;
  distance_m: number;
  eta_s: number;
  timestamp: string;
}

export interface ClearedEvent {
  eventId?: number;
  nodeId: number;
  nodeName: string;
  clearedBy: string;
  timestamp: string;
  responseTimeMs: number;
  responseTimeSec: number;
}

export interface EventLogItem {
  id: number;
  trip_id: number;
  node_id: number;
  node_name: string;
  officer_name: string;
  event_type: 'approaching' | 'alert' | 'cleared';
  distance_m: number;
  timestamp: string;
}

export interface StatsData {
  totalTrips: number;
  totalAlerts: number;
  avgResponseTimeSec: number;
  alertsPerTrip: number;
  clearedBeforeArrival: number;
  perNodeStats: {
    node_id: number;
    node_name: string;
    avg_response_sec: number;
    total_cleared: number;
  }[];
}
