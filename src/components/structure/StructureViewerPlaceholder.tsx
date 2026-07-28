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
  /** H-Bonds 토글 시 서버 수소결합 판정을 요청하기 위한 억제제 ID */
  inhibitorId?: string;
  onExportCommand?: () => void;
  className?: string;
}

/** 서버(structure_analysis.py)가 판정한 수소결합 1건 — 양 끝 원자 좌표 포함 */
interface HBondDetail {
  lig_atom: string;
  prot_resname: string;
  prot_resseq: number;
  prot_atom: string;
  distance: number;
  lig_xyz: [number, number, number];
  prot_xyz: [number, number, number];
}

interface ToolbarOption {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** 포켓 표면 반경 (Å) — ChimeraX `surface protein & ligand :< 8` 과 동일 기준 */
const POCKET_RADIUS = 8;
/** 표면 투명도 — ChimeraX `transparency #1 55 target s` (55% 투명 = opacity 0.45) */
const POCKET_TRANSPARENCY = 55;

const toolbarOptions: ToolbarOption[] = [
  { id: 'protein', label: 'Protein (Ribbon)', icon: Layers },
  { id: 'ligand', label: 'Ligand (Stick)', icon: Shield },
  { id: 'active_site', label: 'Active Site (H41, C145)', icon: Eye },
  { id: 'h_bonds', label: 'H-Bonds', icon: Sparkles },
  // 정전기 포텐셜을 계산하지 않으므로 'Electrostatic'이라 부르지 않는다 —
  // 실제로 그리는 것은 리간드 주변 8Å 잔기의 분자 표면.
  { id: 'surface', label: `Pocket Surface (≤ ${POCKET_RADIUS} Å)`, icon: Box },
];

export const StructureViewerPlaceholder: React.FC<StructureViewerPlaceholderProps> = ({
  structureUrl,
  inhibitorName = 'Nirmatrelvir',
  inhibitorId,
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

  // 수소결합은 임의로 그리지 않고 서버 판정(3.5Å 도너/억셉터 규칙)을 그대로 받아 쓴다.
  const [hbonds, setHbonds] = useState<HBondDetail[] | null>(null);
  const [hbondState, setHbondState] = useState<'idle' | 'loading' | 'error'>('idle');

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

  // 2-b. H-Bonds 토글을 켰을 때만 서버에 수소결합 판정을 요청한다(구조당 1회).
  useEffect(() => {
    if (!activeToggles.h_bonds || hbonds || hbondState === 'loading' || !structureUrl) return;

    setHbondState('loading');
    fetch('http://localhost:8000/api/structure/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filepath: structureUrl, inhibitorId }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        setHbonds(data?.hbonds?.details ?? []);
        setHbondState('idle');
      })
      .catch((err) => {
        console.error('H-bond 판정 실패:', err);
        setHbondState('error');
      });
  }, [activeToggles.h_bonds, hbonds, hbondState, structureUrl, inhibitorId]);

  // 구조가 바뀌면(억제제 전환 등) 이전 수소결합 결과는 버린다.
  useEffect(() => {
    setHbonds(null);
    setHbondState('idle');
  }, [structureUrl]);

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

      // 수소결합: 서버가 판정한 원자쌍을 점선 실린더로 잇고 거리를 라벨로 표시.
      if (activeToggles.h_bonds && hbonds?.length) {
        hbonds.forEach((hb) => {
          const [lx, ly, lz] = hb.lig_xyz;
          const [px, py, pz] = hb.prot_xyz;
          viewer.addCylinder({
            start: { x: lx, y: ly, z: lz },
            end: { x: px, y: py, z: pz },
            radius: 0.06,
            color: '#facc15',
            dashed: true,
            fromCap: 1,
            toCap: 1,
          });
          viewer.addLabel(`${hb.distance.toFixed(2)}Å`, {
            position: { x: (lx + px) / 2, y: (ly + py) / 2, z: (lz + pz) / 2 },
            fontSize: 10,
            fontColor: '#fde68a',
            backgroundColor: '#0b1020',
            backgroundOpacity: 0.75,
          });
        });

        // 결합에 참여하는 잔기는 stick으로 같이 보여줘야 어디에 붙는지 보인다.
        const resis = [...new Set(hbonds.map((h) => h.prot_resseq))];
        viewer.addStyle({ resi: resis }, { stick: { colorscheme: 'whiteCarbon', radius: 0.15 } });
      }

      // 포켓 표면 — ChimeraX의
      //   surface protein & ligand :< 8
      //   transparency #1 55 target s
      // 와 동등: 리간드(chain C) 기준 8Å 이내의 단백질 잔기만 표면으로, 55% 투명 처리.
      if (activeToggles.surface) {
        viewer.addSurface(
          window.$3Dmol.SurfaceType.VDW,
          { opacity: 1 - POCKET_TRANSPARENCY / 100, color: '#7fd4e3' },
          {
            chain: ['A', 'B'],
            within: { distance: POCKET_RADIUS, sel: { chain: 'C' } },
          }
        );
      }

      viewer.zoomTo();
      viewer.render();
    } catch (err) {
      console.error('3Dmol render error:', err);
    }
  }, [is3DmolReady, cifText, activeToggles, hbonds]);

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

  // 지금 켜져 있는 표시 옵션과 동등한 ChimeraX 명령을 그대로 노출한다 —
  // 사용자가 ChimeraX에서 같은 장면을 재현해 교차 검증할 수 있도록.
  const chimeraxCommands: string[] = [];
  if (activeToggles.surface) {
    chimeraxCommands.push(`surface protein & ligand :< ${POCKET_RADIUS}`);
    chimeraxCommands.push(`transparency #1 ${POCKET_TRANSPARENCY} target s`);
  }
  if (activeToggles.h_bonds) {
    chimeraxCommands.push('hbonds #1 & ligand restrict #1/A log true');
  }
  if (activeToggles.active_site) {
    chimeraxCommands.push('show #1:41,145 atoms');
  }

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
                {opt.id === 'h_bonds' && isActive && (
                  <span className="font-mono text-[11px] text-amber-300">
                    {hbondState === 'loading'
                      ? '판정 중…'
                      : hbondState === 'error'
                      ? '판정 실패'
                      : hbonds
                      ? `${hbonds.length}개`
                      : ''}
                  </span>
                )}
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
        <div className="absolute top-4 left-4 z-10 pointer-events-none space-y-2">
          <div className="inline-block px-3 py-1 rounded-full text-xs font-mono bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 shadow-lg">
            3Dmol.js WebGL Engine (AlphaFold 3 Dimer Mode)
          </div>

          {/* 현재 화면과 동등한 ChimeraX 명령 — 외부 검증용 */}
          {chimeraxCommands.length > 0 && (
            <div className="block px-3 py-2 rounded-lg bg-[#0b1020]/85 border border-[#243047] shadow-lg backdrop-blur-md">
              <div className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                ChimeraX 동등 명령어
              </div>
              {chimeraxCommands.map((cmd) => (
                <div key={cmd} className="text-[11px] font-mono text-emerald-300 leading-relaxed">
                  {cmd}
                </div>
              ))}
            </div>
          )}
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
