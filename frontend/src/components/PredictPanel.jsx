import React, { useState } from 'react';
import useGridlock from '../hooks/useGridlock';
import LoadingSpinner from './shared/LoadingSpinner';
import ImpactMap from './ImpactMap';
import {
  Brain, Clock, Shield, Users, AlertTriangle, MapPin,
  ChevronRight, Zap, CircleAlert, Construction, TrendingUp, TrendingDown, Minus,
} from 'lucide-react';

const EVENT_CAUSES = [
  { value: 'accident', label: 'Accident' },
  { value: 'vehicle_breakdown', label: 'Vehicle Breakdown' },
  { value: 'congestion', label: 'Congestion' },
  { value: 'construction', label: 'Construction' },
  { value: 'public_event', label: 'Public Event' },
  { value: 'procession', label: 'Procession' },
  { value: 'vip_movement', label: 'VIP Movement' },
  { value: 'protest', label: 'Protest' },
  { value: 'tree_fall', label: 'Tree Fall' },
  { value: 'water_logging', label: 'Water Logging' },
  { value: 'pot_holes', label: 'Pot Holes' },
  { value: 'road_conditions', label: 'Road Conditions' },
  { value: 'debris', label: 'Debris' },
  { value: 'others', label: 'Others' },
];

const CORRIDORS = [
  { value: 'Non-corridor', label: 'Non-corridor' },
  { value: 'Mysore Road', label: 'Mysore Road' },
  { value: 'Bellary Road 1', label: 'Bellary Road 1' },
  { value: 'Bellary Road 2', label: 'Bellary Road 2' },
  { value: 'Tumkur Road', label: 'Tumkur Road' },
  { value: 'Hosur Road', label: 'Hosur Road' },
  { value: 'ORR North 1', label: 'ORR North 1' },
  { value: 'ORR North 2', label: 'ORR North 2' },
  { value: 'ORR East 1', label: 'ORR East 1' },
  { value: 'ORR East 2', label: 'ORR East 2' },
  { value: 'Old Madras Road', label: 'Old Madras Road' },
  { value: 'Magadi Road', label: 'Magadi Road' },
];

const SEVERITY_COLORS = {
  LOW: { bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.3)', text: '#4ade80', glow: 'rgba(34, 197, 94, 0.2)' },
  MODERATE: { bg: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.3)', text: '#facc15', glow: 'rgba(234, 179, 8, 0.2)' },
  HIGH: { bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.3)', text: '#fb923c', glow: 'rgba(249, 115, 22, 0.2)' },
  CRITICAL: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.3)', text: '#f87171', glow: 'rgba(239, 68, 68, 0.3)' },
};

function SeverityGauge({ score, label }) {
  const pct = (score / 10) * 100;
  const colors = SEVERITY_COLORS[label] || SEVERITY_COLORS.MODERATE;
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (pct / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
          <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
          <circle
            cx="60" cy="60" r="54" fill="none"
            stroke={colors.text}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.2s ease-out', filter: `drop-shadow(0 0 6px ${colors.glow})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color: colors.text }}>{score}</span>
          <span className="text-[10px] text-text-muted mt-0.5">/ 10</span>
        </div>
      </div>
      <span
        className="mt-2 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
        style={{ background: colors.bg, color: colors.text, border: `1px solid ${colors.border}` }}
      >
        {label}
      </span>
    </div>
  );
}

const INITIAL_FORM = {
  event_cause: 'accident',
  corridor: 'Non-corridor',
  hour: 9,
  day_of_week: 1,
  month: 6,
  event_type: 'unplanned',
  zone: '',
  police_station: '',
  veh_type: '',
  has_junction: false,
  is_heavy_veh: false,
  description: '',
};

export default function PredictPanel() {
  const [form, setForm] = useState(INITIAL_FORM);
  const { predict, loading, result, error } = useGridlock();

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    predict(form);
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left — Input Form */}
      <div className="w-[420px] border-r border-glass-border overflow-y-auto p-6 pt-6 bg-slate-900/30">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg gradient-accent flex items-center justify-center shrink-0">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-text-primary">CREST</h2>
            <p className="text-[11px] text-text-muted">ML-powered traffic prediction</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5" id="predict-form">
          {/* Event Cause */}
          <div>
            <label className="text-xs text-text-muted block mb-1.5 font-medium">Event Cause</label>
            <select
              id="predict-event-cause"
              className="input-field text-sm"
              value={form.event_cause}
              onChange={e => handleChange('event_cause', e.target.value)}
            >
              {EVENT_CAUSES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Corridor */}
          <div>
            <label className="text-xs text-text-muted block mb-1.5 font-medium">Corridor</label>
            <select
              id="predict-corridor"
              className="input-field text-sm"
              value={form.corridor}
              onChange={e => handleChange('corridor', e.target.value)}
            >
              {CORRIDORS.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Hour / Day / Month */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-text-muted block mb-1.5 font-medium">Hour (0-23)</label>
              <input
                id="predict-hour"
                type="number"
                min={0} max={23}
                className="input-field text-sm"
                value={form.hour}
                onChange={e => handleChange('hour', parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1.5 font-medium">Day (0=Mon)</label>
              <input
                id="predict-day"
                type="number"
                min={0} max={6}
                className="input-field text-sm"
                value={form.day_of_week}
                onChange={e => handleChange('day_of_week', parseInt(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="text-xs text-text-muted block mb-1.5 font-medium">Month</label>
              <input
                id="predict-month"
                type="number"
                min={1} max={12}
                className="input-field text-sm"
                value={form.month}
                onChange={e => handleChange('month', parseInt(e.target.value) || 1)}
              />
            </div>
          </div>

          {/* Event Type */}
          <div>
            <label className="text-xs text-text-muted block mb-1.5 font-medium">Event Type</label>
            <select
              id="predict-event-type"
              className="input-field text-sm"
              value={form.event_type}
              onChange={e => handleChange('event_type', e.target.value)}
            >
              <option value="unplanned">Unplanned</option>
              <option value="planned">Planned</option>
            </select>
          </div>

          {/* Checkboxes */}
          <div className="flex items-center gap-6 py-1">
            <label className="flex items-center gap-2.5 text-sm text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                id="predict-junction"
                checked={form.has_junction}
                onChange={e => handleChange('has_junction', e.target.checked)}
                className="accent-cyan-300 w-4 h-4"
              />
              Junction
            </label>
            <label className="flex items-center gap-2.5 text-sm text-text-secondary cursor-pointer">
              <input
                type="checkbox"
                id="predict-heavy-veh"
                checked={form.is_heavy_veh}
                onChange={e => handleChange('is_heavy_veh', e.target.checked)}
                className="accent-cyan-300 w-4 h-4"
              />
              Heavy Vehicle
            </label>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-text-muted block mb-1.5 font-medium">Description</label>
            <textarea
              id="predict-description"
              className="input-field text-sm"
              placeholder="Describe the incident..."
              value={form.description}
              onChange={e => handleChange('description', e.target.value)}
              rows={3}
              style={{ minHeight: '80px' }}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            id="predict-submit"
            className="btn-primary w-full justify-center py-3"
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Computing...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" />
                Run Prediction
              </>
            )}
          </button>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs animate-slide-in-up">
              <CircleAlert className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </form>
      </div>

      {/* Right — Result Display */}
      <div className="flex-1 overflow-y-auto p-6 pt-6">
        {!result && !loading && (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <Brain className="w-16 h-16 text-slate-700 mb-5" />
            <h3 className="text-lg font-semibold text-text-secondary mb-2">No prediction yet</h3>
            <p className="text-sm text-text-muted max-w-xs leading-relaxed">
              Fill in the incident details and click &quot;Run Prediction&quot; to get ML-powered insights.
            </p>
          </div>
        )}

        {loading && (
          <div className="h-full flex items-center justify-center">
            <LoadingSpinner message="Running ML models..." />
          </div>
        )}

        {result && !loading && (
          <div className="animate-slide-in-up space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3">
              <Brain className="w-6 h-6 text-cyan-300 shrink-0" />
              <h2 className="text-2xl font-bold text-text-primary">Prediction Result</h2>
              <span
                className={`ml-auto px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${
                  result.priority === 'High'
                    ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                    : 'bg-green-500/15 text-green-400 border border-green-500/30'
                }`}
              >
                {result.priority} Priority
              </span>
            </div>

            {/* Top Row — Severity + Key Metrics */}
            <div className="grid grid-cols-[1fr_2fr] gap-4">
              {/* Severity Gauge */}
              <div className="glass-panel flex items-center justify-center py-8">
                <SeverityGauge score={result.severity_score} label={result.severity_label} />
              </div>

              {/* Key Metrics */}
              <div className="grid grid-cols-2 gap-3">
                {/* Resolution */}
                <div className="glass-panel px-4 py-3 hover-lift">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-cyan-300 shrink-0" />
                    <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">Resolution Time</span>
                  </div>
                  <p className="text-2xl font-bold text-text-primary">
                    {result.resolution_minutes} <span className="text-sm font-normal text-text-muted">min</span>
                  </p>
                  <p className="text-[10px] text-text-muted mt-1">
                    {result.resolution_minutes > 60
                      ? `≈ ${(result.resolution_minutes / 60).toFixed(1)} hours`
                      : 'Under 1 hour'}
                  </p>
                </div>

                {/* Closure */}
                <div className="glass-panel px-4 py-3 hover-lift">
                  <div className="flex items-center gap-2 mb-2">
                    <Construction className="w-4 h-4 text-cyan-300 shrink-0" />
                    <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">Road Closure</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-lg text-sm font-bold ${
                        result.closure_predicted
                          ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                          : 'bg-green-500/15 text-green-400 border border-green-500/30'
                      }`}
                    >
                      {result.closure_predicted ? 'LIKELY' : 'UNLIKELY'}
                    </span>
                  </div>
                  <p className="text-[10px] text-text-muted mt-2">
                    Probability: {(result.closure_probability * 100).toFixed(0)}%
                  </p>
                  {/* Mini progress bar */}
                  <div className="w-full h-1.5 bg-slate-800 rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${result.closure_probability * 100}%`,
                        background: result.closure_predicted
                          ? 'linear-gradient(90deg, #f97316, #ef4444)'
                          : 'linear-gradient(90deg, #22c55e, #4ade80)',
                      }}
                    />
                  </div>
                </div>

                {/* Personnel */}
                <div className="glass-panel px-4 py-3 hover-lift">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-4 h-4 text-cyan-300 shrink-0" />
                    <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">Personnel</span>
                  </div>
                  <p className="text-2xl font-bold text-text-primary">
                    {result.personnel} <span className="text-sm font-normal text-text-muted">officers</span>
                  </p>
                </div>

                {/* Barricades */}
                <div className="glass-panel px-4 py-3 hover-lift">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-4 h-4 text-cyan-300 shrink-0" />
                    <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">Barricades</span>
                  </div>
                  <p className="text-2xl font-bold text-text-primary">
                    {result.barricades} <span className="text-sm font-normal text-text-muted">units</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Deployment Notes */}
            <div className="glass-panel px-5 py-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">Deployment Notes</span>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">{result.deployment_notes}</p>
            </div>

            {/* Diversion Routes */}
            {result.diversion_routes?.length > 0 && (
              <div className="glass-panel px-5 py-4">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-cyan-300 shrink-0" />
                  <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">Diversion Routes</span>
                </div>
                <div className="space-y-2">
                  {result.diversion_routes.map((route, idx) => (
                    <div key={idx} className="flex items-center gap-3 glass-panel-sm px-3 py-2">
                      <span className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center text-xs font-bold shrink-0">
                        {idx + 1}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-text-muted shrink-0" />
                      <span className="text-sm text-text-secondary">{route}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Explainability — "Why This Prediction?" */}
            {result.explanation?.length > 0 && (
              <div className="glass-panel px-5 py-4" id="explainability-card">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-purple-400 shrink-0" />
                  <span className="text-xs font-semibold text-text-primary uppercase tracking-wider">Why This Prediction?</span>
                  <span className="ml-auto text-[10px] text-text-muted">{result.explanation.length} factors analyzed</span>
                </div>
                <div className="space-y-2">
                  {result.explanation.map((factor, idx) => (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border transition ${
                        factor.impact === 'high'
                          ? 'bg-red-500/5 border-red-500/15'
                          : factor.impact === 'medium'
                          ? 'bg-amber-500/5 border-amber-500/15'
                          : 'bg-green-500/5 border-green-500/15'
                      }`}
                    >
                      {/* Direction arrow */}
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
                        factor.direction === 'up'
                          ? 'bg-red-500/20 text-red-400'
                          : factor.direction === 'down'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-slate-500/20 text-slate-400'
                      }`}>
                        {factor.direction === 'up' ? <TrendingUp className="w-3 h-3" /> :
                         factor.direction === 'down' ? <TrendingDown className="w-3 h-3" /> :
                         <Minus className="w-3 h-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-text-primary">{factor.factor}</span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider ${
                            factor.impact === 'high'
                              ? 'bg-red-500/15 text-red-400'
                              : factor.impact === 'medium'
                              ? 'bg-amber-500/15 text-amber-400'
                              : 'bg-green-500/15 text-green-400'
                          }`}>{factor.impact}</span>
                          <span className="text-[10px] text-cyan-300 ml-auto font-medium">{factor.value}</span>
                        </div>
                        <p className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{factor.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Impact Radius Map */}
            {result.impact_zone && (
              <ImpactMap
                impactZone={result.impact_zone}
                severity={result.severity_score}
                corridor={result.impact_zone.corridor}
                diversion={result.diversion_routes}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
