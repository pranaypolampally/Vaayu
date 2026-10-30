import React, { useState, useEffect, useCallback } from 'react';
import { Header, RoleTab } from './components/Header';
import { AmbulanceView } from './views/AmbulanceView';
import { PoliceView } from './views/PoliceView';
import { AdminView } from './views/AdminView';
import { LogsView } from './views/LogsView';
import { socket } from './services/socket';
import { soundManager } from './utils/sound';
import { NodeItem, NodeLiveState, Telemetry, AlertNotification, ClearedEvent, StatsData } from './types';
import { Bell, CheckCircle, X } from 'lucide-react';

export function App() {
  // Navigation state (sync with URL hash / path)
  const getInitialTab = (): RoleTab => {
    const hash = window.location.hash.replace('#/', '').replace('#', '');
    const pathname = window.location.pathname.replace('/', '');
    const candidate = hash || pathname;
    if (['ambulance', 'police', 'admin', 'logs'].includes(candidate)) {
      return candidate as RoleTab;
    }
    return 'ambulance';
  };

  const [currentTab, setCurrentTab] = useState<RoleTab>(getInitialTab);
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [nodeStates, setNodeStates] = useState<Map<number, NodeLiveState>>(new Map());
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const [clearedHistory, setClearedHistory] = useState<ClearedEvent[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(socket.connected);
  const [isMuted, setIsMuted] = useState<boolean>(soundManager.getMuted());

  // Toast Notification state
  const [activeToast, setActiveToast] = useState<{
    id: number;
    type: 'alert' | 'cleared';
    title: string;
    message: string;
  } | null>(null);

  // Sync tab with URL hash
  const handleTabChange = (tab: RoleTab) => {
    setCurrentTab(tab);
    window.location.hash = `/${tab}`;
  };

  // Fetch all nodes
  const fetchNodes = useCallback(async () => {
    try {
      const res = await fetch('/api/nodes');
      if (res.ok) {
        const data = await res.json();
        setNodes(data);
      }
    } catch (err) {
      console.error('Error fetching nodes:', err);
    }
  }, []);

  // Fetch stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  }, []);

  // Socket.IO event listeners
  useEffect(() => {
    fetchNodes();
    fetchStats();

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    const onGpsUpdate = (data: Telemetry) => {
      setTelemetry(data);
    };

    const onNodeState = (data: NodeLiveState) => {
      setNodeStates((prev) => {
        const updated = new Map(prev);
        updated.set(data.nodeId, data);
        return updated;
      });
    };

    const onNewAlert = (data: AlertNotification) => {
      soundManager.playAlertChime();
      setActiveToast({
        id: Date.now(),
        type: 'alert',
        title: `🚨 EMERGENCY PRIORITY ALERT`,
        message: `${data.nodeName} (${data.distance_m}m away, ETA: ${data.eta_s}s). Officer: ${data.officerName}`,
      });
      setTimeout(() => setActiveToast(null), 7000);
      fetchStats();
    };

    const onAlertCleared = (data: ClearedEvent) => {
      soundManager.playClearedChime();
      setClearedHistory((prev) => [data, ...prev.slice(0, 49)]);
      setActiveToast({
        id: Date.now(),
        type: 'cleared',
        title: `✅ JUNCTION CLEARED`,
        message: `${data.nodeName} marked cleared by ${data.clearedBy} (Response: ${data.responseTimeSec}s)`,
      });
      setTimeout(() => setActiveToast(null), 5000);
      fetchStats();
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('gps:update', onGpsUpdate);
    socket.on('node:state', onNodeState);
    socket.on('alert:new', onNewAlert);
    socket.on('alert:cleared', onAlertCleared);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('gps:update', onGpsUpdate);
      socket.off('node:state', onNodeState);
      socket.off('alert:new', onNewAlert);
      socket.off('alert:cleared', onAlertCleared);
    };
  }, [fetchNodes, fetchStats]);

  // Trip Control Handlers
  const handleStartTrip = async () => {
    try {
      await fetch('/api/trip/start', { method: 'POST' });
    } catch (err) {
      console.error(err);
    }
  };

  const handlePauseTrip = async () => {
    try {
      await fetch('/api/trip/pause', { method: 'POST' });
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetTrip = async () => {
    try {
      await fetch('/api/trip/reset', { method: 'POST' });
      fetchStats();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSetSpeed = async (speedKmh: number) => {
    try {
      await fetch('/api/trip/speed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ speedKmh }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleSetMultiplier = async (multiplier: number) => {
    try {
      await fetch('/api/trip/speed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ multiplier }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkCleared = async (nodeId: number) => {
    try {
      await fetch(`/api/alerts/${nodeId}/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ officerName: 'Traffic Duty Officer' }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  // Admin Node Handlers
  const handleAddNode = async (nodeData: Partial<NodeItem>) => {
    const res = await fetch('/api/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nodeData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add node');
    }
    await fetchNodes();
  };

  const handleUpdateNode = async (id: number, nodeData: Partial<NodeItem>) => {
    const res = await fetch(`/api/nodes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nodeData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update node');
    }
    await fetchNodes();
  };

  const handleDeleteNode = async (id: number) => {
    const res = await fetch(`/api/nodes/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      throw new Error('Failed to delete node');
    }
    await fetchNodes();
  };

  const handleReorderNodes = async (orderList: { id: number; route_order: number }[]) => {
    const res = await fetch('/api/nodes/reorder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderList }),
    });
    if (res.ok) {
      const updated = await res.json();
      setNodes(updated);
    }
  };

  const handleResetDemoData = async () => {
    const res = await fetch('/api/nodes/reset-demo', { method: 'POST' });
    if (res.ok) {
      await fetchNodes();
      await fetchStats();
      setClearedHistory([]);
    }
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    soundManager.setMuted(next);
    setIsMuted(next);
  };

  // Count active alerts
  const activeAlertsCount = Array.from(nodeStates.values()).filter((s) => s.state === 'alert').length;

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans">
      {/* Top Header */}
      <Header
        currentTab={currentTab}
        onTabChange={handleTabChange}
        activeAlertsCount={activeAlertsCount}
        isConnected={isConnected}
        isMuted={isMuted}
        onToggleMute={handleToggleMute}
      />

      {/* Floating High-Priority Toast Notification */}
      {activeToast && (
        <div className="fixed top-20 right-4 z-50 max-w-md w-full animate-bounceIn">
          <div
            className={`p-4 rounded-xl shadow-2xl border flex items-start gap-3 backdrop-blur-md ${
              activeToast.type === 'alert'
                ? 'bg-red-950/95 border-red-500 text-white shadow-red-900/40'
                : 'bg-emerald-950/95 border-emerald-500 text-white shadow-emerald-900/40'
            }`}
          >
            {activeToast.type === 'alert' ? (
              <Bell className="w-5 h-5 text-red-400 shrink-0 mt-0.5 animate-pulse" />
            ) : (
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <h4 className="font-extrabold text-xs tracking-wider uppercase">{activeToast.title}</h4>
              <p className="text-xs text-slate-200 mt-0.5 font-medium leading-relaxed">
                {activeToast.message}
              </p>
            </div>
            <button
              onClick={() => setActiveToast(null)}
              className="text-slate-400 hover:text-white p-1 rounded"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main View Router */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {currentTab === 'ambulance' && (
          <AmbulanceView
            nodes={nodes}
            nodeStates={nodeStates}
            telemetry={telemetry}
            onStartTrip={handleStartTrip}
            onPauseTrip={handlePauseTrip}
            onResetTrip={handleResetTrip}
            onSetSpeed={handleSetSpeed}
            onSetMultiplier={handleSetMultiplier}
          />
        )}

        {currentTab === 'police' && (
          <PoliceView
            nodes={nodes}
            nodeStates={nodeStates}
            telemetry={telemetry}
            clearedHistory={clearedHistory}
            onMarkCleared={handleMarkCleared}
          />
        )}

        {currentTab === 'admin' && (
          <AdminView
            nodes={nodes}
            nodeStates={nodeStates}
            telemetry={telemetry}
            onAddNode={handleAddNode}
            onUpdateNode={handleUpdateNode}
            onDeleteNode={handleDeleteNode}
            onReorderNodes={handleReorderNodes}
            onResetDemoData={handleResetDemoData}
          />
        )}

        {currentTab === 'logs' && (
          <LogsView stats={stats} onRefreshStats={fetchStats} />
        )}
      </main>
    </div>
  );
}

export default App;
