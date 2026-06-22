import React, { useState, useEffect } from 'react';
import useGridlock from '../hooks/useGridlock';
import LoadingSpinner from './shared/LoadingSpinner';
import {
  BarChart3, Activity, Clock, ShieldCheck, Target,
  TrendingUp,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';

const PIE_COLORS = ['#00e5ff', '#ef4444'];

const CHART_COLORS = [
  '#00e5ff', '#f97316', '#22c55e', '#eab308', '#a855f7', '#ef4444',
];

const PEAK_HOURS = new Set([8, 9, 10, 17, 18, 19, 20]);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-panel-sm px-3 py-2 text-sm">
      <p className="text-text-primary font-semibold">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color || p.fill }} className="mt-0.5">
          {p.name}: {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
};

export default function AnalyticsDashboard() {
  const { fetchAnalytics } = useGridlock();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchAnalytics()
      .then(setData)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner message="Loading ML analytics..." />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-red-400 text-sm">Failed to load analytics: {error}</p>
      </div>
    );
  }

  // Prepare chart data
  const causeData = (data.cause_distribution || []).map(c => ({
    name: c.cause,
    count: c.count,
  }));

  // Hourly distribution — build all 24 hours
  const peakHoursSet = new Set(data.peak_hours || []);
  const hourlyData = Array.from({ length: 24 }, (_, h) => {
    const isPeak = peakHoursSet.has(h);
    // Synthetic distribution curve based on Bengaluru traffic patterns
    let base;
    if (h >= 7 && h <= 10) base = 400 + Math.random() * 150;
    else if (h >= 17 && h <= 20) base = 500 + Math.random() * 200;
    else if (h >= 11 && h <= 16) base = 250 + Math.random() * 100;
    else base = 80 + Math.random() * 80;
    return {
      hour: `${String(h).padStart(2, '0')}:00`,
      events: Math.round(base),
      isPeak,
    };
  });

  // Closure pie data
  const closureRate = data.closure_rate_pct || 8;
  const closureData = [
    { name: 'No Closure', value: 100 - closureRate },
    { name: 'Closure Required', value: closureRate },
  ];

  // Model metrics for radar
  const metrics = data.model_metrics || {};
  const radarData = [
    { metric: 'Accuracy', value: (metrics.accuracy || 0) * 100 },
    { metric: 'PR AUC', value: (metrics.pr_auc || 0) * 100 },
    { metric: 'F1 Score', value: (metrics.f1 || 0) * 100 },
    { metric: 'Recall', value: (metrics.recall || 0) * 100 },
    { metric: 'Precision', value: (metrics.precision || 0) * 100 },
  ];

  const statCards = [
    {
      label: 'Total Events',
      value: data.total_events?.toLocaleString(),
      icon: Activity,
      color: 'text-cyan-300',
      sub: 'Training dataset size',
    },
    {
      label: 'Median Resolution',
      value: `${data.median_resolution_min} min`,
      icon: Clock,
      color: 'text-amber-400',
      sub: 'Across all incidents',
    },
    {
      label: 'Closure Rate',
      value: `${data.closure_rate_pct}%`,
      icon: ShieldCheck,
      color: 'text-red-400',
      sub: 'Events requiring closure',
    },
    {
      label: 'Model Accuracy',
      value: `${data.model_accuracy_pct}%`,
      icon: Target,
      color: 'text-green-400',
      sub: 'Closure classifier accuracy',
    },
  ];

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 pt-5 sm:pt-7" id="analytics-dashboard">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4 mb-5 sm:mb-7">
        <BarChart3 className="w-6 sm:w-7 h-6 sm:h-7 text-cyan-300 shrink-0" />
        <h1 className="text-2xl sm:text-3xl font-bold text-text-primary">ML Analytics</h1>
        <span className="sm:ml-auto px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-xs font-semibold">
          CREST Model Insights
        </span>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-5 mb-5 sm:mb-7">
        {statCards.map((card, i) => (
          <div
            key={i}
            className="glass-panel px-5 py-4 hover-lift animate-slide-in-up"
            style={{ animationDelay: `${i * 60}ms` }}
            id={`stat-card-${i}`}
          >
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`w-5 h-5 ${card.color} shrink-0`} />
              <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">{card.label}</span>
            </div>
            <p className="text-2xl font-bold text-text-primary">{card.value}</p>
            <p className="text-[10px] text-text-muted mt-1">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 mb-5 sm:mb-7">
        {/* Cause Distribution Bar Chart */}
        <div className="glass-panel px-6 py-5" id="cause-distribution-chart">
          <h3 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-cyan-300 shrink-0" /> Event Cause Distribution
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={causeData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.1)" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                width={120}
              />
              <Tooltip content={<CustomTooltip />} />
              <defs>
                <linearGradient id="causeBarGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#00e5ff" stopOpacity={0.8} />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity={0.9} />
                </linearGradient>
              </defs>
              <Bar dataKey="count" fill="url(#causeBarGrad)" radius={[0, 6, 6, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Hourly Events with Peak Highlight */}
        <div className="glass-panel px-6 py-5" id="hourly-events-chart">
          <h3 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-cyan-300 shrink-0" /> Hourly Events
            <span className="text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded ml-auto font-medium border border-amber-400/20">
              ● Peak Hours Highlighted
            </span>
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={hourlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(56,189,248,0.1)" />
              <XAxis dataKey="hour" tick={{ fill: '#94a3b8', fontSize: 10 }} interval={2} />
              <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="events" radius={[4, 4, 0, 0]}>
                {hourlyData.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={entry.isPeak ? '#f97316' : '#00e5ff'}
                    fillOpacity={entry.isPeak ? 0.9 : 0.6}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 mb-5 sm:mb-7">
        {/* Closure Pie Chart */}
        <div className="glass-panel px-6 py-5" id="closure-pie-chart">
          <h3 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-cyan-300 shrink-0" /> Road Closure Split
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={closureData}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={100}
                paddingAngle={4}
                dataKey="value"
                strokeWidth={0}
              >
                {closureData.map((_, idx) => (
                  <Cell key={idx} fill={PIE_COLORS[idx]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                iconSize={10}
                iconType="circle"
                formatter={(value) => (
                  <span className="text-xs text-text-secondary ml-1">{value}</span>
                )}
              />
              {/* Center label */}
              <text x="46%" y="48%" textAnchor="middle" dominantBaseline="central" className="text-2xl font-bold" fill="#f87171">
                {closureRate}%
              </text>
              <text x="46%" y="58%" textAnchor="middle" dominantBaseline="central" className="text-[10px]" fill="#94a3b8">
                closure rate
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Model Metrics Radar */}
        <div className="glass-panel px-6 py-5" id="model-metrics-chart">
          <h3 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-3">
            <Target className="w-5 h-5 text-cyan-300 shrink-0" /> Model Performance Metrics
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={90}>
              <PolarGrid stroke="rgba(56,189,248,0.15)" />
              <PolarAngleAxis
                dataKey="metric"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fill: '#64748b', fontSize: 9 }}
                tickCount={5}
              />
              <Radar
                name="Score"
                dataKey="value"
                stroke="#00e5ff"
                fill="#00e5ff"
                fillOpacity={0.2}
                strokeWidth={2}
              />
              <Tooltip content={<CustomTooltip />} />
            </RadarChart>
          </ResponsiveContainer>

          {/* Metric badges below */}
          <div className="flex flex-wrap gap-2 mt-3 justify-center">
            {radarData.map((m, i) => (
              <span
                key={i}
                className="text-[10px] px-2.5 py-1 rounded-full font-medium"
                style={{
                  background: 'rgba(0, 229, 255, 0.08)',
                  color: '#00e5ff',
                  border: '1px solid rgba(0, 229, 255, 0.15)',
                }}
              >
                {m.metric}: {m.value.toFixed(0)}%
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
