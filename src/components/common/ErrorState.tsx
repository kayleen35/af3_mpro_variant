import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = '분석 또는 통신 오류 발생',
  message = '로컬 Ubuntu AF3 서버 API 응답에 실패했거나 입력 서열 검증 중 문제가 감지되었습니다.',
  retryLabel = '다시 시도',
  onRetry,
  className = '',
}) => {
  return (
    <div
      className={`card-base p-8 flex flex-col items-center justify-center text-center border-rose-500/30 bg-[#0b1020] min-h-[260px] ${className}`}
    >
      <div className="w-14 h-14 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mb-4 text-rose-400 shadow-sm ">
        <AlertTriangle className="w-7 h-7 stroke-[1.75]" />
      </div>

      <h3 className="text-lg font-bold text-gray-100 mb-1.5">{title}</h3>
      <p className="text-sm text-rose-200/80 max-w-lg mb-6 leading-relaxed font-mono bg-rose-950/40 px-4 py-2 rounded-lg border border-rose-500/20">
        {message}
      </p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-5 py-2.5 rounded-xl bg-[#141b2d] border border-[#243047] hover:border-rose-500/50 hover:bg-rose-950/30 text-gray-200 text-sm font-medium flex items-center gap-2 transition-all shadow-sm"
        >
          <RefreshCw className="w-4 h-4 text-rose-400" />
          <span>{retryLabel}</span>
        </button>
      )}
    </div>
  );
};

export default ErrorState;
