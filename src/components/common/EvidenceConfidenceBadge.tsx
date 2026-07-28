import React from 'react';
import type { EvidenceConfidence } from '../../types/screening';

interface EvidenceConfidenceBadgeProps {
  confidence: EvidenceConfidence;
  showDesc?: boolean;
  size?: 'sm' | 'md';
}

const CONFIDENCE_STYLES: Record<EvidenceConfidence, { label: string; desc: string; className: string }> = {
  A: { label: 'A', desc: '고품질 실험 근거',     className: 'bg-emerald-950/60 text-emerald-300 border-emerald-600/60 ring-emerald-500/30' },
  B: { label: 'B', desc: '복수 모델 일치',       className: 'bg-cyan-950/60 text-cyan-300 border-cyan-600/60 ring-cyan-500/30' },
  C: { label: 'C', desc: '단일 모델 예측',       className: 'bg-sky-950/60 text-sky-300 border-sky-600/60 ring-sky-500/30' },
  D: { label: 'D', desc: '계산 불확실',          className: 'bg-amber-950/60 text-amber-300 border-amber-600/60 ring-amber-500/30' },
  E: { label: 'E', desc: '근거 불충분/미평가',   className: 'bg-gray-800/60 text-gray-400 border-gray-700/60 ring-gray-600/30' },
};

export const EvidenceConfidenceBadge: React.FC<EvidenceConfidenceBadgeProps> = ({
  confidence, showDesc = false, size = 'sm',
}) => {
  const { label, desc, className } = CONFIDENCE_STYLES[confidence];
  return (
    <span
      title={desc}
      className={`inline-flex items-center gap-1 rounded-md border font-bold ring-1 transition-all ${
        size === 'sm' ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-1 text-xs'
      } ${className}`}
    >
      {label}
      {showDesc && <span className="font-normal text-[10px] opacity-80">{desc}</span>}
    </span>
  );
};

export default EvidenceConfidenceBadge;
