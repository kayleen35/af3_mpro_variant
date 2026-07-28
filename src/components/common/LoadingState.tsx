import React from 'react';
import { Loader2, Cpu } from 'lucide-react';

export interface LoadingStateProps {
  title?: string;
  description?: string;
  step?: string;
  progress?: number;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  title = '분석 진행 중입니다',
  description = '로컬 Ubuntu AlphaFold3 서버에서 3D 구조 생성 및 결합 예측을 연산하고 있습니다.',
  step,
  progress,
  className = '',
}) => {
  return (
    <div
      className={`card-base p-10 flex flex-col items-center justify-center text-center bg-[#0b1020]/80 border-[#243047] min-h-[300px] ${className}`}
    >
      <div className="relative mb-6">
        {/* Outer glowing animated ring */}
        <div className="w-16 h-16 rounded-full border-4 border-cyan-500/20 border-t-cyan-400 animate-spin flex items-center justify-center shadow-lg shadow-cyan-500/10" />
        <div className="absolute inset-0 flex items-center justify-center text-violet-400">
          <Cpu className="w-6 h-6 animate-pulse" />
        </div>
      </div>

      <h3 className="text-lg font-bold text-gray-100 mb-1.5 flex items-center gap-2">
        <span>{title}</span>
        <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
      </h3>
      <p className="text-sm text-gray-400 max-w-md mb-6 leading-relaxed">{description}</p>

      {step && (
        <div className="w-full max-w-xs px-4 py-2.5 rounded-xl bg-[#141b2d] border border-[#243047] mb-4">
          <div className="text-xs font-mono text-cyan-300 font-medium tracking-wide">
            현재 단계: {step}
          </div>
        </div>
      )}

      {typeof progress === 'number' && (
        <div className="w-full max-w-xs space-y-2">
          <div className="w-full h-2 rounded-full bg-[#141b2d] overflow-hidden border border-[#243047]">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
          <div className="flex justify-between text-[13px] font-mono text-gray-400">
            <span>진행률</span>
            <span className="text-cyan-400 font-semibold">{Math.round(progress)}%</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoadingState;
