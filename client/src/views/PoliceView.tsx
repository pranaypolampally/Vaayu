import React, { useState, useMemo } from 'react';
import { Shield, AlertTriangle, CheckCircle2, Clock, MapPin, User, Check, Filter, BellRing } from 'lucide-react';
import { Map } from '../components/Map';
import { NodeItem, NodeLiveState, Telemetry, ClearedEvent } from '../types';

interface PoliceViewProps {
  nodes: NodeItem[];
  nodeStates: Map<number, NodeLiveState>;
  telemetry: Telemetry | null;
  clearedHistory: ClearedEvent[];
  onMarkCleared: (nodeId: number) => void;
}

export const PoliceView: React.FC<PoliceViewProps> = ({
  nodes,
  nodeStates,
  telemetry,
  clearedHistory,
  onMarkCleared,
}) => {
  const [selectedJunctionFilter, setSelectedJunctionFilter] = useState<string>('all');
  const [highlightedNodeId, setHighlightedNodeId] = useState<number | null>(null);

  // Filter nodes if officer chose a specific junction
  const filteredNodes = useMemo(() => {
    if (selectedJunctionFilter === 'all') return nodes;
    return nodes.filter((n) => n.id.toString() === selectedJunctionFilter);
  }, [nodes, selectedJunctionFilter]);

  // Active Alert Cards
  const activeAlerts = useMemo(() => {
    const list: NodeLiveState[] = [];
    for (const node of filteredNodes) {
      const state = nodeStates.get(node.id);
      if (state && state.state === 'alert') {
        list.push(state);
      }
    }
    return list;
  }, [filteredNodes, nodeStates]);

  // Approaching Nodes
  const approachingNodes = useMemo(() => {
    const list: NodeLiveState[] = [];
    for (const node of filteredNodes) {
      const state = nodeStates.get(node.id);
      if (state && state.state === 'approaching') {
        list.push(state);
      }
    }
    return list;
  }, [filteredNodes, nodeStates]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-4rem)] p-3 sm:p-5 gap-4 overflow-hidden bg-slate-900">
      {/* Left Column: Alerts Feed & Clearance Table */}
      <div className="w-full lg:w-[420px] flex flex-col gap-3.5 overflow-hidden">
        {/* Top Filter & Status Card */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 shadow-lg shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-blue-400" />
              <h2 className="text-sm font-bold tracking-wide uppercase text-slate-100">
                Traffic Police Clearance Feed
              </h2>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
              <span className="text-xs text-blue-400 font-semibold">Active Dispatch</span>
            </div>
          </div>

          {/* "My Junction" Filter Dropdown */}
          <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <label htmlFor="junction-filter" className="text-xs text-slate-300 font-medium shrink-0">
              My Junction:
            </label>
            <select
              id="junction-filter"
              value={selectedJunctionFilter}
              onChange={(e) => setSelectedJunctionFilter(e.target.value)}
              className="flex-1 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="all">All Corridor Junctions ({nodes.length})</option>
              {nodes.map((node) => (
                <option key={node.id} value={node.id.toString()}>
                  #{node.route_order} - {node.name} ({node.officer_name})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Scrollable Alerts Feed */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {/* Active Alerts Banner */}
          <div>
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider mb-2 text-slate-400">
              <span className="flex items-center gap-1.5 text-red-400">
                <BellRing className="w-3.5 h-3.5 animate-bounce" />
                Active Urgent Alerts ({activeAlerts.length})
              </span>
              <span className="text-[10px] text-slate-500">Requires Signal Preemption</span>
            </div>

            {activeAlerts.length === 0 ? (
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 text-center">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/70 mx-auto mb-1.5" />
                <p className="text-xs font-semibold text-slate-300">No Active Red Alerts</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Signals normal. Alerts trigger within junction radius.
                </p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {activeAlerts.map((alert) => (
                  <div
                    key={alert.nodeId}
                    className="bg-gradient-to-r from-red-950/90 via-slate-950 to-slate-950 border-2 border-red-600 rounded-xl p-3.5 shadow-xl shadow-red-950/50 animate-pulse relative overflow-hidden"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-red-600 text-white tracking-wider">
                          PRIORITY SIGNAL CLEARANCE
                        </span>
                        <h3 className="font-bold text-white text-sm mt-1.5 leading-snug">
                          {alert.nodeName}
                        </h3>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-black text-red-400 font-mono">
                          {alert.eta_s ?? '--'}s
                        </span>
                        <span className="block text-[10px] uppercase font-bold text-slate-400">ETA</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs py-2 my-2 border-y border-red-900/40">
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <MapPin className="w-3.5 h-3.5 text-red-400" />
                        <span>Distance: <strong>{alert.distance_m ?? '--'} m</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <User className="w-3.5 h-3.5 text-blue-400" />
                        <span>Officer: <strong className="text-white">{alert.officerName}</strong></span>
                      </div>
                    </div>

                    <button
                      onClick={() => onMarkCleared(alert.nodeId)}
                      className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-lg shadow-emerald-950/60 transition"
                    >
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Mark Junction Cleared</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Approaching Alerts Section */}
          {approachingNodes.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-2 text-amber-400">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Approaching Advisory ({approachingNodes.length})</span>
              </div>
              <div className="space-y-2">
                {approachingNodes.map((item) => (
                  <div
                    key={item.nodeId}
                    className="bg-slate-950/80 border border-amber-600/60 rounded-xl p-3 text-xs"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-semibold text-slate-100">{item.nodeName}</span>
                      <span className="font-mono font-bold text-amber-400">{item.eta_s ?? '--'}s ETA</span>
                    </div>
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Distance: {item.distance_m}m</span>
                      <span>Officer: {item.officerName}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Clearance Response Log Table */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 shadow-lg">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" />
                Clearance Response Log
              </span>
              <span className="text-[11px] text-slate-500">{clearedHistory.length} cleared</span>
            </div>

            {clearedHistory.length === 0 ? (
              <p className="text-[11px] text-slate-500 py-3 text-center">No clearance events recorded yet.</p>
            ) : (
              <div className="overflow-x-auto max-h-48">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] uppercase text-slate-500 bg-slate-900 sticky top-0">
                    <tr>
                      <th className="py-1 px-2">Junction</th>
                      <th className="py-1 px-2">Officer</th>
                      <th className="py-1 px-2 text-right">Response</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {clearedHistory.slice(0, 10).map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/60 transition">
                        <td className="py-1.5 px-2 font-medium text-white truncate max-w-[130px]" title={item.nodeName}>
                          {item.nodeName}
                        </td>
                        <td className="py-1.5 px-2 text-[11px] text-slate-400 truncate max-w-[100px]">
                          {item.clearedBy}
                        </td>
                        <td className="py-1.5 px-2 text-right font-mono font-semibold text-emerald-400">
                          {item.responseTimeSec != null ? `${item.responseTimeSec}s` : 'Immediate'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Live Map with Junction Color Codes */}
      <div className="flex-1 h-full min-h-[450px] flex flex-col gap-2">
        {/* Color Legend Bar */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span className="font-semibold text-slate-300">Signal States:</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-slate-600 border border-slate-400"></span> Idle
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-amber-500 border border-amber-300"></span> Approaching
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-red-600 border border-red-300"></span> Active Alert
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-emerald-600 border border-emerald-300"></span> Cleared
            </span>
          </div>
        </div>

        <div className="flex-1">
          <Map
            nodes={filteredNodes}
            nodeStates={nodeStates}
            telemetry={telemetry}
            selectedNodeId={highlightedNodeId}
            onSelectNode={(n) => setHighlightedNodeId(n.id)}
            showAllRadii={true}
          />
        </div>
      </div>
    </div>
  );
};
