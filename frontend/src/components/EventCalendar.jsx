import React, { useState, useEffect } from 'react';
import {
  CalendarDays, Plus, Trash2, AlertTriangle, Shield, Clock,
  MapPin, Users, Zap, CheckCircle, ChevronRight, Search, Lightbulb
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

function getSeverityBadge(sev) {
  if (sev === 'critical') return 'bg-red-500/15 text-red-400 border-red-500/30';
  if (sev === 'high') return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
  return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
}

export default function EventCalendar() {
  const { createEvent, fetchEvents, deleteEvent, checkConflicts } = useGridlock();
  const [events, setEvents] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [conflictResult, setConflictResult] = useState(null);
  const [creating, setCreating] = useState(false);
  const [checking, setChecking] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState({
    name: '',
    event_cause: 'public_event',
    corridor: 'Non-corridor',
    date: today,
    start_hour: 9,
    duration_hours: 3,
    expected_crowd: '',
    notes: '',
  });

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    const data = await fetchEvents();
    if (data) setEvents(data.events || []);
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleCheckConflicts = async () => {
    setChecking(true);
    const result = await checkConflicts({
      corridor: form.corridor,
      date: form.date,
      start_hour: parseInt(form.start_hour),
      duration_hours: parseInt(form.duration_hours),
      event_cause: form.event_cause,
    });
    if (result) setConflictResult(result);
    setChecking(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    const result = await createEvent({
      ...form,
      start_hour: parseInt(form.start_hour),
      duration_hours: parseInt(form.duration_hours),
      expected_crowd: form.expected_crowd ? parseInt(form.expected_crowd) : null,
    });
    if (result) {
      setShowForm(false);
      setConflictResult(null);
      setForm({
        name: '', event_cause: 'public_event', corridor: 'Non-corridor',
        date: today, start_hour: 9, duration_hours: 3, expected_crowd: '', notes: '',
      });
      loadEvents();
    }
    setCreating(false);
  };

  const handleDelete = async (id) => {
    await deleteEvent(id);
    loadEvents();
  };

  return (
    <div className="h-full overflow-y-auto p-6 pt-7" id="event-calendar">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
          <CalendarDays className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Event Calendar</h1>
          <p className="text-xs text-text-muted mt-0.5">Multi-event conflict detection & resource optimization</p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setConflictResult(null); }}
          className="ml-auto px-4 py-2.5 gradient-accent text-black font-bold rounded-lg text-sm
                     hover:opacity-90 transition flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Plan Event
        </button>
      </div>

      {/* New Event Form */}
      {showForm && (
        <div className="glass-panel p-5 mb-6 animate-slide-in-up border-t-2 border-t-amber-400">
          <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 text-amber-400" />
            Register Planned Event
          </h3>

          <form onSubmit={handleCreate}>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="col-span-2">
                <label className="text-[10px] text-text-muted block mb-1 font-medium">Event Name</label>
                <input type="text" className="input-field text-sm" required placeholder="e.g. IPL Match at Chinnaswamy"
                  value={form.name} onChange={e => handleChange('name', e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] text-text-muted block mb-1 font-medium">Date</label>
                <input type="date" className="input-field text-sm"
                  value={form.date} onChange={e => handleChange('date', e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4 mb-4">
              <div>
                <label className="text-[10px] text-text-muted block mb-1 font-medium">Cause Type</label>
                <select className="input-field text-xs" value={form.event_cause}
                  onChange={e => handleChange('event_cause', e.target.value)}>
                  {EVENT_CAUSES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-text-muted block mb-1 font-medium">Corridor</label>
                <select className="input-field text-xs" value={form.corridor}
                  onChange={e => handleChange('corridor', e.target.value)}>
                  {CORRIDORS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-text-muted block mb-1 font-medium">Start Hour</label>
                <input type="number" min={0} max={23} className="input-field text-xs"
                  value={form.start_hour} onChange={e => handleChange('start_hour', e.target.value)} />
              </div>
              <div>
                <label className="text-[10px] text-text-muted block mb-1 font-medium">Duration (hrs)</label>
                <input type="number" min={1} max={12} className="input-field text-xs"
                  value={form.duration_hours} onChange={e => handleChange('duration_hours', e.target.value)} />
              </div>
            </div>

            <div className="flex gap-3 items-end">
              <button type="button" onClick={handleCheckConflicts} disabled={checking}
                className="px-4 py-2 rounded-lg text-xs font-bold border border-amber-500/30 bg-amber-500/10
                           text-amber-400 hover:bg-amber-500/20 transition flex items-center gap-2 disabled:opacity-50">
                {checking ? (
                  <div className="w-3.5 h-3.5 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                ) : (
                  <Search className="w-3.5 h-3.5" />
                )}
                Check Conflicts
              </button>
              <button type="submit" disabled={creating}
                className="px-4 py-2 gradient-accent text-black font-bold rounded-lg text-xs
                           hover:opacity-90 transition flex items-center gap-2 disabled:opacity-50">
                {creating ? (
                  <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                ) : (
                  <CheckCircle className="w-3.5 h-3.5" />
                )}
                Register Event
              </button>
            </div>
          </form>

          {/* Conflict Results */}
          {conflictResult && (
            <div className="mt-5 space-y-4 animate-fade-in border-t border-glass-border pt-5">
              {/* Conflicts */}
              {conflictResult.conflicts?.length > 0 ? (
                <div>
                  <h4 className="text-xs font-bold text-red-400 mb-2 flex items-center gap-2 uppercase tracking-wider">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {conflictResult.conflicts.length} Conflict{conflictResult.conflicts.length > 1 ? 's' : ''} Detected
                  </h4>
                  <div className="space-y-2">
                    {conflictResult.conflicts.map((c, i) => (
                      <div key={i} className={`px-4 py-3 rounded-lg border flex items-start gap-3 ${getSeverityBadge(c.severity)}`}>
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-bold">{c.conflicting_event?.name || 'Event'}</div>
                          <div className="text-[10px] opacity-80 mt-0.5">{c.message}</div>
                          <div className="text-[10px] opacity-60 mt-0.5">
                            Overlap: {c.overlap_hours}h · Type: {c.conflict_type}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-xs flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  No conflicts detected for this time slot!
                </div>
              )}

              {/* Compound Risk */}
              {conflictResult.compound_risk && (
                <div className="glass-panel px-4 py-3 border-l-4 border-l-red-500">
                  <div className="text-xs font-bold text-text-primary mb-1 flex items-center gap-2">
                    <Zap className="w-3.5 h-3.5 text-red-400" />
                    Compound Risk Assessment
                  </div>
                  <div className="flex gap-6 text-xs text-text-muted mb-2">
                    <span>Individual: <span className="text-cyan-300 font-semibold">
                      {conflictResult.compound_risk.individual_severity}/10</span></span>
                    <span>Compound: <span className="text-red-400 font-semibold">
                      {conflictResult.compound_risk.compound_severity}/10</span></span>
                    <span>Escalation: <span className="text-amber-400 font-semibold">
                      {conflictResult.compound_risk.escalation_factor}×</span></span>
                  </div>
                  <p className="text-[11px] text-text-secondary">{conflictResult.compound_risk.recommendation}</p>
                </div>
              )}

              {/* Suggested Slots */}
              {conflictResult.suggested_slots?.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-text-primary mb-2 flex items-center gap-2">
                    <Lightbulb className="w-3.5 h-3.5 text-emerald-400" />
                    Recommended Time Slots
                  </h4>
                  <div className="grid grid-cols-3 gap-2">
                    {conflictResult.suggested_slots.map((slot, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleChange('start_hour', slot.start_hour)}
                        className={`px-3 py-2.5 rounded-lg text-xs text-left transition border ${
                          i === 0
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                            : 'bg-slate-800/50 border-glass-border text-text-secondary hover:border-cyan-500/30'
                        }`}
                      >
                        <div className="font-bold">{slot.label}</div>
                        <div className="text-[10px] opacity-70 mt-0.5">
                          {slot.num_conflicts} conflicts · Risk: {slot.risk_score}
                        </div>
                        {i === 0 && <div className="text-[10px] font-semibold mt-1">✦ Recommended</div>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Event List */}
      <div className="space-y-3">
        {events.length === 0 ? (
          <div className="glass-panel p-10 text-center">
            <CalendarDays className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-text-secondary mb-1">No Events Planned</h3>
            <p className="text-xs text-text-muted">Click "Plan Event" to register upcoming events and detect conflicts.</p>
          </div>
        ) : (
          <>
            <h3 className="text-sm font-bold text-text-primary mb-2 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-cyan-300" />
              Planned Events ({events.length})
            </h3>
            {events.map((event) => (
              <div key={event.id} className="glass-panel px-5 py-4 hover-lift">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg bg-amber-500/10 border border-amber-500/20
                                  flex flex-col items-center justify-center shrink-0">
                    <span className="text-[10px] text-amber-400 font-medium leading-none">
                      {new Date(event.date + 'T00:00').toLocaleString('en', { month: 'short' })}
                    </span>
                    <span className="text-lg font-black text-amber-400 leading-none mt-0.5">
                      {new Date(event.date + 'T00:00').getDate()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="text-sm font-bold text-text-primary truncate">{event.name}</h4>
                      {event.predicted_severity >= 7 && (
                        <span className="px-1.5 py-0.5 bg-red-500/15 text-red-400 border border-red-500/30
                                         text-[9px] font-bold rounded uppercase">High Risk</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {event.corridor}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {event.start_hour}:00 – {event.end_hour}:00
                      </span>
                      <span className="flex items-center gap-1">
                        <Shield className="w-3 h-3" /> Severity: {event.predicted_severity?.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDelete(event.id)}
                    className="text-slate-600 hover:text-red-400 transition p-1 shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
