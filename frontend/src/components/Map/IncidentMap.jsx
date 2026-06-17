import React, { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, Circle, useMap } from 'react-leaflet';
import ECRSBadge from '../shared/ECRSBadge';
import { MapPin, Clock, AlertTriangle } from 'lucide-react';

const BENGALURU_CENTER = [12.97, 77.59];
const DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

function getMarkerColor(priority, ecrs) {
  if (ecrs >= 8) return '#ef4444';
  if (ecrs >= 6) return '#f97316';
  if (ecrs >= 4) return '#eab308';
  if (priority === 'High') return '#f87171';
  return '#fb923c';
}

function getMarkerRadius(ecrs) {
  if (ecrs >= 8) return 8;
  if (ecrs >= 6) return 7;
  if (ecrs >= 4) return 6;
  return 5;
}

function POICircles({ pois }) {
  return (
    <>
      {pois.map((poi, idx) => {
        const color =
          poi.status === 'peak'
            ? '#f97316'
            : poi.status === 'active'
            ? '#38bdf8'
            : '#475569';
        const opacity = poi.status === 'peak' ? 0.2 : poi.status === 'active' ? 0.12 : 0.06;

        return (
          <React.Fragment key={`poi-${idx}`}>
            <Circle
              center={[poi.lat, poi.lng]}
              radius={poi.peak_radius_km * 1000}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: opacity,
                weight: 1,
                opacity: 0.3,
              }}
            />
            <CircleMarker
              center={[poi.lat, poi.lng]}
              radius={4}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.8,
                weight: 2,
              }}
            >
              <Popup>
                <div className="min-w-[180px]">
                  <p className="font-semibold text-sm">{poi.name}</p>
                  <p className="text-xs opacity-70 mt-1 capitalize">{poi.type.replace('_', ' ')}</p>
                  <div className="mt-2 text-xs space-y-1">
                    <p>Status: <span className={`font-medium ${poi.status === 'peak' ? 'text-orange-400' : poi.status === 'active' ? 'text-blue-400' : 'text-gray-400'}`}>{poi.status.toUpperCase()}</span></p>
                    <p>Inflow Peak: {poi.inflow_peak}</p>
                    <p>Outflow Peak: {poi.outflow_peak}</p>
                    <p>Radius: {poi.peak_radius_km} km</p>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          </React.Fragment>
        );
      })}
    </>
  );
}

function CascadeOverlay({ cascadeResult }) {
  if (!cascadeResult || !cascadeResult.cascade_alerts) return null;

  return null; // Cascade is shown in the panel, not on map for MVP
}

export default function IncidentMap({
  incidents = [],
  activeIncidents = [],
  pois = [],
  cascadeResult = null,
  onIncidentClick,
}) {
  // Show active incidents on top, then others
  const displayIncidents = useMemo(() => {
    const activeIds = new Set(activeIncidents.map((i) => i.id));
    const others = incidents.filter((i) => !activeIds.has(i.id)).slice(0, 300);
    return [...others, ...activeIncidents]; // Active on top
  }, [incidents, activeIncidents]);

  return (
    <div className="h-full w-full rounded-xl overflow-hidden border border-glass-border">
      <MapContainer
        center={BENGALURU_CENTER}
        zoom={12}
        className="h-full w-full"
        zoomControl={true}
        attributionControl={true}
      >
        <TileLayer
          url={DARK_TILE_URL}
          attribution='&copy; <a href="https://carto.com">CARTO</a>'
          maxZoom={19}
        />

        {/* POI Aura Circles */}
        <POICircles pois={pois} />

        {/* Incident Markers */}
        {displayIncidents.map((incident, idx) => {
          if (!incident.latitude || !incident.longitude) return null;
          const lat = parseFloat(incident.latitude);
          const lng = parseFloat(incident.longitude);
          if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;

          const isActive = incident.status === 'active';
          const color = getMarkerColor(incident.priority, incident.ecrs_score);
          const radius = getMarkerRadius(incident.ecrs_score);

          return (
            <CircleMarker
              key={`inc-${incident.id || idx}`}
              center={[lat, lng]}
              radius={isActive ? radius + 1 : radius}
              pathOptions={{
                color: isActive ? color : 'transparent',
                fillColor: color,
                fillOpacity: isActive ? 0.9 : 0.5,
                weight: isActive ? 2 : 0,
              }}
              eventHandlers={{
                click: () => onIncidentClick?.(incident),
              }}
            >
              <Popup>
                <div className="min-w-[220px] max-w-[280px]">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-semibold text-sm leading-tight flex-1">
                      {incident.event_cause?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                    <span className={`ecrs-badge text-[10px] px-1.5 py-0.5 ${
                      incident.ecrs_score >= 8 ? 'ecrs-critical' :
                      incident.ecrs_score >= 6 ? 'ecrs-high' :
                      incident.ecrs_score >= 4 ? 'ecrs-moderate' : 'ecrs-low'
                    }`}>
                      {incident.ecrs_score?.toFixed(1)}
                    </span>
                  </div>
                  
                  <p className="text-xs opacity-70 mb-2 line-clamp-2">{incident.address}</p>
                  
                  <div className="text-xs space-y-1 opacity-80">
                    {incident.corridor && incident.corridor !== 'Non-corridor' && (
                      <p className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {incident.corridor}
                      </p>
                    )}
                    {incident.zone && (
                      <p>{incident.zone}</p>
                    )}
                    <p className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {incident.duration_minutes
                        ? `${Math.round(incident.duration_minutes)} min`
                        : incident.status}
                    </p>
                    <p className={`font-medium ${incident.priority === 'High' ? 'text-red-400' : 'text-yellow-400'}`}>
                      Priority: {incident.priority}
                    </p>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        <CascadeOverlay cascadeResult={cascadeResult} />
      </MapContainer>
    </div>
  );
}
