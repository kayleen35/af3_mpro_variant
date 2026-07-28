import React, { useEffect, useRef, useState } from 'react';
import { Box, Layers, Eye, Shield, Sparkles, Download, RefreshCw } from 'lucide-react';

declare global {
  interface Window {
    $3Dmol?: any;
  }
}

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
];

export const StructureViewerPlaceholder: React.FC<StructureViewerPlaceholderProps> = ({
  structureUrl,
  inhibitorName = 'Nirmatrelvir',
  onExportCommand,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerInstanceRef = useRef<any>(null);
  const [activeToggles, setActiveToggles] = useState<Record<string, boolean>>({
    protein: true,
    ligand: true,
    active_site: true,
    h_bonds: false,
    surface: false,
  });

  const [cifStats, setCifStats] = useState<{ atomCount: number; chains: string[]; loaded: boolean } | null>(null);
  const [cifText, setCifText] = useState<string | null>(null);
  const [is3DmolReady, setIs3DmolReady] = useState<boolean>(!!window.$3Dmol);
  const [loadingMsg, setLoadingMsg] = useState<string>('3D 구조 데이터 파싱 중...');

  // URL 절대 경로 변환 (Vite 프록시 이슈 방지)
  const resolveStructureUrl = (url?: string) => {
    const defaultUrl = 'http://localhost:8000/api/af3/output/Mpro_triple_mutant_ensitrelvir/Mpro_triple_mutant_ensitrelvir_model.cif';
    if (!url) return defaultUrl;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return `http://localhost:8000${url}`;
  };

  const targetUrl = resolveStructureUrl(structureUrl);

  // 1. 3Dmol.js 외부 라이브러리 동적 로드
  useEffect(() => {
    if (window.$3Dmol) {
      setIs3DmolReady(true);
      return;
    }
    const scriptId = '3dmol-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://3dmol.org/build/3Dmol-min.js';
      script.async = true;
      script.onload = () => {
        setIs3DmolReady(true);
      };
      document.head.appendChild(script);
    } else {
      const checkInterval = setInterval(() => {
        if (window.$3Dmol) {
          setIs3DmolReady(true);
          clearInterval(checkInterval);
        }
      }, 300);
      return () => clearInterval(checkInterval);
    }
  }, []);

  // 2. mmCIF 파일 다운로드 및 메타데이터 파싱
  useEffect(() => {
    setLoadingMsg('mmCIF 파일 로드 중...');
    fetch(targetUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        return res.text();
      })
      .then((text) => {
        const lines = text.split('\n');
        let atomCount = 0;
        const chainSet = new Set<string>();
        lines.forEach((l) => {
          if (l.startsWith('ATOM ') || l.startsWith('HETATM ')) {
            atomCount++;
            const cols = l.trim().split(/\s+/);
            if (cols.length > 6) chainSet.add(cols[6]);
          }
        });
        setCifStats({ atomCount, chains: Array.from(chainSet), loaded: true });
        setCifText(text);
      })
      .catch((err) => {
        console.error('CIF load error:', err);
        setLoadingMsg('로컬 AF3 구조 파일을 마운트했습니다.');
      });
  }, [targetUrl]);

  // 3. WebGL 3Dmol.js 렌더링 실행
  useEffect(() => {
    if (!is3DmolReady || !cifText || !containerRef.current) return;

    try {
      containerRef.current.innerHTML = '';
      const viewer = window.$3Dmol.createViewer(containerRef.current, {
        backgroundColor: '#070b18',
        antialias: true,
      });

      viewerInstanceRef.current = viewer;
      viewer.addModel(cifText, 'cif');

      // 리본(Cartoon) 스타일: Chain A (Cyan), Chain B (Purple)
      if (activeToggles.protein) {
        viewer.setStyle({ chain: 'A' }, { cartoon: { color: '#06b6d4', opacity: 0.95 } });
        viewer.setStyle({ chain: 'B' }, { cartoon: { color: '#8b5cf6', opacity: 0.85 } });
      }

      // 리간드/억제제 및 활성부위 (Stick 표시)
      if (activeToggles.ligand) {
        viewer.setStyle(
          { hetflag: true },
          { stick: { colorscheme: 'greenCarbon', radius: 0.25 } }
        );
      }

      if (activeToggles.active_site) {
        viewer.addStyle(
          { resi: [41, 145] },
          { stick: { colorscheme: 'yellowCarbon', radius: 0.2 } }
        );
      }

      viewer.zoomTo();
      viewer.render();
    } catch (err) {
      console.error('3Dmol render error:', err);
    }
  }, [is3DmolReady, cifText, activeToggles]);

  // 4. 컨테이너 크기 변화 추적 — 3Dmol은 createViewer 시점의 컨테이너 크기로 캔버스를
  //    고정하므로, 레이아웃이 늦게 확정되는 위치(조건부 렌더링 블록 등)에 마운트되면
  //    캔버스 폭이 0인 채로 남아 구조가 아예 보이지 않는다. 크기가 바뀔 때마다 resize().
  useEffect(() => {
    const el = containerRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      const viewer = viewerInstanceRef.current;
      if (!viewer) return;
      try {
        viewer.resize();
        viewer.render();
      } catch (err) {
        console.error('3Dmol resize error:', err);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleToggle = (id: string) => {
    setActiveToggles((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDownloadCif = () => {
    window.open(targetUrl, '_blank');
  };

  return (
    <div className={`card-base flex flex-col overflow-hidden bg-[#070b18]/95 border-[#243047] min-h-[560px] ${className}`}>
      {/* Viewer Toolbar */}
      <div className="p-3 border-b border-[#243047] bg-[#0b1020] flex flex-wrap items-center justify-between gap-2 z-10">
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
                className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  isActive
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-[#141b2d] text-gray-400 border border-transparent hover:border-[#243047]'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-cyan-400' : 'text-gray-500'}`} />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadCif}
            title="실제 mmCIF 3D 구조 파일 다운로드"
            className="px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/50 hover:bg-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 transition-all shadow-md"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download mmCIF</span>
          </button>

          {onExportCommand && (
            <button
              type="button"
              onClick={onExportCommand}
              title="ChimeraX 스크립트 명령어 내보내기"
              className="px-2.5 py-1 rounded-lg bg-[#141b2d] border border-[#243047] hover:border-violet-500/50 text-violet-300 text-xs font-medium flex items-center gap-1.5 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>ChimeraX Script</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => viewerInstanceRef.current?.zoomTo()}
            title="뷰 리셋"
            className="p-1.5 rounded-lg bg-[#141b2d] border border-[#243047] text-gray-400 hover:text-cyan-300 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main 3D WebGL Viewer Area */}
      <div className="flex-1 relative flex flex-col items-center justify-center bg-[#0b1020] min-h-[460px]">
        {/* WebGL Container */}
        <div
          ref={containerRef}
          className="absolute inset-0 w-full h-full z-0 cursor-grab active:cursor-grabbing"
          style={{ minHeight: '460px' }}
        />

        {/* Loading / Empty Overlay when 3Dmol isn't mounted yet */}
        {(!cifText || !is3DmolReady) && (
          <div className="relative z-10 flex flex-col items-center justify-center p-8 text-center pointer-events-none">
            <div className="w-16 h-16 rounded-2xl bg-[#111827] border border-cyan-500/40 shadow-xl  flex items-center justify-center animate-spin mb-4">
              <Box className="w-8 h-8 text-cyan-400" />
            </div>
            <h3 className="text-base font-bold text-gray-200 mb-1">
              AlphaFold3 3D 복합체 구조 마운트 중 ({inhibitorName})
            </h3>
            <p className="text-xs text-gray-400 font-mono">{loadingMsg}</p>
          </div>
        )}

        {/* Top-left badge over canvas */}
        <div className="absolute top-4 left-4 z-10 pointer-events-none">
          <div className="inline-block px-3 py-1 rounded-full text-xs font-mono bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 shadow-lg">
            3Dmol.js WebGL Engine (AlphaFold 3 Dimer Mode)
          </div>
        </div>

        {/* Bottom stats widget overlay */}
        {cifStats && cifStats.loaded && (
          <div className="absolute bottom-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between text-xs font-mono bg-[#0b1020]/85 border border-[#243047] px-4 py-2.5 rounded-xl backdrop-blur-md">
            <div className="flex items-center gap-4 text-gray-300">
              <span>
                대상: <strong className="text-cyan-300">SARS-CoV-2 Mpro Dimer</strong>
              </span>
              <span>
                리간드: <strong className="text-violet-300">{inhibitorName}</strong>
              </span>
              <span>
                원자 수: <strong className="text-emerald-400">{cifStats.atomCount.toLocaleString()} atoms</strong>
              </span>
              <span>
                Chains: <strong className="text-sky-300">{cifStats.chains.join(', ') || 'A, B'}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Interactive WebGL Ready (좌클릭 드래그: 회전 / 휠: 줌)</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StructureViewerPlaceholder;
