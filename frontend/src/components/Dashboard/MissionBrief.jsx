import React from 'react';
import { X, Shield, Radio, User, Clock, MapPin, Zap } from 'lucide-react';
import ECRSBadge from '../shared/ECRSBadge';

export default function MissionBrief({ incident, brief, onClose }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-md animate-fade-in p-4">
      <div className="w-full max-w-2xl glass-panel border-accent-400/40 shadow-2xl animate-slide-in-up max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-5 border-b border-glass-border shrink-0">
          <div className="w-12 h-12 rounded-lg gradient-accent flex items-center justify-center shrink-0">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-text-primary">ASTRAM Mission Brief</h2>
            <p className="text-sm text-text-muted mt-0.5">AI Operational Recommendation</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-navy-700 transition-colors">
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        {/* Incident Summary */}
        {incident && (
          <div className="px-6 py-4 border-b border-glass-border shrink-0">
            <div className="flex items-start gap-4">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-text-primary capitalize">
                    {incident.event_cause?.replace('_', ' ')}
                  </span>
                  <ECRSBadge score={incident.ecrs_score} size="sm" />
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded ${incident.priority === 'High' ? 'bg-risk-critical/20 text-risk-critical' : 'bg-risk-moderate/20 text-risk-moderate'}`}>
                    {incident.priority}
                  </span>
                </div>
                <p className="text-xs text-text-muted flex items-center gap-2">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  {incident.address?.substring(0, 100) || 'Unknown location'}
                </p>
                <div className="flex gap-4 text-xs text-text-muted">
                  {incident.corridor && incident.corridor !== 'Non-corridor' && (
                    <span className="flex items-center gap-1">📍 {incident.corridor}</span>
                  )}
                  {incident.zone && <span className="flex items-center gap-1">🏢 {incident.zone}</span>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Brief Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!brief ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="w-12 h-12 rounded-full border-2 border-navy-700 border-t-accent-400 animate-spin" />
              <p className="text-sm text-text-secondary animate-pulse font-medium">
                Generating operational brief...
              </p>
              <p className="text-xs text-text-muted">Analyzing incident patterns and context</p>
            </div>
          ) : (
            <>
              {/* Source badge */}
              <div className="flex items-center gap-2 mb-4">
                <Radio className="w-3 h-3 text-accent-400" />
                <span className="text-xs text-text-muted font-medium">
                  Source: {brief.source === 'claude' ? 'Claude AI (claude-sonnet-4-6)' : 'ASTRAM Template Engine'}
                </span>
              </div>

              {/* Recommendation text */}
              <div className="mission-brief mb-4">
                {brief.recommendation}
              </div>

              {/* Resource Recommendation */}
              {brief.resources && (
                <div className="glass-panel px-5 py-4 border-accent-400/20">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-4 h-4 text-accent-400" />
                    <h3 className="text-sm font-semibold text-text-primary">Resource Deployment</h3>
                  </div>
                  <p className="text-3xl font-bold text-accent-400 mb-2">
                    {brief.resources.total_officers} Officers
                  </p>
                  <ul className="space-y-2">
                    {brief.resources.positions?.map((pos, idx) => (
                      <li key={idx} className="text-sm text-text-secondary flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent-400" />
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
