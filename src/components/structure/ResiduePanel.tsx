import React from 'react';
import { Target, Zap, ShieldAlert, Activity } from 'lucide-react';
import { RESIDUE_PANEL_GROUPS } from '../../utils/constants';
import type { BindingMetrics, MutationItem } from '../../types/analysis';

export interface ResiduePanelProps {
  metrics?: BindingMetrics;
  mutations?: MutationItem[];
  selectedInhibitorName?: string;
  className?: string;
}

export const ResiduePanel: React.FC<ResiduePanelProps> = ({
  metrics,
  mutations = [],
  selectedInhibitorName = '선택된 억제제',
  className = '',
}) => {
  // 감지된 변이 잔기 번호 목록
  const mutantPositions = new Set(mutations.map((m) => m.position));

  return (
    <div className={`card-base bg-[#0b1020] border-[#243047] p-4 flex flex-col h-full overflow-y-auto space-y-5 ${className}`}>
      {/* Header */}
      <div className="border-b border-[#243047] pb-3.5">
        <div className="flex items-center gap-2 mb-1">
          <Target className="w-4 h-4 text-cyan-400" />
          <h3 className="font-bold text-sm text-gray-100">Mpro 활성 부위 잔기 분석</h3>
        </div>
        <p className="text-[14px] text-gray-400 leading-normal">
          SARS-CoV-2 Mpro 활성 포켓({selectedInhibitorName}) 상호작용 및 변이 발생 지점 매핑
        </p>
      </div>

      {/* Binding Metrics Section (API 결과가 있을 때만 표시, 없으면 안내 문구) */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5 font-mono">
          <Zap className="w-3.5 h-3.5 text-violet-400" />
          <span>결합 지표 (API 예측 결과)</span>
        </div>

        {metrics ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-lg bg-[#141b2d] border border-[#243047]">
              <span className="text-gray-400 block text-[14px] font-mono">Cys145 Proximity</span>
              <span className="font-mono font-bold text-cyan-300 text-sm">
                {typeof metrics.cys145Distance === 'number'
                  ? `${metrics.cys145Distance.toFixed(2)} Å`
                  : '측정치 없음'}
              </span>
            </div>
            <div className="p-2.5 rounded-lg bg-[#141b2d] border border-[#243047]">
              <span className="text-gray-400 block text-[14px] font-mono">H-Bond Network</span>
              <span className="font-mono font-bold text-violet-300 text-sm">
                {typeof metrics.hBondCount === 'number'
                  ? `${metrics.hBondCount} 개`
                  : '분석 중'}
              </span>
            </div>
            {metrics.a166f167Interaction && (
              <div className="col-span-2 p-2.5 rounded-lg bg-[#141b2d] border border-[#243047]">
                <span className="text-gray-400 block text-[14px] font-mono">E166/F167 Interaction</span>
                <span className="text-gray-200 font-medium">{metrics.a166f167Interaction}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-[#141b2d]/60 border border-dashed border-[#243047] text-center text-xs text-gray-500 font-mono">
            아직 연산된 결합 지표가 없습니다. 복합체 예측 완료 시 자동 표시됩니다.
          </div>
        )}
      </div>

      {/* Residue Groups List */}
      <div className="space-y-4 flex-1">
        <div className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5 font-mono">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span>핵심 잔기 그룹</span>
        </div>

        <div className="space-y-3">
          {RESIDUE_PANEL_GROUPS.map((group) => (
            <div key={group.groupName} className="p-3 rounded-xl bg-[#111827] border border-[#243047]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-xs text-gray-200">{group.groupName}</span>
                <span className="text-[14px] font-mono text-gray-500">{group.residues.length} AA</span>
              </div>
              <p className="text-[14px] text-gray-400 mb-2 leading-relaxed">{group.description}</p>

              <div className="flex flex-wrap gap-1.5">
                {group.residues.map((resLabel) => {
                  // 잔기 문자열에서 번호 추출 (예: C145 -> 145, L50/F50 -> 50)
                  const match = resLabel.match(/\d+/);
                  const pos = match ? parseInt(match[0], 10) : -1;
                  const isMutant = mutantPositions.has(pos);

                  return (
                    <span
                      key={resLabel}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[14px] font-mono font-medium border ${
                        isMutant
                          ? 'bg-rose-950/80 text-rose-300 border-rose-500/60 shadow-sm shadow-rose-500/20'
                          : 'bg-[#141b2d] text-cyan-300 border-[#243047]'
                      }`}
                    >
                      {isMutant && <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0 animate-pulse" />}
                      <span>{resLabel}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ResiduePanel;
