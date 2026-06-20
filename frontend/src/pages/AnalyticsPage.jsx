import React, { useState, useEffect } from 'react';
import { api } from '../api/client';
import {
  BarChart3, MapPin, Clock, AlertTriangle, TrendingUp, Activity,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area,
} from 'recharts';
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet';
import ECRSBadge from '../components/shared/ECRSBadge';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const DARK_TILE_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

const PIE_COLORS = [
  '#00e5ff', '#f97316', '#22c55e', '#eab308', '#a855f7',
  '#ef4444', '#00e5ff', '#ec4899', '#84cc16', '#f59e0b',
  '#6366f1', '#14b8a6',
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel-sm px-3 py-2 text-sm">
      <p className="text-text-primary font-semibold">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }} className="mt-0.5">
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

export default function AnalyticsPage() {
  const [stats, setStats] = useState(null);
  const [hotspots, setHotspots] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getStats(),
      api.getHotspots(50),
    ]).then(([s, h]) => {
      setStats(s);
      setHotspots(h.hotspots || []);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return <div className="h-full flex items-center justify-center"><LoadingSpinner message="Loading analytics..." /></div>;
  }

  // Prepare data
  const hourlyData = (stats.hourly_distribution || []).map(h => ({
    hour: `${String(h.hour).padStart(2, '0')}:00`,
    incidents: h.count,
  }));

  const causeData = (stats.cause_breakdown || []).slice(0, 10).map(c => ({
    name: c.cause?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
    value: c.count,
  }));

  const corridorData = (stats.corridor_stats || []).slice(0, 12);

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayData = (stats.day_of_week_distribution || []).map(d => ({
    day: dayNames[d.day] || d.day,
    incidents: d.count,
  }));

  return (
    <div className="h-full overflow-y-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <BarChart3 className="w-6 h-6 text-accent-400 flex-shrink-0" />
        <h1 className="text-3xl font-bold text-text-primary">Analytics Dashboard</h1>
        <span className="text-sm text-text-muted ml-auto whitespace-nowrap">
          {stats.total_incidents?.toLocaleString()} incidents
        </span>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Total Incidents', value: stats.total_incidents?.toLocaleString(), icon: Activity, color: 'text-cyan-300' },
          { label: 'Active Now', value: stats.active_incidents, icon: AlertTriangle, color: 'text-risk-critical' },
          { label: 'Highest Risk', value: stats.highest_risk_corridor?.corridor, sub: `${stats.highest_risk_corridor?.count} incidents`, icon: MapPin, color: 'text-risk-high' },
          { label: 'Top Cause', value: stats.most_common_cause?.cause?.replace('_', ' '), sub: `${stats.most_common_cause?.count} (${((stats.most_common_cause?.count / stats.total_incidents) * 100).toFixed(1)}%)`, icon: TrendingUp, color: 'text-risk-moderate' },
          { label: 'Avg ECRS', value: stats.avg_ecrs, icon: Activity, color: 'text-cyan-300' },
        ].map((m, i) => (
          <div key={i} className="glass-panel px-5 py-4 hover-lift animate-slide-in-up" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-center gap-2 mb-2">
              <m.icon className={`w-5 h-5 ${m.color} flex-shrink-0`} />
              <span className="text-xs text-text-muted uppercase tracking-wider font-medium">{m.label}</span>
            </div>
            <p className="text-2xl font-bold text-text-primary capitalize">{m.value}</p>
            {m.sub && <p className="text-xs text-text-muted">{m.sub}</p>}
          </div>
        ))}
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Hourly Distribution */}
        <div className="glass-panel px-6 py-5">
          <h3 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-cyan-300 flex-shrink-0" /> Incidents by Hour
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.1)" />
              <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 12 }} interval={2} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00e5ff" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#0284c7" stopOpacity={0.6} />
                </linearGradient>
              </defs>
              <Bar dataKey="incidents" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cause Breakdown Donut */}
        <div className="glass-panel px-6 py-5">
          <h3 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-cyan-300 flex-shrink-0" /> Cause Breakdown
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={causeData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={2}
                dataKey="value"
              >
                {causeData.map((_, idx) => (
                  <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                iconSize={8}
                iconType="circle"
                formatter={(value) => (
                  <span className="text-[10px] text-text-secondary">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Day of Week */}
        <div className="glass-panel p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-300" /> Incidents by Day of Week
          </h3>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={dayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.1)" />
              <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="incidents" stroke="#a855f7" fill="url(#areaGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Heatmap */}
        <div className="glass-panel p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-cyan-300" /> Incident Hotspot Map
          </h3>
          <div className="h-[240px] rounded-lg overflow-hidden border border-glass-border">
            <MapContainer center={[12.97, 77.59]} zoom={11} className="h-full w-full" zoomControl={false}>
              <TileLayer url={DARK_TILE_URL} attribution='&copy; CARTO' />
              {hotspots.map((hs, idx) => {
                if (!hs.avg_lat || !hs.avg_lng) return null;
                const intensity = Math.min(hs.incident_count / 100, 1);
                const r = Math.max(4, Math.min(hs.incident_count / 10, 20));
                const color = intensity > 0.7 ? '#ef4444' : intensity > 0.4 ? '#f97316' : intensity > 0.2 ? '#eab308' : '#22c55e';
                return (
                  <CircleMarker
                    key={idx}
                    center={[hs.avg_lat, hs.avg_lng]}
                    radius={r}
                    pathOptions={{ color: 'transparent', fillColor: color, fillOpacity: 0.6 }}
                  >
                    <Popup>
                      <div className="min-w-[140px]">
                        <p className="font-semibold text-xs">{hs.location_name}</p>
                        <p className="text-[10px] mt-1">Incidents: {hs.incident_count}</p>
                        <p className="text-[10px]">Avg ECRS: {hs.avg_ecrs}</p>
                        <p className="text-[10px]">Avg Duration: {hs.avg_duration} min</p>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        </div>
      </div>

      {/* Corridor Ranking Table */}
      <div className="glass-panel p-4 mb-4">
        <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-cyan-300" /> Corridor Risk Ranking
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-glass-border text-text-muted text-left">
                <th className="py-2 px-3 font-medium">Rank</th>
                <th className="py-2 px-3 font-medium">Corridor</th>
                <th className="py-2 px-3 font-medium">Incidents</th>
                <th className="py-2 px-3 font-medium">Avg ECRS</th>
                <th className="py-2 px-3 font-medium">Max ECRS</th>
                <th className="py-2 px-3 font-medium">Avg Duration</th>
                <th className="py-2 px-3 font-medium w-[200px]">Volume</th>
              </tr>
            </thead>
            <tbody>
              {corridorData.map((c, idx) => {
                const maxCount = corridorData[0]?.count || 1;
                const pct = (c.count / maxCount * 100).toFixed(0);
                return (
                  <tr key={idx} className="border-b border-glass-border/50 hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 text-text-muted">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-medium text-text-primary">{c.corridor}</td>
                    <td className="py-2.5 px-3 text-text-secondary">{c.count}</td>
                    <td className="py-2.5 px-3"><ECRSBadge score={c.avg_ecrs} showLabel={false} size="sm" /></td>
                    <td className="py-2.5 px-3"><ECRSBadge score={c.max_ecrs} showLabel={false} size="sm" /></td>
                    <td className="py-2.5 px-3 text-text-secondary">{c.avg_duration || 'N/A'} min</td>
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              background: `linear-gradient(90deg, #00e5ff, ${c.avg_ecrs >= 4 ? '#f97316' : '#22c55e'})`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] text-text-muted w-8 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Station & Vehicle breakdowns */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="glass-panel p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Top Police Stations</h3>
          <div className="space-y-2">
            {stats.busiest_stations?.map((s, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="text-[10px] text-text-muted w-4">{idx + 1}</span>
                <span className="text-xs text-text-secondary flex-1">{s.station}</span>
                <span className="text-xs font-semibold text-text-primary">{s.count}</span>
                <div className="w-20 h-1.5 bg-navy-800 rounded-full overflow-hidden">
                  <div className="h-full bg-cyan-300/60 rounded-full" style={{ width: `${(s.count / (stats.busiest_stations[0]?.count || 1)) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-3">Vehicle Type Distribution</h3>
          <div className="space-y-2">
            {stats.vehicle_breakdown?.slice(0, 8).map((v, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="text-[10px] text-text-muted w-4">{idx + 1}</span>
                <span className="text-xs text-text-secondary flex-1 capitalize">{v.type?.replace('_', ' ')}</span>
                <span className="text-xs font-semibold text-text-primary">{v.count}</span>
                <div className="w-20 h-1.5 bg-navy-800 rounded-full overflow-hidden">
                  <div className="h-full bg-purple-400/60 rounded-full" style={{ width: `${(v.count / (stats.vehicle_breakdown[0]?.count || 1)) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
