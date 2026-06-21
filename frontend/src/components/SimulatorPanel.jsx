import React, { useState } from 'react';
import {
  FlaskConical, Plus, Trash2, Play, ArrowRightLeft,
  Clock, Shield, Users, AlertTriangle, TrendingDown, TrendingUp, ChevronDown
} from 'lucide-react';
import useGridlock from '../hooks/useGridlock';

const EVENT_CAUSES = [
  { value: 'accident', label: 'Accident' },
  { value: 'vehicle_breakdown', label: 'Vehicle Breakdown' },
  { value: 'construction', label: 'Construction' },
  { value: 'congestion', label: 'Congestion' },
  { value: 'public_event', label: 'Public Event' },
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

const EMPTY_SCENARIO = {
  event_cause: 'accident',
  corridor: 'Non-corridor',
  hour: 9,
  day_of_week: 1,
  month: 6,
  event_type: 'unplanned',
  has_junction: false,
  is_heavy_veh: false,
  description: '',
};

function getSeverityColor(score) {
  if (score >= 8) return 'text-red-400';
  if (score >= 6) return 'text-orange-400';
  if (score >= 4) return 'text-yellow-400';
  return 'text-green-400';
}

function getSeverityBg(score) {
  if (score >= 8) return 'bg-red-500/10 border-red-500/20';
  if (score >= 6) return 'bg-orange-500/10 border-orange-500/20';
  if (score >= 4) return 'bg-yellow-500/10 border-yellow-500/20';
  return 'bg-green-500/10 border-green-500/20';
}

export default function SimulatorPanel() {
  const { simulate, loading } = useGridlock();
  const [scenarios, setScenarios] = useState([
    { ...EMPTY_SCENARIO },
    { ...EMPTY_SCENARIO, hour: 18, corridor: 'Hosur Road' },
  ]);
  const [results, setResults] = useState(null);

  const addScenario = () => {
    if (scenarios.length >= 4) return;
    setScenarios([...scenarios, { ...EMPTY_SCENARIO }]);
  };

  const removeScenario = (idx) => {
    if (scenarios.length <= 2) return;
    setScenarios(scenarios.filter((_, i) => i !== idx));
  };

  const updateScenario = (idx, field, value) => {
    const updated = [...scenarios];
    updated[idx] = { ...updated[idx], [field]: value };
    setScenarios(updated);
  };

  const runSimulation = async () => {
    const data = await simulate(scenarios);
    if (data) setResults(data);
  };

  return (
    <div className="h-full overflow-y-auto p-6 pt-7" id="simulator-panel">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-10 h-10 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0">
          <FlaskConical className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">What-If Simulator</h1>
          <p className="text-xs text-text-muted mt-0.5">Compare scenarios side-by-side to find optimal timing</p>
        </div>
        <button
          onClick={runSimulation}
          disabled={loading || scenarios.length < 2}
          className="ml-auto px-5 py-2.5 gradient-accent text-black font-bold rounded-lg text-sm
                     hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          Run Simulation
        </button>
      </div>

      {/* Scenario Cards */}
      <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: `repeat(${scenarios.length}, 1fr)` }}>
        {scenarios.map((s, idx) => (
          <div
            key={idx}
            className={`glass-panel p-4 border-t-2 ${
              idx === 0 ? 'border-t-cyan-400' : idx === 1 ? 'border-t-purple-400' : idx === 2 ? 'border-t-amber-400' : 'border-t-emerald-400'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-bold text-text-primary">Scenario {idx + 1}</span>
              {scenarios.length > 2 && (
                <button onClick={() => removeScenario(idx)} className="text-slate-600 hover:text-red-400 transition">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              <div>
                <label className="text-[10px] text-text-muted block mb-1 font-medium">Cause</label>
                <select
                  className="input-field text-xs py-1.5"
                  value={s.event_cause}
                  onChange={e => updateScenario(idx, 'event_cause', e.target.value)}
                >
                  {EVENT_CAUSES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-text-muted block mb-1 font-medium">Corridor</label>
                <select
                  className="input-field text-xs py-1.5"
                  value={s.corridor}
                  onChange={e => updateScenario(idx, 'corridor', e.target.value)}
                >
                  {CORRIDORS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-text-muted block mb-1 font-medium">Hour</label>
                  <input
                    type="number" min={0} max={23}
                    className="input-field text-xs py-1.5"
                    value={s.hour}
                    onChange={e => updateScenario(idx, 'hour', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-text-muted block mb-1 font-medium">Day</label>
                  <input
                    type="number" min={0} max={6}
                    className="input-field text-xs py-1.5"
                    value={s.day_of_week}
                    onChange={e => updateScenario(idx, 'day_of_week', parseInt(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-text-muted block mb-1 font-medium">Month</label>
                  <input
                    type="number" min={1} max={12}
                    className="input-field text-xs py-1.5"
                    value={s.month}
                    onChange={e => updateScenario(idx, 'month', parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-text-muted block mb-1 font-medium">Type</label>
                <select
                  className="input-field text-xs py-1.5"
                  value={s.event_type}
                  onChange={e => updateScenario(idx, 'event_type', e.target.value)}
                >
                  <option value="unplanned">Unplanned</option>
                  <option value="planned">Planned</option>
                </select>
              </div>
              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-1.5 text-[11px] text-text-secondary cursor-pointer">
                  <input type="checkbox" checked={s.has_junction}
                    onChange={e => updateScenario(idx, 'has_junction', e.target.checked)}
                    className="accent-cyan-300 w-3 h-3"
                  /> Junction
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-text-secondary cursor-pointer">
                  <input type="checkbox" checked={s.is_heavy_veh}
                    onChange={e => updateScenario(idx, 'is_heavy_veh', e.target.checked)}
                    className="accent-cyan-300 w-3 h-3"
                  /> Heavy Veh
                </label>
              </div>
            </div>
          </div>
        ))}

        {/* Add scenario button */}
        {scenarios.length < 4 && (
          <button
            onClick={addScenario}
            className="glass-panel border-dashed border-glass-border flex flex-col items-center justify-center
                       gap-2 min-h-[200px] hover:border-cyan-500/40 hover:bg-cyan-500/5 transition cursor-pointer"
          >
            <Plus className="w-6 h-6 text-slate-600" />
            <span className="text-xs text-text-muted">Add Scenario</span>
          </button>
        )}
      </div>

      {/* Results */}
      {results && (
        <div className="animate-slide-in-up space-y-5">
          {/* Comparison Banner */}
          {results.comparison && (
            <div className="glass-panel px-5 py-4 border-l-4 border-l-cyan-400">
              <div className="flex items-center gap-3 mb-2">
                <ArrowRightLeft className="w-5 h-5 text-cyan-300" />
                <span className="text-sm font-bold text-text-primary">Comparison Summary</span>
              </div>
              <p className="text-sm text-text-secondary">{results.comparison.recommendation}</p>
              <div className="flex gap-6 mt-3">
                <div className="text-xs text-text-muted">
                  Severity Range: <span className="text-text-primary font-semibold">
                    {results.comparison.severity_range.min.toFixed(1)} – {results.comparison.severity_range.max.toFixed(1)}
                  </span>
                </div>
                <div className="text-xs text-text-muted">
                  Resolution Range: <span className="text-text-primary font-semibold">
                    {results.comparison.resolution_range.min.toFixed(0)} – {results.comparison.resolution_range.max.toFixed(0)} min
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Result Cards */}
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${results.results.length}, 1fr)` }}>
            {results.results.map((r, idx) => {
              const p = r.prediction;
              const isBest = results.comparison?.best_scenario === idx;
              const isWorst = results.comparison?.worst_scenario === idx;
              return (
                <div
                  key={idx}
                  className={`glass-panel p-4 relative ${
                    isBest ? 'ring-1 ring-green-500/50' : isWorst ? 'ring-1 ring-red-500/50' : ''
                  }`}
                >
                  {/* Badge */}
                  {isBest && (
                    <div className="absolute -top-2.5 left-3 px-2 py-0.5 bg-green-500/20 border border-green-500/30
                                    rounded text-[10px] font-bold text-green-400 uppercase tracking-wider">
                      Best
                    </div>
                  )}
                  {isWorst && (
                    <div className="absolute -top-2.5 left-3 px-2 py-0.5 bg-red-500/20 border border-red-500/30
                                    rounded text-[10px] font-bold text-red-400 uppercase tracking-wider">
                      Worst
                    </div>
                  )}

                  <h4 className="text-sm font-bold text-text-primary mb-3 mt-1">Scenario {idx + 1}</h4>

                  {/* Severity */}
                  <div className={`text-center py-3 rounded-lg mb-3 border ${getSeverityBg(p.severity_score)}`}>
                    <div className={`text-3xl font-black ${getSeverityColor(p.severity_score)}`}>
                      {p.severity_score.toFixed(1)}
                    </div>
                    <div className="text-[10px] text-text-muted uppercase tracking-wider mt-1">{p.severity_label}</div>
                  </div>

                  {/* Metrics */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted flex items-center gap-1.5"><Clock className="w-3 h-3" /> Resolution</span>
                      <span className="text-text-primary font-semibold">{p.resolution_minutes.toFixed(0)} min</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted flex items-center gap-1.5"><Shield className="w-3 h-3" /> Closure</span>
                      <span className={`font-semibold ${p.closure_predicted ? 'text-red-400' : 'text-green-400'}`}>
                        {p.closure_predicted ? 'Likely' : 'Unlikely'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted flex items-center gap-1.5"><Users className="w-3 h-3" /> Personnel</span>
                      <span className="text-text-primary font-semibold">{p.personnel}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-muted flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" /> Barricades</span>
                      <span className="text-text-primary font-semibold">{p.barricades}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
