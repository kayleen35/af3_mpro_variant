import React from 'react';
import { Beaker } from 'lucide-react';

export interface ResearchBadgeProps {
  className?: string;
}

export const ResearchBadge: React.FC<ResearchBadgeProps> = ({ className = '' }) => {
  return (
    <div
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-gradient-to-r from-violet-950/80 to-indigo-950/80 text-violet-300 border border-violet-500/40 shadow-sm shadow-violet-500/10 ${className}`}
      title="본 플랫폼은 임상/진단용이 아닌 연구용 구조 분석 도구입니다."
    >
      <Beaker className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
      <span>RESEARCH ONLY</span>
    </div>
  );
};

export default ResearchBadge;
