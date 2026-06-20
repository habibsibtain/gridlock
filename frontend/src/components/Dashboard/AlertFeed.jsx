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
      <div className="px-6 py-4 border-b border-glass-border shrink-0">
        <div className="flex items-center gap-3">
          <Siren className="w-5 h-5 text-risk-critical animate-pulse flex-shrink-0" />
          <h2 className="text-base font-semibold text-text-primary">Active Alerts</h2>
          <span className="ml-auto bg-risk-critical/20 text-risk-critical text-xs font-bold px-3 py-1 rounded-full">
            {incidents.length}
          </span>
        </div>
      </div>

      {/* Alert List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {incidents.length === 0 ? (
          <div className="text-center py-12 text-text-muted text-sm">
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
                className="glass-panel px-4 py-4 hover:border-cyan-300/40 transition-all cursor-default animate-slide-in-up"
                style={{ animationDelay: `${idx * 50}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                    <CauseIcon className="w-5 h-5 text-text-secondary" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-semibold text-text-primary capitalize">
                        {incident.event_cause?.replace('_', ' ')}
                      </span>
                      <ECRSBadge score={incident.ecrs_score} showLabel={false} size="sm" />
                    </div>
                    
                    <p className="text-xs text-text-muted leading-relaxed mb-3">
                      {shortAddress}
                    </p>
                    
                    <div className="flex items-center gap-4 text-xs text-text-muted mb-3">
                      {incident.corridor && incident.corridor !== 'Non-corridor' && (
                        <span className="bg-slate-700 px-2 py-1 rounded text-[9px]">{incident.corridor}</span>
                      )}
                      {incident.duration_minutes && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {Math.round(incident.duration_minutes)}m
                        </span>
                      )}
                      <span className={`font-semibold ${incident.priority === 'High' ? 'text-risk-critical' : 'text-risk-moderate'}`}>
                        {incident.priority}
                      </span>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={() => onGetRecommendation?.(incident)}
                  className="btn-primary w-full text-sm py-2 justify-center mt-3"
                >
                  <Zap className="w-4 h-4" />
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
