import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { NodeItem, NodeLiveState, Telemetry } from '../types';

interface MapProps {
  nodes: NodeItem[];
  nodeStates: Map<number, NodeLiveState>;
  telemetry: Telemetry | null;
  selectedNodeId?: number | null;
  onSelectNode?: (node: NodeItem) => void;
  onMapClick?: (lat: number, lng: number) => void;
  showAllRadii?: boolean;
  followAmbulance?: boolean;
}

// Controller to smoothly pan to selected node or ambulance
function MapController({
  telemetry,
  followAmbulance,
  selectedNode,
}: {
  telemetry: Telemetry | null;
  followAmbulance?: boolean;
  selectedNode?: NodeItem | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedNode) {
      map.setView([selectedNode.lat, selectedNode.lng], 15, { animate: true });
    } else if (followAmbulance && telemetry && telemetry.lat && telemetry.lng) {
      map.panTo([telemetry.lat, telemetry.lng], { animate: true, duration: 0.8 });
    }
  }, [selectedNode, telemetry?.lat, telemetry?.lng, followAmbulance, map]);

  return null;
}

// Map Click Listener for Admin view
function ClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick(Number(e.latlng.lat.toFixed(6)), Number(e.latlng.lng.toFixed(6)));
      }
    },
  });
  return null;
}

export const Map: React.FC<MapProps> = ({
  nodes,
  nodeStates,
  telemetry,
  selectedNodeId,
  onSelectNode,
  onMapClick,
  showAllRadii = true,
  followAmbulance = false,
}) => {
  // Center of Hyderabad demo route (Begumpet / Ameerpet)
  const defaultCenter: [number, number] = [17.436, 78.465];

  // Route Polyline coordinates
  const polylinePositions = useMemo(() => {
    return nodes
      .slice()
      .sort((a, b) => a.route_order - b.route_order)
      .map((node) => [node.lat, node.lng] as [number, number]);
  }, [nodes]);

  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  // Ambulance DivIcon with orientation heading
  const ambulanceIcon = useMemo(() => {
    const heading = telemetry?.heading ?? 0;
    const isAlerting = Array.from(nodeStates.values()).some((s) => s.state === 'alert');

    return L.divIcon({
      className: 'custom-ambulance-marker',
      html: `
        <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
          ${
            isAlerting
              ? '<div style="position: absolute; width: 48px; height: 48px; border-radius: 9999px; background: rgba(239, 68, 68, 0.4); animation: pulse-ring 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>'
              : '<div style="position: absolute; width: 40px; height: 40px; border-radius: 9999px; background: rgba(59, 130, 246, 0.3);"></div>'
          }
          <div style="
            transform: rotate(${heading}deg);
            transition: transform 0.4s ease-out;
            width: 34px;
            height: 34px;
            background: #ffffff;
            border: 2.5px solid ${isAlerting ? '#dc2626' : '#2563eb'};
            border-radius: 9999px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
          ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${isAlerting ? '#dc2626' : '#2563eb'}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1 .4-1 1v9h2"></path>
              <circle cx="7" cy="17" r="2"></circle>
              <path d="M9 17h6"></path>
              <circle cx="17" cy="17" r="2"></circle>
            </svg>
          </div>
          <!-- Orientation heading needle -->
          <div style="
            position: absolute;
            top: -4px;
            transform: rotate(${heading}deg);
            transform-origin: center 26px;
            width: 0;
            height: 0;
            border-left: 5px solid transparent;
            border-right: 5px solid transparent;
            border-bottom: 8px solid ${isAlerting ? '#ef4444' : '#3b82f6'};
          "></div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 22],
    });
  }, [telemetry?.heading, nodeStates]);

  // Helper to create junction icon based on state
  const getJunctionIcon = (node: NodeItem) => {
    const live = nodeStates.get(node.id);
    const state = live?.state || 'idle';

    let bgColor = '#475569'; // idle grey
    let borderColor = '#94a3b8';
    let pulseHtml = '';

    if (state === 'approaching') {
      bgColor = '#d97706'; // amber
      borderColor = '#fbbf24';
      pulseHtml = '<div style="position: absolute; width: 36px; height: 36px; border-radius: 9999px; background: rgba(245, 158, 11, 0.4); animation: pulse-ring 2s infinite;"></div>';
    } else if (state === 'alert') {
      bgColor = '#dc2626'; // crimson red
      borderColor = '#f87171';
      pulseHtml = '<div style="position: absolute; width: 44px; height: 44px; border-radius: 9999px; background: rgba(239, 68, 68, 0.5); animation: pulse-ring 1s infinite;"></div>';
    } else if (state === 'cleared') {
      bgColor = '#059669'; // emerald green
      borderColor = '#34d399';
    }

    return L.divIcon({
      className: 'custom-junction-marker',
      html: `
        <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          ${pulseHtml}
          <div style="
            width: 26px;
            height: 26px;
            border-radius: 9999px;
            background: ${bgColor};
            border: 2px solid ${borderColor};
            color: #ffffff;
            font-size: 11px;
            font-weight: 700;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          ">
            ${node.route_order}
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  };

  return (
    <div className="relative w-full h-full min-h-[420px] rounded-xl overflow-hidden border border-slate-700/60 shadow-xl bg-slate-950">
      <MapContainer
        center={defaultCenter}
        zoom={13}
        scrollWheelZoom={true}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          className="map-tiles"
        />

        <MapController
          telemetry={telemetry}
          followAmbulance={followAmbulance}
          selectedNode={selectedNode}
        />

        <ClickHandler onMapClick={onMapClick} />

        {/* Route Corridor Polyline */}
        {polylinePositions.length >= 2 && (
          <>
            <Polyline
              positions={polylinePositions}
              pathOptions={{
                color: '#38bdf8',
                weight: 5,
                opacity: 0.85,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            {/* Subtle glow layer beneath */}
            <Polyline
              positions={polylinePositions}
              pathOptions={{
                color: '#0284c7',
                weight: 10,
                opacity: 0.25,
              }}
            />
          </>
        )}

        {/* Junction Markers & Alert Radii */}
        {nodes.map((node) => {
          const live = nodeStates.get(node.id);
          const state = live?.state || 'idle';

          let radiusColor = '#64748b'; // grey
          let fillOpacity = 0.12;

          if (state === 'approaching') {
            radiusColor = '#f59e0b'; // amber
            fillOpacity = 0.22;
          } else if (state === 'alert') {
            radiusColor = '#ef4444'; // red
            fillOpacity = 0.35;
          } else if (state === 'cleared') {
            radiusColor = '#10b981'; // green
            fillOpacity = 0.15;
          }

          const isSelected = selectedNodeId === node.id;

          return (
            <React.Fragment key={node.id}>
              {/* Alert Radius Circle */}
              {(showAllRadii || state === 'alert' || state === 'approaching' || isSelected) && (
                <Circle
                  center={[node.lat, node.lng]}
                  radius={node.alert_radius_m || 500}
                  pathOptions={{
                    color: radiusColor,
                    fillColor: radiusColor,
                    fillOpacity,
                    weight: isSelected ? 3 : 1.5,
                    dashArray: state === 'idle' ? '4, 4' : undefined,
                  }}
                />
              )}

              {/* Junction Marker */}
              <Marker
                position={[node.lat, node.lng]}
                icon={getJunctionIcon(node)}
                eventHandlers={{
                  click: () => onSelectNode && onSelectNode(node),
                }}
              >
                <Popup className="vaayu-popup">
                  <div className="p-1 text-slate-900">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-xs flex items-center justify-center font-bold">
                        {node.route_order}
                      </span>
                      <h4 className="font-bold text-sm leading-tight">{node.name}</h4>
                    </div>
                    <p className="text-xs text-slate-600 mb-1">
                      Officer: <span className="font-semibold text-slate-800">{node.officer_name}</span>
                    </p>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200">
                      <span>Status: <strong className="capitalize">{state}</strong></span>
                      <span>Radius: {node.alert_radius_m}m</span>
                    </div>
                    {live?.distance_m != null && (
                      <div className="text-xs text-sky-700 font-medium mt-1">
                        Distance: {live.distance_m}m | ETA: {live.eta_s ?? '--'}s
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}

        {/* Live Ambulance Marker */}
        {telemetry && telemetry.lat && telemetry.lng && (
          <Marker position={[telemetry.lat, telemetry.lng]} icon={ambulanceIcon} zIndexOffset={1000}>
            <Popup>
              <div className="p-1 text-slate-900">
                <div className="flex items-center gap-1.5 mb-1 font-bold text-red-600 text-sm">
                  <span>🚑 Ambulance Unit 108</span>
                </div>
                <div className="text-xs space-y-0.5 text-slate-700">
                  <p>Speed: <strong>{telemetry.speed} km/h</strong></p>
                  <p>Coords: {telemetry.lat.toFixed(4)}, {telemetry.lng.toFixed(4)}</p>
                  <p>Distance: {telemetry.distanceTravelled}m / {telemetry.totalDistance}m</p>
                  {telemetry.nextNode && (
                    <p className="text-sky-700 font-semibold pt-1 border-t border-slate-200">
                      Next: {telemetry.nextNode.name}
                    </p>
                  )}
                </div>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  );
};
