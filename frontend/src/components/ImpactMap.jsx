import React from 'react';
import { MapContainer, TileLayer, Circle, Marker, Popup, Polyline } from 'react-leaflet';
import { MapPin } from 'lucide-react';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon
import L from 'leaflet';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const CORRIDOR_COORDS = {
  "Mysore Road": { lat: 12.9516, lng: 77.5185 },
  "Bellary Road 1": { lat: 13.0067, lng: 77.5761 },
  "Bellary Road 2": { lat: 12.9900, lng: 77.5800 },
  "Tumkur Road": { lat: 13.0200, lng: 77.5100 },
  "Hosur Road": { lat: 12.9000, lng: 77.6300 },
  "ORR North 1": { lat: 13.0300, lng: 77.5500 },
  "ORR North 2": { lat: 13.0350, lng: 77.6000 },
  "ORR East 1": { lat: 12.9600, lng: 77.6900 },
  "ORR East 2": { lat: 12.9200, lng: 77.6700 },
  "Old Madras Road": { lat: 12.9900, lng: 77.6500 },
  "Magadi Road": { lat: 12.9600, lng: 77.5000 },
  "Non-corridor": { lat: 12.9716, lng: 77.5946 },
};

function getSeverityColor(severity) {
  if (severity >= 8) return '#ef4444';
  if (severity >= 6) return '#f97316';
  if (severity >= 4) return '#eab308';
  return '#22c55e';
}

export default function ImpactMap({ impactZone, severity = 5, corridor = 'Non-corridor', diversion = [] }) {
  if (!impactZone) return null;

  const center = [impactZone.center_lat, impactZone.center_lng];
  const radiusM = impactZone.radius_km * 1000;
  const color = getSeverityColor(severity);

  // Create lines from center to affected corridors
  const affectedLines = (impactZone.affected_corridors || []).map(name => {
    const coords = CORRIDOR_COORDS[name];
    if (!coords) return null;
    return {
      name,
      positions: [center, [coords.lat, coords.lng]],
      coords,
    };
  }).filter(Boolean);

  return (
    <div className="glass-panel p-0 overflow-hidden" id="impact-map">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-glass-border">
        <MapPin className="w-4 h-4 text-cyan-300 shrink-0" />
        <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">
          Impact Radius — {impactZone.radius_km} km
        </span>
        {impactZone.affected_corridors?.length > 0 && (
          <span className="ml-auto text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 font-medium">
            {impactZone.affected_corridors.length} corridor{impactZone.affected_corridors.length > 1 ? 's' : ''} affected
          </span>
        )}
      </div>
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '280px', width: '100%' }}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
          attribution=""
        />

        {/* Impact zones — concentric rings */}
        <Circle
          center={center}
          radius={radiusM}
          pathOptions={{
            color: color,
            fillColor: color,
            fillOpacity: 0.08,
            weight: 1,
            dashArray: '6 4',
          }}
        />
        <Circle
          center={center}
          radius={radiusM * 0.6}
          pathOptions={{
            color: color,
            fillColor: color,
            fillOpacity: 0.15,
            weight: 1,
          }}
        />
        <Circle
          center={center}
          radius={radiusM * 0.25}
          pathOptions={{
            color: color,
            fillColor: color,
            fillOpacity: 0.35,
            weight: 2,
          }}
        />

        {/* Center marker */}
        <Marker position={center}>
          <Popup>
            <div style={{ color: '#000', fontWeight: 600 }}>
              {corridor}<br />
              <span style={{ fontWeight: 400, fontSize: '12px' }}>
                Severity: {severity}/10 · Radius: {impactZone.radius_km} km
              </span>
            </div>
          </Popup>
        </Marker>

        {/* Lines to affected corridors */}
        {affectedLines.map((line, i) => (
          <React.Fragment key={i}>
            <Polyline
              positions={line.positions}
              pathOptions={{
                color: '#f97316',
                weight: 2,
                dashArray: '8 6',
                opacity: 0.7,
              }}
            />
            <Circle
              center={[line.coords.lat, line.coords.lng]}
              radius={400}
              pathOptions={{
                color: '#f97316',
                fillColor: '#f97316',
                fillOpacity: 0.3,
                weight: 1,
              }}
            />
          </React.Fragment>
        ))}
      </MapContainer>
    </div>
  );
}
