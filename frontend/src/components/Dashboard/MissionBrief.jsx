import React from 'react';
import { X, Shield, Radio, User, Clock, MapPin, Zap } from 'lucide-react';
import ECRSBadge from '../shared/ECRSBadge';

export default function MissionBrief({ incident, brief, onClose }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-2xl mx-4 glass-panel border-accent-400/30 shadow-2xl animate-slide-in-up max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-glass-border shrink-0">
          <div className="w-10 h-10 rounded-lg gradient-accent flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-text-primary">ASTRAM Mission Brief</h2>
            <p className="text-xs text-text-muted">AI Operational Recommendation</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-navy-700 transition-colors">
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        {/* Incident Summary */}
        {incident && (
          <div className="px-5 py-3 border-b border-glass-border shrink-0">
            <div className="flex items-start gap-3">
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-text-primary capitalize">
                    {incident.event_cause?.replace('_', ' ')}
                  </span>
                  <ECRSBadge score={incident.ecrs_score} size="sm" />
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${incident.priority === 'High' ? 'bg-risk-critical/15 text-risk-critical' : 'bg-risk-moderate/15 text-risk-moderate'}`}>
                    {incident.priority}
                  </span>
                </div>
                <p className="text-[11px] text-text-muted flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {incident.address?.substring(0, 100) || 'Unknown location'}
                </p>
                <div className="flex gap-3 text-[10px] text-text-muted">
                  {incident.corridor && incident.corridor !== 'Non-corridor' && (
                    <span>📍 {incident.corridor}</span>
                  )}
                  {incident.zone && <span>🏢 {incident.zone}</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Brief Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!brief ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-navy-700 border-t-accent-400 animate-spin" />
              <p className="text-sm text-text-secondary animate-pulse">
                Generating operational brief...
              </p>
              <p className="text-xs text-text-muted">Analyzing incident patterns and context</p>
            </div>
          ) : (
            <>
              {/* Source badge */}
              <div className="flex items-center gap-2 mb-3">
                <Radio className="w-3 h-3 text-accent-400" />
                <span className="text-[10px] text-text-muted">
                  Source: {brief.source === 'claude' ? 'Claude AI (claude-sonnet-4-6)' : 'ASTRAM Template Engine'}
                </span>
              </div>

              {/* Recommendation text */}
              <div className="mission-brief">
                {brief.recommendation}
              </div>

              {/* Resource Recommendation */}
              {brief.resources && (
                <div className="mt-4 glass-panel-sm p-4 border-accent-400/20">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="w-4 h-4 text-accent-400" />
                    <h3 className="text-sm font-semibold text-text-primary">Resource Deployment</h3>
                  </div>
                  <p className="text-2xl font-bold text-accent-400 mb-1">
                    {brief.resources.total_officers} Officers
                  </p>
                  <ul className="space-y-1">
                    {brief.resources.positions?.map((pos, idx) => (
                      <li key={idx} className="text-xs text-text-secondary flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-400/60" />
                        {pos}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
