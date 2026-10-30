import React, { useState, useEffect, useMemo } from 'react';
import { Download, RefreshCw, FileText, Activity, Clock, ShieldAlert, CheckCircle, Search, BarChart3 } from 'lucide-react';
import { EventLogItem, StatsData } from '../types';

interface LogsViewProps {
  stats: StatsData | null;
  onRefreshStats: () => Promise<void>;
}

export const LogsView: React.FC<LogsViewProps> = ({ stats, onRefreshStats }) => {
  const [events, setEvents] = useState<EventLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/events?limit=250');
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (err) {
      console.error('Failed to fetch events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    onRefreshStats();
  }, []);

  const handleExportCsv = () => {
    window.location.href = '/api/events/export';
  };

  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const matchesType = eventTypeFilter === 'all' || ev.event_type === eventTypeFilter;
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        !term ||
        (ev.node_name && ev.node_name.toLowerCase().includes(term)) ||
        (ev.officer_name && ev.officer_name.toLowerCase().includes(term)) ||
        ev.id.toString().includes(term) ||
        ev.trip_id.toString().includes(term);

      return matchesType && matchesSearch;
    });
  }, [events, eventTypeFilter, searchTerm]);

  // Max value for the Bar chart scale
  const maxBarValue = useMemo(() => {
    if (!stats || !stats.perNodeStats || stats.perNodeStats.length === 0) return 20;
    const max = Math.max(...stats.perNodeStats.map((p) => p.avg_response_sec || 0));
    return Math.max(15, Math.ceil(max * 1.2));
  }, [stats]);

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-900 space-y-6">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2 m-0 tracking-wide">
            <FileText className="w-6 h-6 text-sky-400" />
            Corridor Event Audit & Performance Analytics
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time event logging, clearance response telemetry, and system KPIs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              fetchEvents();
              onRefreshStats();
            }}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-lg shadow-emerald-950/60 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total Trips */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold text-slate-400">Total Trips</span>
            <Activity className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
            {stats?.totalTrips ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Ambulance dispatch runs</p>
        </div>

        {/* Card 2: Avg Clearance Response Time */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold text-slate-400">Avg Clearance Time</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400 font-mono">
            {stats?.avgResponseTimeSec != null ? `${stats.avgResponseTimeSec}s` : '--'}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Police response to alert</p>
        </div>

        {/* Card 3: Alerts per Trip */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold text-slate-400">Alerts Per Trip</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-400 font-mono">
            {stats?.alertsPerTrip ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Total alerts: {stats?.totalAlerts ?? 0}</p>
        </div>

        {/* Card 4: Nodes Cleared Before Arrival */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs uppercase font-bold text-slate-400">Cleared Pre-Arrival</span>
            <CheckCircle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-rose-400 font-mono">
            {stats?.clearedBeforeArrival ?? 0}
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Cleared with &gt; 50m margin</p>
        </div>
      </div>

      {/* Response Time per Node Bar Chart */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-sky-400" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Clearance Response Time per Junction (Seconds)
            </h3>
          </div>
          <span className="text-xs text-slate-400">Target response: &lt; 15 seconds</span>
        </div>

        {stats?.perNodeStats && stats.perNodeStats.length > 0 ? (
          <div className="space-y-3">
            {stats.perNodeStats.map((node) => {
              const val = node.avg_response_sec || 0;
              const pct = Math.min(100, Math.max(4, (val / maxBarValue) * 100));
              const isLong = val > 15;

              return (
                <div key={node.node_id} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300 font-medium truncate max-w-[280px]">
                      {node.node_name}
                    </span>
                    <span className="font-mono font-semibold text-slate-200">
                      {val > 0 ? `${val}s` : 'Instant'}
                      {node.total_cleared > 0 && (
                        <span className="text-slate-500 text-[10px] ml-1">({node.total_cleared}x)</span>
                      )}
                    </span>
                  </div>

                  <div className="w-full bg-slate-900 rounded-full h-3 overflow-hidden border border-slate-800/80">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isLong
                          ? 'bg-gradient-to-r from-amber-500 to-red-500'
                          : 'bg-gradient-to-r from-teal-500 to-emerald-400'
                      }`}
                      style={{ width: `${pct}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-slate-500">
            No junction response data available yet. Start an ambulance run to accumulate telemetry.
          </div>
        )}
      </div>

      {/* Events Log Table */}
      <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 sm:p-5 shadow-lg space-y-4">
        {/* Search & Event Type Filter */}
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search junction, officer, trip..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            {['all', 'alert', 'approaching', 'cleared'].map((type) => (
              <button
                key={type}
                onClick={() => setEventTypeFilter(type)}
                className={`px-3 py-1 rounded-md capitalize font-semibold transition border ${
                  eventTypeFilter === type
                    ? 'bg-slate-800 text-white border-slate-600 shadow'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-lg border border-slate-800">
          <table className="w-full text-left text-xs divide-y divide-slate-800">
            <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-bold tracking-wider">
              <tr>
                <th className="py-2.5 px-3">ID</th>
                <th className="py-2.5 px-3">Trip</th>
                <th className="py-2.5 px-3">Junction</th>
                <th className="py-2.5 px-3">Officer</th>
                <th className="py-2.5 px-3">Event Type</th>
                <th className="py-2.5 px-3 text-right">Distance (m)</th>
                <th className="py-2.5 px-3 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-950/40 text-slate-300">
              {filteredEvents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-slate-500">
                    No matching event rows found.
                  </td>
                </tr>
              ) : (
                filteredEvents.map((ev) => {
                  let badge = 'bg-slate-800 text-slate-300 border-slate-700';
                  if (ev.event_type === 'alert') {
                    badge = 'bg-red-950 text-red-300 border-red-700/80 font-bold';
                  } else if (ev.event_type === 'approaching') {
                    badge = 'bg-amber-950 text-amber-300 border-amber-700/80 font-semibold';
                  } else if (ev.event_type === 'cleared') {
                    badge = 'bg-emerald-950 text-emerald-300 border-emerald-700/80 font-semibold';
                  }

                  return (
                    <tr key={ev.id} className="hover:bg-slate-900/40 transition">
                      <td className="py-2 px-3 font-mono text-slate-400">#{ev.id}</td>
                      <td className="py-2 px-3 font-mono text-sky-400">Trip {ev.trip_id}</td>
                      <td className="py-2 px-3 font-semibold text-white">{ev.node_name || `Node ${ev.node_id}`}</td>
                      <td className="py-2 px-3 text-slate-400">{ev.officer_name || '--'}</td>
                      <td className="py-2 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] uppercase border ${badge}`}>
                          {ev.event_type}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-300">{ev.distance_m}m</td>
                      <td className="py-2 px-3 text-right font-mono text-[11px] text-slate-400">{ev.timestamp}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
