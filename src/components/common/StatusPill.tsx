import React from 'react';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';

export type StatusType =
  | 'idle'
  | 'pending'
  | 'validating'
  | 'mutation_analyzing'
  | 'structure_generating'
  | 'complex_predicting'
  | 'interaction_analyzing'
  | 'running'
  | 'completed'
  | 'failed';

export interface StatusPillProps {
  status: StatusType | string;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'completed':
      return {
        text: '완료',
        color: 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 shadow-emerald-500/10',
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
      };
    case 'failed':
      return {
        text: '실패 / 오류',
        color: 'bg-rose-950/60 text-rose-300 border-rose-500/40 shadow-rose-500/10',
        icon: <XCircle className="w-3.5 h-3.5 text-rose-400" />,
      };
    case 'running':
    case 'validating':
    case 'mutation_analyzing':
    case 'structure_generating':
    case 'complex_predicting':
    case 'interaction_analyzing':
      const runningLabelMap: Record<string, string> = {
        running: '예측 연산 중...',
        validating: '서열 검증 중...',
        mutation_analyzing: '변이 분석 중...',
        structure_generating: '3D 구조 생성 중...',
        complex_predicting: '복합체 예측 중...',
        interaction_analyzing: '상호작용 연산 중...',
      };
      return {
        text: runningLabelMap[status] || '진행 중...',
        color: 'bg-cyan-950/60 text-cyan-300 border-cyan-500/40 shadow-cyan-500/10',
        icon: <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />,
      };
    case 'idle':
    case 'pending':
    default:
      return {
        text: status === 'pending' ? '대기' : '대기 중',
        color: 'bg-[#141b2d] text-gray-400 border-[#243047]',
        icon: <Clock className="w-3.5 h-3.5 text-gray-500" />,
      };
  }
};

export const StatusPill: React.FC<StatusPillProps> = ({
  status,
  label,
  size = 'md',
  className = '',
}) => {
  const config = getStatusConfig(status);
  const displayLabel = label || config.text;

  const sizeStyles =
    size === 'sm' ? 'px-2 py-0.5 text-[11px] gap-1' : 'px-3 py-1 text-xs gap-1.5';

  return (
    <span
      className={`inline-flex items-center rounded-full font-mono font-medium border shadow-sm transition-all ${sizeStyles} ${config.color} ${className}`}
    >
      {config.icon}
      <span>{displayLabel}</span>
    </span>
  );
};

export default StatusPill;
