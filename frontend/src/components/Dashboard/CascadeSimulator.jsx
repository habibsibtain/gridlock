import React, { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { Network, Zap, AlertTriangle, ChevronDown } from 'lucide-react';

export default function CascadeSimulator({ onResult }) {
  const [corridors, setCorridors] = useState([]);
  const [selectedCorridor, setSelectedCorridor] = useState('');
  const [blockPercentage, setBlockPercentage] = useState(50);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.getCorridors().then((data) => {
      setCorridors(data.corridors || []);
    }).catch(console.error);
  }, []);

  const handleSimulate = async () => {
    if (!selectedCorridor) return;
    setLoading(true);
    try {
      const res = await api.postCascade({
        blocked_corridor: selectedCorridor,
        blocked_percentage: blockPercentage / 100,
        hour: new Date().getHours(),
      });
      setResult(res);
      onResult?.(res);
    } catch (err) {
      console.error('Cascade simulation failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'CRITICAL': return 'text-risk-critical bg-risk-critical/10 border-risk-critical/30';
      case 'HIGH': return 'text-risk-high bg-risk-high/10 border-risk-high/30';
      case 'MODERATE': return 'text-risk-moderate bg-risk-moderate/10 border-risk-moderate/30';
      default: return 'text-risk-low bg-risk-low/10 border-risk-low/30';
    }
  };

  return (
    <div className="glass-panel p-3">
      <div className="flex items-center gap-2 mb-3">
        <Network className="w-4 h-4 text-accent-400" />
        <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider">
          Cascade Impact Simulator
        </h3>
      </div>

      <div className="flex gap-3 items-end">
        {/* Corridor selector */}
        <div className="flex-1">
          <label className="text-[10px] text-text-muted mb-1 block">Corridor</label>
          <select
            className="input-field text-xs py-2"
            value={selectedCorridor}
            onChange={(e) => setSelectedCorridor(e.target.value)}
          >
            <option value="">Select corridor...</option>
            {corridors.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.capacity_pcu} PCU)
              </option>
            ))}
          </select>
        </div>

        {/* Block percentage */}
        <div className="w-[180px]">
          <label className="text-[10px] text-text-muted mb-1 block">
            Blockage: {blockPercentage}%
          </label>
          <input
            type="range"
            min="10"
            max="100"
            step="10"
            value={blockPercentage}
            onChange={(e) => setBlockPercentage(Number(e.target.value))}
            className="w-full h-2 bg-navy-700 rounded-lg appearance-none cursor-pointer accent-accent-400"
          />
        </div>

        {/* Simulate button */}
        <button
          onClick={handleSimulate}
          disabled={!selectedCorridor || loading}
          className="btn-danger text-xs py-2 px-4 shrink-0 disabled:opacity-40"
        >
          <Zap className="w-3.5 h-3.5" />
          {loading ? 'Simulating...' : 'Simulate Block'}
        </button>
      </div>

      {/* Results */}
      {result && !result.error && (
        <div className="mt-3 border-t border-glass-border pt-3 animate-slide-in-up">
          <div className="flex items-center gap-4 text-xs mb-2">
            <span className="text-text-muted">
              Displaced: <span className="text-text-primary font-semibold">{result.displaced_pcu} PCU</span>
            </span>
            <span className="text-text-muted">
              Affected corridors: <span className="text-risk-critical font-semibold">{result.total_corridors_affected}</span>
            </span>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-1">
            {result.cascade_alerts?.map((alert, idx) => (
              <div
                key={idx}
                className={`glass-panel-sm px-3 py-2 min-w-[160px] shrink-0 border ${getRiskColor(alert.risk)}`}
              >
                <p className="text-[11px] font-semibold truncate">{alert.corridor}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1">
                    <div className="h-1.5 bg-navy-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(alert.projected_load_pct, 100)}%`,
                          backgroundColor: alert.risk === 'CRITICAL' ? '#ef4444' : alert.risk === 'HIGH' ? '#f97316' : alert.risk === 'MODERATE' ? '#eab308' : '#22c55e',
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold">{alert.projected_load_pct}%</span>
                </div>
                {alert.time_to_overload_mins && (
                  <p className="text-[9px] mt-1 opacity-70">
                    ⚠ Overload in {alert.time_to_overload_mins} min
                  </p>
                )}
              </div>
            ))}
          </div>

          {result.recommended_actions?.length > 0 && (
            <div className="mt-2 space-y-1">
              {result.recommended_actions.slice(0, 3).map((action, idx) => (
                <p key={idx} className="text-[11px] text-text-secondary flex items-start gap-1.5">
                  <AlertTriangle className="w-3 h-3 text-risk-high shrink-0 mt-0.5" />
                  {action}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
