import React from 'react';
import ECRSBadge from '../shared/ECRSBadge';
import {
  AlertTriangle,
  Car,
  Construction,
  Droplets,
  TreePine,
  Users,
  Siren,
  Shield,
  Megaphone,
  CircleDot,
  Zap,
  Clock,
} from 'lucide-react';

const causeIcons = {
  vehicle_breakdown: Car,
  accident: AlertTriangle,
  construction: Construction,
  water_logging: Droplets,
  pot_holes: CircleDot,
  tree_fall: TreePine,
  public_event: Users,
  procession: Users,
  vip_movement: Shield,
  protest: Megaphone,
  congestion: Zap,
  others: AlertTriangle,
};

export default function AlertFeed({ incidents = [], onGetRecommendation }) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-glass-border shrink-0">
        <div className="flex items-center gap-2">
          <Siren className="w-4 h-4 text-risk-critical animate-pulse" />
          <h2 className="text-sm font-semibold text-text-primary">Active Alerts</h2>
          <span className="ml-auto bg-risk-critical/20 text-risk-critical text-[10px] font-bold px-2 py-0.5 rounded-full">
            {incidents.length}
          </span>
        </div>
      </div>

      {/* Alert List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {incidents.length === 0 ? (
          <div className="text-center py-8 text-text-muted text-sm">
            No active incidents
          </div>
        ) : (
          incidents.map((incident, idx) => {
            const CauseIcon = causeIcons[incident.event_cause] || AlertTriangle;
            const address = incident.address || 'Unknown location';
            const shortAddress = address.length > 80 ? address.substring(0, 80) + '...' : address;

            return (
              <div
                key={incident.id || idx}
                className="glass-panel-sm p-3 hover:border-accent-400/30 transition-all cursor-default animate-slide-in-up"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-navy-700 flex items-center justify-center shrink-0 mt-0.5">
                    <CauseIcon className="w-4 h-4 text-text-secondary" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-semibold text-text-primary capitalize">
                        {incident.event_cause?.replace('_', ' ')}
                      </span>
                      <ECRSBadge score={incident.ecrs_score} showLabel={false} size="sm" />
                    </div>
                    
                    <p className="text-[11px] text-text-muted leading-relaxed mb-1.5">
                      {shortAddress}
                    </p>
                    
                    <div className="flex items-center gap-3 text-[10px] text-text-muted">
                      {incident.corridor && incident.corridor !== 'Non-corridor' && (
                        <span className="bg-navy-700 px-1.5 py-0.5 rounded">{incident.corridor}</span>
                      )}
                      {incident.duration_minutes && (
                        <span className="flex items-center gap-0.5">
                          <Clock className="w-3 h-3" />
                          {Math.round(incident.duration_minutes)}m
                        </span>
                      )}
                      <span className={`font-medium ${incident.priority === 'High' ? 'text-risk-critical' : 'text-risk-moderate'}`}>
                        {incident.priority}
                      </span>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => onGetRecommendation?.(incident)}
                  className="btn-primary w-full mt-2.5 text-xs py-1.5 justify-center"
                >
                  <Zap className="w-3 h-3" />
                  Get AI Recommendations
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
