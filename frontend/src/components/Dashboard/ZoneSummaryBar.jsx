import React from 'react';
import { AlertTriangle, Activity, TrendingUp } from 'lucide-react';

export default function ZoneSummaryBar({ stats }) {
  if (!stats) return null;

  const zones = stats.zone_breakdown || [];

  return (
    <div className="gradient-header px-3 py-2 shrink-0">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-4 h-4 text-accent-400" />
        <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
          Zone Status Overview
        </span>
        <span className="ml-auto text-xs text-text-muted">
          {stats.active_incidents} active incidents • {stats.total_incidents?.toLocaleString()} total records
        </span>
      </div>
      
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {zones.map((zone, idx) => {
          const riskColor =
            zone.max_ecrs >= 8
              ? 'border-risk-critical/40 bg-risk-critical/5'
              : zone.max_ecrs >= 6
              ? 'border-risk-high/40 bg-risk-high/5'
              : zone.max_ecrs >= 4
              ? 'border-risk-moderate/40 bg-risk-moderate/5'
              : 'border-risk-low/30 bg-risk-low/5';

          return (
            <div
              key={zone.zone}
              className={`glass-panel-sm px-3 py-2 min-w-[140px] shrink-0 border ${riskColor} hover-lift cursor-default animate-slide-in-up`}
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <p className="text-[11px] font-medium text-text-primary truncate">{zone.zone}</p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-lg font-bold text-text-primary">{zone.count}</span>
                <span className="text-[10px] text-text-muted">incidents</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5">
                <TrendingUp className="w-3 h-3 text-text-muted" />
                <span className="text-[10px] text-text-muted">
                  ECRS avg {zone.avg_ecrs} / max {zone.max_ecrs}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
