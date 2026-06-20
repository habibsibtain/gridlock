import React from 'react';

const ECRS_CONFIG = {
  low: { min: 0, max: 3, label: 'Low Risk', className: 'ecrs-low', color: '#22c55e' },
  moderate: { min: 3.1, max: 5, label: 'Moderate', className: 'ecrs-moderate', color: '#eab308' },
  high: { min: 5.1, max: 7, label: 'High', className: 'ecrs-high', color: '#f97316' },
  critical: { min: 7.1, max: 9, label: 'Critical', className: 'ecrs-critical', color: '#ef4444' },
  extreme: { min: 9.1, max: 10, label: 'Extreme', className: 'ecrs-extreme', color: '#dc2626' },
};

function getEcrsLevel(score) {
  if (score <= 3) return ECRS_CONFIG.low;
  if (score <= 5) return ECRS_CONFIG.moderate;
  if (score <= 7) return ECRS_CONFIG.high;
  if (score <= 9) return ECRS_CONFIG.critical;
  return ECRS_CONFIG.extreme;
}

export default function ECRSBadge({ score, showLabel = true, size = 'md' }) {
  const level = getEcrsLevel(score || 0);
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-1',
    md: 'text-sm px-3 py-1.5',
    lg: 'text-base px-4 py-2',
  };
  
  return (
    <span
      className={`ecrs-badge ${level.className} ${sizeClasses[size] || sizeClasses.md}`}
      title={`ECRS: ${score}/10 — ${level.label}`}
    >
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{score?.toFixed?.(1) || '0.0'}</span>
      {showLabel && <span className="ml-2 opacity-80">{level.label}</span>}
    </span>
  );
}

export { getEcrsLevel, ECRS_CONFIG };
