import React from 'react';
import { AlertTriangle, Activity, TrendingUp } from 'lucide-react';

export default function ZoneSummaryBar({ stats }) {
  if (!stats) return null;

  const zones = stats.zone_breakdown || [];

  return (
    <div className="gradient-header px-6 py-4 shrink-0">
      <div className="flex items-center gap-3 mb-4">
        <Activity className="w-5 h-5 text-accent-400 flex-shrink-0" />
        <span className="text-base font-semibold text-text-secondary uppercase tracking-wider">
          Zone Status Overview
        </span>
        <span className="ml-auto text-xs text-text-muted whitespace-nowrap">
          {stats.active_incidents} active • {stats.total_incidents?.toLocaleString()} total
        </span>
      </div>
      
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
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
              className={`glass-panel-sm px-4 py-3 min-w-[160px] shrink-0 border ${riskColor} hover-lift cursor-default animate-slide-in-up`}
              style={{ animationDelay: `${idx * 40}ms` }}
            >
              <p className="text-sm font-semibold text-text-primary truncate mb-2">{zone.zone}</p>
              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-2xl font-bold text-text-primary">{zone.count}</span>
                <span className="text-xs text-text-muted">incidents</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-text-muted flex-shrink-0" />
                <span className="text-xs text-text-muted">
                  avg {zone.avg_ecrs} / max {zone.max_ecrs}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
