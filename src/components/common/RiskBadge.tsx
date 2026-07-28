import React from 'react';
import type { NasalFeasibility, Af3Priority } from '../../types/screening';

// ─── Nasal Feasibility Badge ──────────────────────────────────────────────────

interface NasalFeasibilityBadgeProps {
  feasibility: NasalFeasibility;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const NASAL_STYLES: Record<NasalFeasibility, { label: string; className: string }> = {
  favorable:   { label: '비강 적합성 양호',     className: 'bg-cyan-950/60 text-cyan-300 border-cyan-700/60' },
  borderline:  { label: '비강 적합성 경계',     className: 'bg-yellow-950/60 text-yellow-300 border-yellow-700/60' },
  challenging: { label: '비강 적합성 불리',     className: 'bg-orange-950/60 text-orange-300 border-orange-700/60' },
  unresolved:  { label: '미평가',              className: 'bg-gray-800/60 text-gray-400 border-gray-700/60' },
};

export const NasalFeasibilityBadge: React.FC<NasalFeasibilityBadgeProps> = ({ feasibility, showLabel = true, size = 'sm' }) => {
  const { label, className } = NASAL_STYLES[feasibility];
  return (
    <span className={`inline-flex items-center rounded-md border font-medium ${
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
    } ${className}`}>
      {showLabel && label}
    </span>
  );
};

// ─── AF3 Priority Badge ───────────────────────────────────────────────────────

interface Af3PriorityBadgeProps {
  priority: Af3Priority;
  showLabel?: boolean;
  size?: 'sm' | 'md';
}

const PRIORITY_STYLES: Record<Af3Priority, { label: string; className: string }> = {
  priority:     { label: 'AF3 우선',      className: 'bg-violet-950/60 text-violet-300 border-violet-700/60' },
  review:       { label: 'AF3 검토',      className: 'bg-sky-950/60 text-sky-300 border-sky-700/60' },
  low_priority: { label: '낮은 우선순위',  className: 'bg-gray-800/60 text-gray-400 border-gray-700/60' },
};

export const Af3PriorityBadge: React.FC<Af3PriorityBadgeProps> = ({ priority, showLabel = true, size = 'sm' }) => {
  const { label, className } = PRIORITY_STYLES[priority];
  return (
    <span className={`inline-flex items-center rounded-md border font-medium ${
      size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
    } ${className}`}>
      {showLabel && label}
    </span>
  );
};
