import React, { useState, useEffect } from 'react';
import {
  MessageSquarePlus, History, TrendingUp, TrendingDown,
  CheckCircle, XCircle, AlertTriangle, Clock, Users, BarChart3,
  ChevronDown, ChevronUp, Send, Lightbulb
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import useGridlock from '../hooks/useGridlock';

export default function FeedbackPanel() {
  const { submitFeedback, fetchFeedbackHistory, fetchFeedbackStats } = useGridlock();
  const [tab, setTab] = useState('submit'); // submit | history | drift
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState({
    predicted_resolution_min: '',
    predicted_closure: false,
    predicted_severity: '',
    predicted_personnel: '',
    predicted_barricades: '',
    event_cause: 'accident',
    corridor: 'Non-corridor',
    hour: 12,
    actual_resolution_min: '',
    actual_closure: false,
    actual_personnel: '',
    notes: '',
  });

  useEffect(() => {
    if (tab === 'history') loadHistory();
    if (tab === 'drift') loadStats();
  }, [tab]);

  const loadHistory = async () => {
    const data = await fetchFeedbackHistory();
    if (data) setHistory(data.entries || []);
  };

  const loadStats = async () => {
    const data = await fetchFeedbackStats();
    if (data) setStats(data);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const payload = {
      ...form,
      predicted_resolution_min: parseFloat(form.predicted_resolution_min) || 0,
      predicted_severity: parseFloat(form.predicted_severity) || 0,
      predicted_personnel: parseInt(form.predicted_personnel) || 0,
      predicted_barricades: parseInt(form.predicted_barricades) || 0,
      actual_resolution_min: parseFloat(form.actual_resolution_min) || 0,
      actual_personnel: parseInt(form.actual_personnel) || 0,
      hour: parseInt(form.hour) || 12,
    };
    const result = await submitFeedback(payload);
    setSubmitting(false);
    if (result) {
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 3000);
      setForm({
        predicted_resolution_min: '', predicted_closure: false,
        predicted_severity: '', predicted_personnel: '', predicted_barricades: '',
        event_cause: 'accident', corridor: 'Non-corridor', hour: 12,
        actual_resolution_min: '', actual_closure: false, actual_personnel: '', notes: '',
      });
    }
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const CAUSES = [
    { value: 'accident', label: 'Accident' },
    { value: 'vehicle_breakdown', label: 'Vehicle Breakdown' },
    { value: 'construction', label: 'Construction' },
    { value: 'congestion', label: 'Congestion' },
    { value: 'public_event', label: 'Public Event' },
    { value: 'others', label: 'Others' },
  ];

  return (
    <div className="h-full overflow-y-auto p-6 pt-7" id="feedback-panel">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
          <MessageSquarePlus className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Post-Event Feedback</h1>
          <p className="text-xs text-text-muted mt-0.5">Predicted vs Actual — continuous model improvement</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 glass-panel-sm rounded-lg mb-6 w-fit">
        {[
          { id: 'submit', label: 'Close Incident', icon: Send },
          { id: 'history', label: 'History', icon: History },
          { id: 'drift', label: 'Model Drift', icon: BarChart3 },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-md text-xs font-semibold flex items-center gap-2 transition ${
              tab === t.id
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                : 'text-text-muted hover:text-text-secondary'
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Submit Tab */}
      {tab === 'submit' && (
        <form onSubmit={handleSubmit} className="max-w-3xl animate-fade-in">
          {submitted && (
            <div className="glass-panel px-4 py-3 mb-5 border-l-4 border-l-green-500 flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
              <span className="text-sm text-green-400 font-medium">Feedback saved successfully! Model learning updated.</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-6">
            {/* Left — Predicted Values */}
            <div className="glass-panel p-5">
              <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-cyan-300" />
                ML Predicted Values
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-text-muted block mb-1 font-medium">Event Cause</label>
                  <select className="input-field text-xs" value={form.event_cause}
                    onChange={e => handleChange('event_cause', e.target.value)}>
                    {CAUSES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-text-muted block mb-1 font-medium">Predicted Resolution (min)</label>
                  <input type="number" className="input-field text-xs" placeholder="e.g. 45"
                    value={form.predicted_resolution_min}
                    onChange={e => handleChange('predicted_resolution_min', e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-text-muted block mb-1 font-medium">Predicted Severity (0-10)</label>
                  <input type="number" step="0.1" className="input-field text-xs" placeholder="e.g. 5.2"
                    value={form.predicted_severity}
                    onChange={e => handleChange('predicted_severity', e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-text-muted block mb-1 font-medium">Predicted Personnel</label>
                  <input type="number" className="input-field text-xs" placeholder="e.g. 5"
                    value={form.predicted_personnel}
                    onChange={e => handleChange('predicted_personnel', e.target.value)} />
                </div>
                <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer pt-1">
                  <input type="checkbox" checked={form.predicted_closure}
                    onChange={e => handleChange('predicted_closure', e.target.checked)}
                    className="accent-cyan-300 w-3.5 h-3.5" />
                  Closure Predicted
                </label>
              </div>
            </div>

            {/* Right — Actual Values */}
            <div className="glass-panel p-5 border-l-2 border-l-emerald-500/50">
              <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                Actual Field Outcomes
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] text-text-muted block mb-1 font-medium">Actual Resolution Time (min)</label>
                  <input type="number" className="input-field text-xs" placeholder="How long did it actually take?"
                    value={form.actual_resolution_min} required
                    onChange={e => handleChange('actual_resolution_min', e.target.value)} />
                </div>
                <div>
                  <label className="text-[10px] text-text-muted block mb-1 font-medium">Actual Personnel Deployed</label>
                  <input type="number" className="input-field text-xs" placeholder="How many officers were on-site?"
                    value={form.actual_personnel} required
                    onChange={e => handleChange('actual_personnel', e.target.value)} />
                </div>
                <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer pt-1">
                  <input type="checkbox" checked={form.actual_closure}
                    onChange={e => handleChange('actual_closure', e.target.checked)}
                    className="accent-emerald-300 w-3.5 h-3.5" />
                  Road Was Closed
                </label>
                <div>
                  <label className="text-[10px] text-text-muted block mb-1 font-medium">Field Notes</label>
                  <textarea className="input-field text-xs" rows={3} placeholder="Any observations..."
                    value={form.notes}
                    onChange={e => handleChange('notes', e.target.value)} />
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit" disabled={submitting}
            className="mt-5 px-6 py-2.5 gradient-accent text-black font-bold rounded-lg text-sm
                       hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
          >
            {submitting ? (
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Submit Feedback
          </button>
        </form>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="animate-fade-in">
          {history.length === 0 ? (
            <div className="glass-panel p-8 text-center">
              <History className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-text-muted">No feedback entries yet. Close an incident to start tracking.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((entry) => (
                <div key={entry.id} className="glass-panel px-5 py-4 hover-lift">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs font-bold text-text-primary">
                      {entry.event_cause?.replace('_', ' ').toUpperCase()}
                    </span>
                    <span className="text-[10px] text-text-muted">{entry.corridor}</span>
                    <span className="text-[10px] text-text-muted ml-auto">
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-xs">
                    <div>
                      <span className="text-text-muted block mb-1">Resolution Time</span>
                      <div className="flex items-center gap-2">
                        <span className="text-cyan-300 font-semibold">{entry.predicted?.resolution_min?.toFixed(0)}m</span>
                        <span className="text-text-muted">→</span>
                        <span className="text-emerald-400 font-semibold">{entry.actual?.resolution_min?.toFixed(0)}m</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          Math.abs(entry.delta?.resolution_error) <= 10
                            ? 'bg-green-500/10 text-green-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}>
                          {entry.delta?.resolution_error > 0 ? '+' : ''}{entry.delta?.resolution_error?.toFixed(0)}m
                        </span>
                      </div>
                    </div>
                    <div>
                      <span className="text-text-muted block mb-1">Closure</span>
                      <span className={`flex items-center gap-1.5 font-semibold ${
                        entry.delta?.closure_correct ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {entry.delta?.closure_correct ? (
                          <><CheckCircle className="w-3 h-3" /> Correct</>
                        ) : (
                          <><XCircle className="w-3 h-3" /> Wrong</>
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-muted block mb-1">Personnel Delta</span>
                      <span className={`font-semibold ${
                        entry.delta?.personnel_delta === 0
                          ? 'text-green-400'
                          : 'text-amber-400'
                      }`}>
                        {entry.delta?.personnel_delta > 0 ? '+' : ''}{entry.delta?.personnel_delta}
                      </span>
                    </div>
                  </div>
                  {entry.notes && (
                    <p className="text-[11px] text-text-muted mt-3 italic border-t border-glass-border pt-2">
                      {entry.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Drift Tab */}
      {tab === 'drift' && (
        <div className="animate-fade-in space-y-5">
          {!stats || stats.total_entries === 0 ? (
            <div className="glass-panel p-8 text-center">
              <BarChart3 className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-sm text-text-muted">Not enough data. Submit feedback to track model performance.</p>
            </div>
          ) : (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="glass-panel px-4 py-3">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Total Reviews</div>
                  <div className="text-2xl font-bold text-text-primary">{stats.total_entries}</div>
                </div>
                <div className="glass-panel px-4 py-3">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Avg Error</div>
                  <div className={`text-2xl font-bold ${
                    stats.avg_resolution_error < 15 ? 'text-green-400' : 'text-amber-400'
                  }`}>{stats.avg_resolution_error} min</div>
                </div>
                <div className="glass-panel px-4 py-3">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Closure Accuracy</div>
                  <div className={`text-2xl font-bold ${
                    stats.closure_accuracy_pct >= 80 ? 'text-green-400' : 'text-amber-400'
                  }`}>{stats.closure_accuracy_pct}%</div>
                </div>
                <div className="glass-panel px-4 py-3">
                  <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Personnel Delta</div>
                  <div className="text-2xl font-bold text-text-primary">{stats.avg_personnel_delta > 0 ? '+' : ''}{stats.avg_personnel_delta}</div>
                </div>
              </div>

              {/* Trend Chart */}
              {stats.trend?.length > 0 && (
                <div className="glass-panel px-5 py-4">
                  <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-cyan-300" />
                    Resolution Error Trend
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={stats.trend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="timestamp" tick={false} stroke="#475569" />
                      <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{
                          background: '#0a0a0a', border: '1px solid rgba(0,229,255,0.2)',
                          borderRadius: '8px', fontSize: '12px', color: '#f1f5f9',
                        }}
                      />
                      <Line type="monotone" dataKey="resolution_error" stroke="#00e5ff" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Lessons Learned */}
              {stats.lessons?.length > 0 && (
                <div className="glass-panel px-5 py-4">
                  <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                    Auto-Generated Insights
                  </h3>
                  <div className="space-y-2">
                    {stats.lessons.map((l, i) => (
                      <div key={i} className={`px-4 py-2.5 rounded-lg text-xs flex items-center gap-2 ${
                        l.type === 'warning' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        l.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' :
                        'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                      }`}>
                        {l.type === 'warning' && <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
                        {l.type === 'success' && <CheckCircle className="w-3.5 h-3.5 shrink-0" />}
                        {l.type === 'info' && <Lightbulb className="w-3.5 h-3.5 shrink-0" />}
                        {l.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Per-Cause Accuracy */}
              {stats.cause_accuracy?.length > 0 && (
                <div className="glass-panel px-5 py-4">
                  <h3 className="text-sm font-semibold text-text-primary mb-3">Accuracy by Event Cause</h3>
                  <div className="space-y-2">
                    {stats.cause_accuracy.map((c, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs">
                        <span className="text-text-secondary w-28 capitalize">{c.cause?.replace('_', ' ')}</span>
                        <div className="flex-1 h-2 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-purple-500"
                            style={{ width: `${Math.min(100, 100 - c.avg_error)}%` }}
                          />
                        </div>
                        <span className="text-text-muted w-16 text-right">±{c.avg_error} min</span>
                        <span className="text-text-muted w-12 text-right">{c.count}×</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
