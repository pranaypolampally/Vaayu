import React, { useState } from 'react';
import { Plus, Trash2, Edit3, ArrowUp, ArrowDown, RotateCcw, MapPin, Check, X, Sliders } from 'lucide-react';
import { Map } from '../components/Map';
import { NodeItem, NodeLiveState, Telemetry } from '../types';

interface AdminViewProps {
  nodes: NodeItem[];
  nodeStates: Map<number, NodeLiveState>;
  telemetry: Telemetry | null;
  onAddNode: (node: Partial<NodeItem>) => Promise<void>;
  onUpdateNode: (id: number, node: Partial<NodeItem>) => Promise<void>;
  onDeleteNode: (id: number) => Promise<void>;
  onReorderNodes: (orderList: { id: number; route_order: number }[]) => Promise<void>;
  onResetDemoData: () => Promise<void>;
}

export const AdminView: React.FC<AdminViewProps> = ({
  nodes,
  nodeStates,
  telemetry,
  onAddNode,
  onUpdateNode,
  onDeleteNode,
  onReorderNodes,
  onResetDemoData,
}) => {
  // Form states
  const [name, setName] = useState('');
  const [lat, setLat] = useState<string>('');
  const [lng, setLng] = useState<string>('');
  const [radius, setRadius] = useState<number>(500);
  const [officer, setOfficer] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Map click handler to prefill coordinates
  const handleMapClick = (clickLat: number, clickLng: number) => {
    setLat(clickLat.toFixed(6));
    setLng(clickLng.toFixed(6));
    setStatusMessage(`Selected coordinates: ${clickLat.toFixed(6)}, ${clickLng.toFixed(6)}`);
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleEditClick = (node: NodeItem) => {
    setEditingId(node.id);
    setName(node.name);
    setLat(node.lat.toString());
    setLng(node.lng.toString());
    setRadius(node.alert_radius_m || 500);
    setOfficer(node.officer_name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setName('');
    setLat('');
    setLng('');
    setRadius(500);
    setOfficer('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !lat || !lng) return;

    setIsSubmitting(true);
    try {
      if (editingId != null) {
        await onUpdateNode(editingId, {
          name,
          lat: Number(lat),
          lng: Number(lng),
          alert_radius_m: radius,
          officer_name: officer || 'Traffic Officer',
        });
        setStatusMessage('Junction updated successfully!');
      } else {
        await onAddNode({
          name,
          lat: Number(lat),
          lng: Number(lng),
          alert_radius_m: radius,
          officer_name: officer || 'Traffic Officer',
        });
        setStatusMessage('New junction registered into route!');
      }
      handleCancelEdit();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error submitting form';
      setStatusMessage(msg);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setStatusMessage(null), 3500);
    }
  };

  // Reorder node up/down
  const moveNode = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= nodes.length) return;

    const list = [...nodes];
    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    const orderPayload = list.map((item, idx) => ({
      id: item.id,
      route_order: idx + 1,
    }));

    await onReorderNodes(orderPayload);
  };

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-[calc(100vh-4rem)] p-3 sm:p-5 gap-4 overflow-hidden bg-slate-900">
      {/* Left Column: Form & Node Management Table */}
      <div className="w-full lg:w-[480px] flex flex-col gap-3.5 overflow-hidden">
        {/* Header & Reset Demo Button */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 shadow-lg shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sliders className="w-5 h-5 text-indigo-400" />
              <h2 className="text-sm font-bold tracking-wide uppercase text-slate-100">
                Corridor Node Administration
              </h2>
            </div>
            <button
              onClick={() => {
                if (window.confirm('Reset all nodes to default 8 Hyderabad junctions and clear past events?')) {
                  onResetDemoData();
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 active:bg-slate-900 text-amber-400 hover:text-amber-300 rounded-md text-xs font-semibold border border-slate-700 transition"
              title="Restore original 8 Hyderabad nodes"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Demo Data</span>
            </button>
          </div>
          <p className="text-xs text-slate-400">
            Configure traffic junctions, alert thresholds, and route progression order. Click anywhere on the map to autofill coordinates.
          </p>

          {statusMessage && (
            <div className="mt-2 p-2 bg-indigo-950/80 border border-indigo-700 text-indigo-300 rounded text-xs flex items-center justify-between animate-fadeIn">
              <span>{statusMessage}</span>
              <button onClick={() => setStatusMessage(null)}>
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Add / Edit Form */}
        <form onSubmit={handleSubmit} className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 shadow-lg shrink-0 space-y-2.5">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
              {editingId ? `Edit Junction #${editingId}` : 'Add New Corridor Junction'}
            </h3>
            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-[11px] text-slate-400 hover:text-white"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="col-span-2">
              <label className="block text-[11px] text-slate-400 mb-0.5">Junction / Landmark Name</label>
              <input
                type="text"
                placeholder="e.g. Ameerpet Cross Roads"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-0.5">Latitude</label>
              <input
                type="number"
                step="0.000001"
                placeholder="17.437500"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-0.5">Longitude</label>
              <input
                type="number"
                step="0.000001"
                placeholder="78.448200"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 font-mono text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-0.5">Alert Radius (meters)</label>
              <input
                type="number"
                min="100"
                max="2000"
                step="50"
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-[11px] text-slate-400 mb-0.5">Officer in Charge</label>
              <input
                type="text"
                placeholder="Insp. Name"
                value={officer}
                onChange={(e) => setOfficer(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs rounded transition shadow"
          >
            {editingId ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{editingId ? 'Save Changes' : 'Register Junction'}</span>
          </button>
        </form>

        {/* Junction Order Table */}
        <div className="flex-1 bg-slate-950/90 border border-slate-800 rounded-xl p-3 shadow-lg flex flex-col overflow-hidden">
          <div className="flex justify-between items-center pb-2 border-b border-slate-800 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Corridor Progression ({nodes.length} Junctions)
            </span>
            <span className="text-[10px] text-slate-500">Use arrows to reorder route</span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
            {nodes.map((node, idx) => (
              <div
                key={node.id}
                className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800 text-xs hover:border-slate-700 transition"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700 flex items-center justify-center font-bold text-[10px] shrink-0">
                    {node.route_order}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-white truncate max-w-[160px]" title={node.name}>
                      {node.name}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {node.officer_name} • {node.alert_radius_m}m radius
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => moveNode(idx, 'up')}
                    disabled={idx === 0}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-300"
                    title="Move earlier in route"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => moveNode(idx, 'down')}
                    disabled={idx === nodes.length - 1}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:hover:bg-slate-800 text-slate-300"
                    title="Move later in route"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => handleEditClick(node)}
                    className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 ml-1"
                    title="Edit junction"
                  >
                    <Edit3 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete ${node.name}?`)) {
                        onDeleteNode(node.id);
                      }
                    }}
                    className="p-1 rounded bg-slate-800 hover:bg-red-950 text-red-400"
                    title="Delete junction"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Column: Interactive Admin Map */}
      <div className="flex-1 h-full min-h-[450px] flex flex-col gap-2">
        <div className="bg-slate-950/80 border border-slate-800 rounded-lg px-3 py-1.5 flex items-center justify-between text-xs text-slate-400 shrink-0">
          <span className="text-slate-300">
            <strong>Interactive Mode:</strong> Click anywhere on the map to set coordinates for the form.
          </span>
          <span className="text-[11px] text-indigo-400 font-medium">Auto-draws route polyline</span>
        </div>

        <div className="flex-1">
          <Map
            nodes={nodes}
            nodeStates={nodeStates}
            telemetry={telemetry}
            onMapClick={handleMapClick}
            showAllRadii={true}
          />
        </div>
      </div>
    </div>
  );
};
