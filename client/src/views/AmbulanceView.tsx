import React, { useState } from 'react';
import { Play, Pause, RotateCcw, Gauge, Navigation, Compass, MapPin, Zap, Eye, CheckCircle2 } from 'lucide-react';
import { Map } from '../components/Map';
import { NodeItem, NodeLiveState, Telemetry } from '../types';

interface AmbulanceViewProps {
  nodes: NodeItem[];
  nodeStates: Map<number, NodeLiveState>;
  telemetry: Telemetry | null;
  onStartTrip: () => void;
  onPauseTrip: () => void;
  onResetTrip: () => void;
  onSetSpeed: (speed: number) => void;
  onSetMultiplier: (multiplier: number) => void;
}

export const AmbulanceView: React.FC<AmbulanceViewProps> = ({
  nodes,
  nodeStates,
  telemetry,
  onStartTrip,
  onPauseTrip,
  onResetTrip,
  onSetSpeed,
  onSetMultiplier,
}) => {
  const [followAmbulance, setFollowAmbulance] = useState(true);

  const speed = telemetry?.speed ?? 45;
  const multiplier = telemetry?.multiplier ?? 1;
  const isRunning = telemetry?.isRunning ?? false;
  const isCompleted = telemetry?.isCompleted ?? false;
  const nextNode = telemetry?.nextNode;

  // Find next node live state to get ETA
  const nextNodeState = nextNode ? nodeStates.get(nextNode.id) : null;
  const nextEta = nextNodeState?.eta_s != null ? `${nextNodeState.eta_s}s` : '--';
  const nextDist = nextNodeState?.distance_m != null ? `${nextNodeState.distance_m}m` : '--';

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-4rem)] p-3 sm:p-5 gap-4 overflow-hidden bg-slate-900">
      {/* Left / Control Panel */}
      <div className="w-full lg:w-96 flex flex-col gap-3.5 overflow-y-auto pr-1">
        {/* Main Controls Card */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800/80 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping"></span>
              <h2 className="text-sm font-bold tracking-wide uppercase text-slate-200">
                Ambulance 108 Dispatch
              </h2>
            </div>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                isCompleted
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                  : isRunning
                  ? 'bg-red-950 text-red-400 border border-red-800 animate-pulse'
                  : 'bg-slate-800 text-slate-400 border border-slate-700'
              }`}
            >
              {isCompleted ? 'DESTINATION REACHED' : isRunning ? 'EN ROUTE' : 'STANDBY'}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {!isRunning ? (
              <button
                onClick={onStartTrip}
                className="col-span-2 flex items-center justify-center gap-2 py-2.5 px-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-lg font-bold text-sm shadow-lg shadow-red-900/40 transition"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{isCompleted ? 'Restart Trip' : 'Start Siren'}</span>
              </button>
            ) : (
              <button
                onClick={onPauseTrip}
                className="col-span-2 flex items-center justify-center gap-2 py-2.5 px-3 bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white rounded-lg font-bold text-sm shadow-lg shadow-amber-900/40 transition"
              >
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause</span>
              </button>
            )}

            <button
              onClick={onResetTrip}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-slate-200 rounded-lg font-semibold text-sm border border-slate-700 transition"
              title="Reset to Starting Junction"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>
          </div>

          {/* Speed Slider */}
          <div className="space-y-2 mb-4 pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Gauge className="w-4 h-4 text-sky-400" />
                Ambulance Speed:
              </span>
              <span className="font-mono text-emerald-400 font-bold text-sm bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                {speed} km/h
              </span>
            </div>
            <input
              type="range"
              min="20"
              max="80"
              step="5"
              value={speed}
              onChange={(e) => onSetSpeed(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-red-500"
            />
            <div className="flex justify-between text-[10px] text-slate-500 font-mono">
              <span>20 km/h (Dense)</span>
              <span>50 km/h (Normal)</span>
              <span>80 km/h (Corridor)</span>
            </div>
          </div>

          {/* Simulation Time Multiplier */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs font-semibold mb-2">
              <span className="flex items-center gap-1.5 text-slate-300">
                <Zap className="w-4 h-4 text-amber-400" />
                Simulation Multiplier:
              </span>
              <span className="text-[11px] text-slate-400">Time warp for demo</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[1, 5, 10].map((m) => (
                <button
                  key={m}
                  onClick={() => onSetMultiplier(m)}
                  className={`py-1.5 rounded-md text-xs font-bold transition border ${
                    multiplier === m
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/80 shadow'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {m}x Speed
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Live Telemetry HUD */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5 text-sky-400" />
              Live Telemetry HUD
            </h3>
            <button
              onClick={() => setFollowAmbulance(!followAmbulance)}
              className={`flex items-center gap-1 text-[11px] px-2 py-0.5 rounded transition ${
                followAmbulance ? 'bg-sky-950 text-sky-300 border border-sky-800' : 'bg-slate-800 text-slate-400'
              }`}
            >
              <Eye className="w-3 h-3" />
              {followAmbulance ? 'Auto-pan ON' : 'Auto-pan OFF'}
            </button>
          </div>

          {/* GPS Coordinates & Heading */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] uppercase text-slate-500 font-bold block mb-0.5">Latitude</span>
              <span className="font-mono text-slate-200 font-semibold">{telemetry?.lat.toFixed(6) ?? '--'}</span>
            </div>
            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] uppercase text-slate-500 font-bold block mb-0.5">Longitude</span>
              <span className="font-mono text-slate-200 font-semibold">{telemetry?.lng.toFixed(6) ?? '--'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] uppercase text-slate-500 font-bold block mb-0.5 flex items-center gap-1">
                <Compass className="w-3 h-3 text-sky-400" /> Compass Bearing
              </span>
              <span className="font-mono text-slate-200 font-semibold">{telemetry?.heading ?? 0}°</span>
            </div>
            <div className="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800">
              <span className="text-[10px] uppercase text-slate-500 font-bold block mb-0.5">Velocity</span>
              <span className="font-mono text-emerald-400 font-semibold">{speed} km/h</span>
            </div>
          </div>

          {/* Distance Progression */}
          <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Traveled:</span>
              <span className="font-mono text-slate-200 font-semibold">
                {((telemetry?.distanceTravelled ?? 0) / 1000).toFixed(2)} km
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Remaining:</span>
              <span className="font-mono text-amber-300 font-semibold">
                {((telemetry?.distanceRemaining ?? 0) / 1000).toFixed(2)} km
              </span>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-red-600 to-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{
                  width: `${
                    telemetry && telemetry.totalDistance > 0
                      ? Math.min(100, (telemetry.distanceTravelled / telemetry.totalDistance) * 100)
                      : 0
                  }%`,
                }}
              ></div>
            </div>
          </div>

          {/* Next Node Target */}
          {nextNode && (
            <div className="bg-gradient-to-br from-slate-900 to-sky-950/40 p-3 rounded-lg border border-sky-900/50">
              <div className="flex items-center gap-1.5 text-xs text-sky-400 font-semibold mb-1">
                <MapPin className="w-3.5 h-3.5" />
                <span>Next Approaching Junction:</span>
              </div>
              <h4 className="font-bold text-sm text-white mb-2 leading-tight">{nextNode.name}</h4>
              <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-800">
                <div>
                  <span className="text-[10px] text-slate-400 block">Distance to Node</span>
                  <span className="font-mono text-slate-200 font-bold">{nextDist}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block">Estimated Time (ETA)</span>
                  <span className="font-mono text-amber-300 font-bold">{nextEta}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right / Map Area */}
      <div className="flex-1 h-full min-h-[480px] flex flex-col">
        <Map
          nodes={nodes}
          nodeStates={nodeStates}
          telemetry={telemetry}
          followAmbulance={followAmbulance}
          showAllRadii={true}
        />
      </div>
    </div>
  );
};
