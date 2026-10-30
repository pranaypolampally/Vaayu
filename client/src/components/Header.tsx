import React from 'react';
import { Ambulance, Shield, Sliders, FileText, Radio, Volume2, VolumeX, Activity } from 'lucide-react';
import { soundManager } from '../utils/sound';

export type RoleTab = 'ambulance' | 'police' | 'admin' | 'logs';

interface HeaderProps {
  currentTab: RoleTab;
  onTabChange: (tab: RoleTab) => void;
  activeAlertsCount: number;
  isConnected: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  onTabChange,
  activeAlertsCount,
  isConnected,
  isMuted,
  onToggleMute,
}) => {
  return (
    <header className="bg-slate-950/95 border-b border-slate-800 text-slate-100 sticky top-0 z-50 backdrop-blur shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & System Badge */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-700 to-rose-500 flex items-center justify-center text-white shadow-lg shadow-red-900/40">
                <Ambulance className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xl font-extrabold tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-red-500 via-rose-300 to-white">
                    VAAYU
                  </span>
                  <span className="text-[10px] font-bold tracking-widest uppercase px-1.5 py-0.5 rounded bg-red-950/80 text-red-400 border border-red-800/60">
                    PRIORITY CORRIDOR
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 hidden sm:block">
                  Ambulance Traffic Clearance System
                </div>
              </div>
            </div>

            {/* System Status Badge */}
            <div className="hidden md:flex items-center gap-2 pl-3 ml-2 border-l border-slate-800 text-xs">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700 text-slate-300 font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                System: <strong className="text-emerald-400 font-semibold">Simulated GPS</strong>
              </span>

              <span
                className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded ${
                  isConnected ? 'text-emerald-400 bg-emerald-950/40' : 'text-amber-400 bg-amber-950/40'
                }`}
                title={isConnected ? 'Socket.IO live' : 'Reconnecting...'}
              >
                <Activity className="w-3 h-3" />
                {isConnected ? 'LIVE' : 'CONNECTING'}
              </span>
            </div>
          </div>

          {/* Role Navigation Switcher */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => onTabChange('ambulance')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                currentTab === 'ambulance'
                  ? 'bg-red-600 text-white shadow-lg shadow-red-900/50'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900/80'
              }`}
            >
              <Ambulance className="w-4 h-4" />
              <span>Ambulance</span>
            </button>

            <button
              onClick={() => onTabChange('police')}
              className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                currentTab === 'police'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900/80'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Traffic Police</span>
              {activeAlertsCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-red-600 text-white text-[11px] font-extrabold rounded-full animate-bounce">
                  {activeAlertsCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onTabChange('admin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                currentTab === 'admin'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-900/50'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900/80'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span className="hidden sm:inline">Admin</span>
              <span className="sm:hidden">Route</span>
            </button>

            <button
              onClick={() => onTabChange('logs')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all ${
                currentTab === 'logs'
                  ? 'bg-slate-700 text-white shadow'
                  : 'text-slate-300 hover:text-white hover:bg-slate-900/80'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Logs</span>
            </button>

            {/* Audio Siren Mute Toggle */}
            <div className="pl-1 sm:pl-2 ml-1 border-l border-slate-800">
              <button
                onClick={onToggleMute}
                className={`p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition ${
                  isMuted ? 'text-slate-500' : 'text-red-400'
                }`}
                title={isMuted ? 'Unmute alert audio siren' : 'Mute alert audio'}
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
};
