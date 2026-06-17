import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { Calendar as CalendarIcon, Plus, Info, Shield, Clock, MapPin, Users, TrendingUp } from 'lucide-react';
import ECRSBadge from '../components/shared/ECRSBadge';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function getTypeColor(type) {
  switch(type) {
    case 'festival_shopping': return 'bg-amber-500';
    case 'procession': return 'bg-red-500';
    case 'sports': return 'bg-blue-500';
    case 'public_holiday': return 'bg-green-500';
    case 'vip_movement_procession': return 'bg-purple-500';
    default: return 'bg-gray-500';
  }
}

function getBaselineColor(baseline) {
  switch(baseline) {
    case 'diwali': return 'text-amber-400 bg-amber-400/10 border-amber-400/30';
    case 'procession_immersion': return 'text-red-400 bg-red-400/10 border-red-400/30';
    case 'ipl': return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
    case 'public_holiday': return 'text-green-400 bg-green-400/10 border-green-400/30';
    case 'state_event': return 'text-purple-400 bg-purple-400/10 border-purple-400/30';
    case 'festival': return 'text-amber-400 bg-amber-400/10 border-amber-400/30';
    default: return 'text-text-secondary bg-navy-700 border-glass-border';
  }
}

export default function EventPlannerPage() {
  const [currentDate, setCurrentDate] = useState(new Date(2024, 2, 1)); // March 2024
  const [monthEvents, setMonthEvents] = useState({});
  const [selectedDate, setSelectedDate] = useState(null);
  const [dateRisk, setDateRisk] = useState(null);
  const [allEvents, setAllEvents] = useState([]);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [forecastResult, setForecastResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // New event form state
  const [newEvent, setNewEvent] = useState({
    event_cause: 'public_event',
    event_type: 'planned',
    corridor: '',
    datetime: '',
    latitude: 12.979,
    longitude: 77.599,
    requires_road_closure: false,
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;

  useEffect(() => {
    api.getMonthlyEvents(year, month).then(data => setMonthEvents(data.events || {})).catch(console.error);
    api.getCalendarEvents().then(data => setAllEvents(data.events || [])).catch(console.error);
  }, [year, month]);

  const handleDateClick = async (dateStr) => {
    setSelectedDate(dateStr);
    setDateRisk(null);
    try {
      const risk = await api.getCalendarRisk(dateStr);
      setDateRisk(risk);
    } catch (err) {
      console.error(err);
    }
  };

  const handleForecast = async () => {
    setLoading(true);
    try {
      const result = await api.postForecast({
        ...newEvent,
        datetime: newEvent.datetime || `${year}-${String(month).padStart(2,'0')}-15T18:00:00`,
      });
      setForecastResult(result);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Calendar grid
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const startPad = (firstDay.getDay() + 6) % 7; // Monday start
  const totalDays = lastDay.getDate();

  const calendarDays = [];
  for (let i = 0; i < startPad; i++) calendarDays.push(null);
  for (let d = 1; d <= totalDays; d++) calendarDays.push(d);

  const prevMonth = () => setCurrentDate(new Date(year, month - 2, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month, 1));

  return (
    <div className="h-full flex overflow-hidden">
      {/* Calendar */}
      <div className="flex-1 flex flex-col p-4 overflow-y-auto">
        <div className="flex items-center gap-3 mb-4">
          <CalendarIcon className="w-5 h-5 text-accent-400" />
          <h1 className="text-lg font-bold text-text-primary">Event Planner</h1>
          <button onClick={() => setShowNewEvent(!showNewEvent)} className="ml-auto btn-primary text-xs">
            <Plus className="w-3.5 h-3.5" /> New Event Forecast
          </button>
        </div>

        {/* New Event Form */}
        {showNewEvent && (
          <div className="glass-panel p-4 mb-4 animate-slide-in-up">
            <h3 className="text-sm font-semibold mb-3 text-text-primary">Forecast New Event</h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-[10px] text-text-muted block mb-1">Event Cause</label>
                <select className="input-field text-xs" value={newEvent.event_cause} onChange={e => setNewEvent({...newEvent, event_cause: e.target.value})}>
                  <option value="public_event">Public Event</option>
                  <option value="procession">Procession</option>
                  <option value="vip_movement">VIP Movement</option>
                  <option value="construction">Construction</option>
                  <option value="accident">Accident</option>
                  <option value="protest">Protest</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-text-muted block mb-1">Date & Time</label>
                <input type="datetime-local" className="input-field text-xs" value={newEvent.datetime} onChange={e => setNewEvent({...newEvent, datetime: e.target.value})} />
              </div>
              <div>
                <label className="text-[10px] text-text-muted block mb-1">Corridor</label>
                <select className="input-field text-xs" value={newEvent.corridor} onChange={e => setNewEvent({...newEvent, corridor: e.target.value})}>
                  <option value="">Non-corridor</option>
                  <option value="Mysore Road">Mysore Road</option>
                  <option value="Bellary Road 1">Bellary Road 1</option>
                  <option value="Tumkur Road">Tumkur Road</option>
                  <option value="Hosur Road">Hosur Road</option>
                  <option value="ORR North 1">ORR North 1</option>
                  <option value="Old Madras Road">Old Madras Road</option>
                  <option value="Magadi Road">Magadi Road</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                <input type="checkbox" checked={newEvent.requires_road_closure} onChange={e => setNewEvent({...newEvent, requires_road_closure: e.target.checked})} className="accent-accent-400" />
                Requires Road Closure
              </label>
              <button onClick={handleForecast} className="btn-primary text-xs ml-auto" disabled={loading}>
                {loading ? 'Computing...' : 'Get Forecast'}
              </button>
            </div>

            {/* Forecast Result */}
            {forecastResult && (
              <div className="mt-4 border-t border-glass-border pt-4 grid grid-cols-3 gap-3 animate-slide-in-up">
                <div className="glass-panel-sm p-3 text-center">
                  <p className="text-[10px] text-text-muted mb-1">ECRS Score</p>
                  <ECRSBadge score={forecastResult.ecrs?.score} size="lg" />
                </div>
                <div className="glass-panel-sm p-3 text-center">
                  <p className="text-[10px] text-text-muted mb-1">Gravity Score</p>
                  <p className="text-xl font-bold text-accent-400">{forecastResult.gravity?.score?.toFixed(2)}</p>
                  <p className="text-[10px] text-text-muted">{forecastResult.gravity?.nearby_pois?.length || 0} nearby POIs</p>
                </div>
                <div className="glass-panel-sm p-3 text-center">
                  <p className="text-[10px] text-text-muted mb-1">Recommended</p>
                  <p className="text-xl font-bold text-accent-400">{forecastResult.resources?.total_officers}</p>
                  <p className="text-[10px] text-text-muted">officers</p>
                </div>
                {forecastResult.historical && (
                  <div className="col-span-3 glass-panel-sm p-3">
                    <p className="text-[10px] text-text-muted mb-1">Historical Pattern</p>
                    <p className="text-xs text-text-secondary">
                      {forecastResult.historical.total_similar} similar past incidents • 
                      Avg resolution: {forecastResult.historical.avg_duration || 'N/A'} min • 
                      Avg ECRS: {forecastResult.historical.avg_ecrs}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="btn-secondary text-xs py-1.5 px-3">← Prev</button>
          <h2 className="text-base font-semibold text-text-primary">{MONTHS[month-1]} {year}</h2>
          <button onClick={nextMonth} className="btn-secondary text-xs py-1.5 px-3">Next →</button>
        </div>

        {/* Calendar Grid */}
        <div className="glass-panel overflow-hidden">
          <div className="grid grid-cols-7">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold text-text-muted py-2 border-b border-glass-border">
                {d}
              </div>
            ))}
            {calendarDays.map((day, idx) => {
              const dateStr = day ? `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}` : null;
              const events = dateStr ? (monthEvents[dateStr] || []) : [];
              const isSelected = dateStr === selectedDate;
              
              return (
                <div
                  key={idx}
                  className={`min-h-[72px] p-1.5 border-b border-r border-glass-border transition-colors cursor-pointer ${
                    day ? 'hover:bg-navy-800/60' : 'bg-navy-950/40'
                  } ${isSelected ? 'bg-accent-500/10 border-accent-400/30' : ''}`}
                  onClick={() => dateStr && handleDateClick(dateStr)}
                >
                  {day && (
                    <>
                      <span className={`text-xs ${isSelected ? 'text-accent-400 font-bold' : 'text-text-secondary'}`}>
                        {day}
                      </span>
                      <div className="mt-1 space-y-0.5">
                        {events.map((evt, i) => (
                          <div key={i} className={`${getTypeColor(evt.type)} rounded px-1 py-0.5`}>
                            <span className="text-[8px] text-white font-medium truncate block">
                              {evt.name.length > 16 ? evt.name.substring(0, 16) + '...' : evt.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Event Legend */}
        <div className="flex gap-3 mt-3 text-[10px] text-text-muted">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Festival</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" /> Procession</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Sports</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /> Holiday</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" /> VIP/State</span>
        </div>
      </div>

      {/* Event Detail Panel */}
      <div className="w-[360px] border-l border-glass-border overflow-y-auto p-4 bg-navy-900/40">
        {!selectedDate ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <CalendarIcon className="w-12 h-12 text-navy-600 mb-3" />
            <p className="text-sm text-text-muted">Select a date to view</p>
            <p className="text-xs text-text-muted mt-1">event details and risk assessment</p>
          </div>
        ) : (
          <div className="animate-slide-in-right">
            <h3 className="text-sm font-semibold text-text-primary mb-3">{selectedDate}</h3>
            
            {dateRisk && (
              <>
                {/* Baseline Badge */}
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium mb-4 ${getBaselineColor(dateRisk.baseline)}`}>
                  <Shield className="w-3.5 h-3.5" />
                  {dateRisk.baseline_config?.name || 'Normal Day'}
                </div>

                {dateRisk.has_events ? (
                  <>
                    {/* Multiplier */}
                    <div className="glass-panel-sm p-3 mb-3">
                      <p className="text-[10px] text-text-muted mb-1">Traffic Multiplier</p>
                      <p className="text-2xl font-bold text-accent-400">{dateRisk.combined_multiplier}x</p>
                      <p className="text-[10px] text-text-muted mt-1">{dateRisk.baseline_config?.description}</p>
                    </div>

                    {/* Active Events */}
                    <h4 className="text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wider">
                      Active Events
                    </h4>
                    {dateRisk.active_events?.map((evt, idx) => (
                      <div key={idx} className="glass-panel-sm p-3 mb-2">
                        <p className="text-sm font-semibold text-text-primary">{evt.name}</p>
                        <p className="text-xs text-text-muted mt-1">{evt.description}</p>
                        {evt.peak_hours?.length > 0 && (
                          <p className="text-[10px] text-text-muted mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Peak: {evt.peak_hours.join(' - ')}
                          </p>
                        )}
                        <p className="text-[10px] text-text-muted mt-1 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" /> Multiplier: {evt.traffic_multiplier}x
                        </p>
                      </div>
                    ))}

                    {/* Affected Zones */}
                    <h4 className="text-xs font-semibold text-text-secondary mt-4 mb-2 uppercase tracking-wider">
                      Affected Zones
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {dateRisk.affected_zones?.map((zone, idx) => (
                        <span key={idx} className="text-[10px] bg-navy-700 text-text-secondary px-2 py-1 rounded">
                          {zone}
                        </span>
                      ))}
                    </div>

                    {/* Recommendations */}
                    <h4 className="text-xs font-semibold text-text-secondary mt-4 mb-2 uppercase tracking-wider">
                      Recommendations
                    </h4>
                    <div className="space-y-1.5">
                      {dateRisk.recommendations?.map((rec, idx) => (
                        <p key={idx} className="text-[11px] text-text-secondary flex items-start gap-1.5">
                          <Info className="w-3 h-3 text-accent-400 shrink-0 mt-0.5" />
                          {rec}
                        </p>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="glass-panel-sm p-4 text-center">
                    <p className="text-sm text-text-secondary">Normal operations day</p>
                    <p className="text-xs text-text-muted mt-1">No special events scheduled. Standard deployment.</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
