import React, { useState } from 'react';
import { Box, Layers, Eye, Shield, Sparkles, Sliders, Maximize2, Download } from 'lucide-react';

export interface StructureViewerPlaceholderProps {
  structureUrl?: string;
  inhibitorName?: string;
  onExportCommand?: () => void;
  className?: string;
}

interface ToolbarOption {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const toolbarOptions: ToolbarOption[] = [
  { id: 'protein', label: 'Protein (Ribbon)', icon: Layers },
  { id: 'ligand', label: 'Ligand (Stick)', icon: Shield },
  { id: 'active_site', label: 'Active Site (H41, C145)', icon: Eye },
  { id: 'h_bonds', label: 'H-Bonds', icon: Sparkles },
  { id: 'surface', label: 'Electrostatic Surface', icon: Box },
  { id: 'overlay', label: 'Overlay WT vs Mutant', icon: Sliders },
];

export const StructureViewerPlaceholder: React.FC<StructureViewerPlaceholderProps> = ({
  structureUrl,
  inhibitorName = 'Nirmatrelvir',
  onExportCommand,
  className = '',
}) => {
  const [activeToggles, setActiveToggles] = useState<Record<string, boolean>>({
    protein: true,
    ligand: true,
    active_site: true,
    h_bonds: false,
    surface: false,
    overlay: false,
  });

  const handleToggle = (id: string) => {
    setActiveToggles((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className={`card-base flex flex-col overflow-hidden bg-[#070b18]/90 border-[#243047] min-h-[520px] ${className}`}>
      {/* Viewer Toolbar */}
      <div className="p-3 border-b border-[#243047] bg-[#0b1020] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-gray-400 mr-2 uppercase tracking-wider font-mono">
            3D Display Modes:
          </span>
          {toolbarOptions.map((opt) => {
            const Icon = opt.icon;
            const isActive = !!activeToggles[opt.id];
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleToggle(opt.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all border ${
                  isActive
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-sm shadow-cyan-500/10'
                    : 'bg-[#141b2d] border-[#243047] text-gray-400 hover:text-gray-200 hover:border-gray-600'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-gray-500'}`} />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          {onExportCommand && (
            <button
              type="button"
              onClick={onExportCommand}
              title="ChimeraX 스크립트 명령어 내보내기 (준비중)"
              className="px-2.5 py-1 rounded-lg bg-[#141b2d] border border-[#243047] hover:border-violet-500/50 text-violet-300 text-xs font-medium flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ChimeraX Script</span>
            </button>
          )}
          <button
            type="button"
            title="전체 화면 보기"
            className="p-1.5 rounded-lg bg-[#141b2d] border border-[#243047] text-gray-400 hover:text-gray-200 transition-colors"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Viewer Canvas Area (Placeholder for Mol* / 3Dmol.js) */}
      <div className="flex-1 relative flex flex-col items-center justify-center p-8 text-center bg-gradient-to-b from-[#080c1a] via-[#050813] to-[#080c1a]">
        {/* Animated grid / 3D representation graphics */}
        <div className="relative w-40 h-40 mb-6 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border border-dashed border-cyan-500/20 animate-[spin_20s_linear_infinite]" />
          <div className="absolute inset-4 rounded-full border border-violet-500/20 animate-[spin_15s_linear_infinite_reverse]" />
          <div className="w-20 h-20 rounded-2xl bg-[#111827] border border-cyan-500/40 shadow-xl shadow-cyan-500/10 flex items-center justify-center transform rotate-12 hover:rotate-0 transition-transform duration-500">
            <Box className="w-10 h-10 text-cyan-400 animate-pulse" />
          </div>
        </div>

        <div className="max-w-md">
          <div className="inline-block px-3 py-1 rounded-full text-xs font-mono bg-cyan-950/60 border border-cyan-500/40 text-cyan-300 mb-3">
            Mpro-Variant Complex Viewer Ready
          </div>
          <h3 className="text-lg font-bold text-gray-100 mb-2">
            AlphaFold3 3D 구조 뷰어 영역 ({inhibitorName})
          </h3>
          <p className="text-xs text-gray-400 leading-relaxed font-mono">
            {structureUrl ? (
              <span className="text-emerald-400">
                구조 파일 로드 완료: {structureUrl} (Mol* / 3Dmol.js 렌더러 연결 대상)
              </span>
            ) : (
              <span>
                현재 뷰어는 Placeholder 상태입니다. 추후 로컬 Ubuntu AF3 서버에서 생성된
                mmCIF / PDB 파일을 Mol*, 3Dmol.js 또는 NGL Viewer 라이브러리로 마운트하여 실시간 렌더링합니다.
              </span>
            )}
          </p>
        </div>

        {/* Bottom active indicators overlay */}
        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between text-[11px] font-mono text-gray-500 border-t border-[#243047]/60 pt-3">
          <div className="flex items-center gap-3">
            <span>Target: SARS-CoV-2 Mpro Dimer</span>
            <span>&bull;</span>
            <span>Ligand: {inhibitorName}</span>
          </div>
          <div className="flex items-center gap-1.5 text-violet-400">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-ping" />
            <span>Research Quality Structure</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StructureViewerPlaceholder;
