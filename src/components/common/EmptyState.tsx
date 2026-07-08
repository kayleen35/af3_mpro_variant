import React from 'react';
import { FolderOpen, ArrowRight } from 'lucide-react';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = '아직 분석 결과가 없습니다',
  description = '단백질 서열 또는 변이 정보를 입력하여 새로운 구조 분석 및 억제제 결합 예측을 실행하세요.',
  icon,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`card-base p-10 flex flex-col items-center justify-center text-center border-dashed border-[#243047] bg-[#0b1020]/50 min-h-[280px] ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-[#141b2d] border border-[#243047] flex items-center justify-center mb-4 text-gray-500 shadow-inner">
        {icon || <FolderOpen className="w-7 h-7 stroke-[1.5] text-cyan-500/70" />}
      </div>

      <h3 className="text-lg font-bold text-gray-200 mb-1.5">{title}</h3>
      <p className="text-sm text-gray-400 max-w-md mb-6 leading-relaxed">{description}</p>

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white text-sm font-medium flex items-center gap-2 shadow-lg shadow-cyan-500/15 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
        >
          <span>{actionLabel}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default EmptyState;
