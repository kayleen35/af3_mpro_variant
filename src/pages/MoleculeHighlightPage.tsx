import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { FlaskConical, Atom, AlertCircle, ChevronLeft, ArrowRight, Info, Zap } from 'lucide-react';
import { INITIAL_INHIBITORS } from '../types/inhibitor';
import { getAnalysisJob, getMoleculeHighlight, getMoleculeHighlightDiff, getMoleculeHighlightPlain } from '../api/analysisApi';
import client from '../api/client';

const REGION_LABELS: Record<string, string> = {
  warhead: 'Warhead (Cys145 공유결합)',
  p1: 'P1 pocket (S1 anchor)',
  p2: 'P2 pocket',
};

const DIFF_QUALITY_LABELS: Record<string, string> = {
  lost: '결합 소실',
  weakened: '결합 약화',
  improved: '결합 개선',
  unchanged: '변화 없음',
};

// 구조 분석 결과 타입 (InteractionComparisonPage와 동일)
interface StructureAnalysisResult {
  inhibitorId?: string;
  variant?: string;
  plddt?: { avg: number; min: number; max: number };
  contacts?: { total: number; anchorResidues: Record<string, { label: string; count: number; details: any[] }> };
  hbonds?: { count: number; details: any[] };
  buriedArea?: { buried_A2: number; ligand_A2: number; percent: number };
  [key: string]: any;
}

type SmilesToken = { text: string; region: string | null; quality: string | null; color: string | null; isProblem?: boolean };

// ──────────────────────────────────────────────────────────────
// 타입
// ──────────────────────────────────────────────────────────────
interface PanelData {
  label: string;
  jobId: string;
  accentClass: string;
  analysis: StructureAnalysisResult | null;
  svg: string | null;
  legend: { color: string; label: string }[];
  regionQuality: Record<string, { quality: string; color: string; label: string; atomCount: number }> | null;
  smilesTokens: SmilesToken[] | null;
  canonicalSmiles: string;
  loading: boolean;
  error: string | null;
}

interface DiffOverride {
  svg: string;
  regionDiff: Record<string, { quality: string; color: string | null; reason: string }>;
  smilesTokens: SmilesToken[];
  canonicalSmiles: string;
  legend: { color: string; label: string }[];
}

const QUALITY_LABELS: Record<string, string> = {
  hbond:   'H-bond 결합',
  contact: 'VdW 접촉',
  weak:    '약한 접촉',
  poor:    '접촉 없음',
  unknown: '파악 불가',
};

interface RegionEntry {
  key: string;
  label: string;
  color: string;
  badgeText: string;
  extra?: string;
}

// ──────────────────────────────────────────────────────────────
// SVG 패널 + 파르마코포어 영역 테이블 + SMILES 하이라이트
// WT 패널은 자체 절대 분석 결과를, Mutant 패널은 diffOverride가 준비되면
// "WT 대비 변화"만 표시한다(diffOverride 없으면 로딩 표시).
// ──────────────────────────────────────────────────────────────
function MolPanel({ data, diffOverride, diffPending, plainSvg }: {
  data: PanelData;
  diffOverride?: DiffOverride | null;
  diffPending?: boolean;
  plainSvg?: string | null;
}) {
  const { label, accentClass, analysis, loading, error } = data;

  const usingDiff = !!diffOverride;
  // plainSvg가 있으면(WT) 하이라이트 없는 깨끗한 구조/SMILES를 보여준다 —
  // 하이라이트는 변이와 비교할 대상이 있을 때만 의미가 있어서 WT엔 표시하지 않는다.
  const isPlainPanel = plainSvg !== undefined;
  const currentSvg = isPlainPanel ? plainSvg : (usingDiff ? diffOverride!.svg : data.svg);
  const smilesTokens = isPlainPanel ? null : (usingDiff ? diffOverride!.smilesTokens : data.smilesTokens);
  const canonicalSmiles = usingDiff ? diffOverride!.canonicalSmiles : data.canonicalSmiles;

  const regionEntries: RegionEntry[] = usingDiff
    ? Object.entries(diffOverride!.regionDiff).map(([key, info]) => ({
        key,
        label: REGION_LABELS[key] ?? key,
        color: info.color ?? '#3f4a5e',
        badgeText: DIFF_QUALITY_LABELS[info.quality] ?? info.quality,
        extra: info.reason,
      }))
    : data.regionQuality
      ? Object.entries(data.regionQuality).map(([key, rq]) => ({
          key,
          label: rq.label,
          color: rq.color,
          badgeText: QUALITY_LABELS[rq.quality] ?? rq.quality,
          extra: rq.atomCount > 0 ? `${rq.atomCount}원자` : undefined,
        }))
      : [];

  const showDiagramSection = usingDiff || !diffPending;

  return (
    <div className="flex-1 min-w-0 space-y-4">
      {/* 헤더 */}
      <div className={`rounded-xl p-4 border ${accentClass}`}>
        <div className="flex items-center gap-2">
          <Atom className="w-5 h-5" />
          <h3 className="font-bold text-lg">{label}</h3>
        </div>
        {analysis && (
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-gray-300">
            <span>접촉수: <strong className="text-white">{analysis.contacts?.total ?? '–'}</strong></span>
            <span>H-bond: <strong className="text-white">{analysis.hbonds?.count ?? '–'}</strong></span>
            <span>매몰: <strong className="text-white">{typeof analysis.buriedArea?.percent === 'number' ? analysis.buriedArea.percent.toFixed(1) : '–'}%</strong></span>
            <span>pLDDT: <strong className="text-white">{typeof analysis.plddt?.avg === 'number' ? analysis.plddt.avg.toFixed(1) : '–'}</strong></span>
          </div>
        )}
      </div>

      {/* SVG 뷰어 */}
      <div className="card-base min-h-[360px] flex items-center justify-center bg-[#060d1a] overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <span className="w-8 h-8 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
            <span className="text-sm">RDKit으로 분자 구조 생성 중...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 text-red-400 max-w-sm text-center p-6">
            <AlertCircle className="w-8 h-8" />
            <span className="text-xs break-all">{error}</span>
          </div>
        ) : plainSvg === null ? (
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <span className="w-8 h-8 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
            <span className="text-sm">구조 생성 중...</span>
          </div>
        ) : !showDiagramSection ? (
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <span className="w-8 h-8 rounded-full border-2 border-violet-500/30 border-t-violet-500 animate-spin" />
            <span className="text-sm">WT 대비 변화 계산 중...</span>
          </div>
        ) : currentSvg ? (
          <div className="w-full [&>svg]:w-full [&>svg]:h-auto" dangerouslySetInnerHTML={{ __html: currentSvg }} style={{ lineHeight: 0 }} />
        ) : (
          <div className="text-gray-600 text-sm text-center">
            <FlaskConical className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <span>분석 결과 없음</span>
          </div>
        )}
      </div>

      {/* 파르마코포어 영역별 결합력 */}
      {showDiagramSection && regionEntries.length > 0 && !loading && !error && (
        <div className="card-base p-4 bg-[#0b1020]">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            {usingDiff ? '포켓별 WT → Mutant 변화' : '파르마코포어 영역별 결합력'}
          </p>
          <div className="space-y-2">
            {regionEntries.map((rq) => (
              <div
                key={rq.key}
                className={`py-2 border-b border-[#1e2d40] last:border-0 gap-1.5 ${
                  // usingDiff의 값(예: "Glu166 (S1 anchor) → Ala166 (S1 anchor):")은 길이가
                  // 길어 한 행에 라벨과 나란히 두면(shrink-0) 폰트가 커질 때 라벨이 0px로
                  // 밀려난다 — 이 경우만 라벨/값을 위아래로 쌓는다.
                  usingDiff ? 'flex flex-col' : 'flex items-center justify-between'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: rq.color }} />
                  <span className="text-xs text-gray-300 truncate">{rq.label}</span>
                  {rq.extra && !usingDiff && (
                    <span className="text-xs text-gray-600 shrink-0">({rq.extra})</span>
                  )}
                </div>
                {usingDiff ? (
                  <span className="text-xs font-mono pl-4" style={{ color: rq.color }}>{rq.extra}</span>
                ) : (
                  <span
                    className="text-xs font-bold px-2.5 py-0.5 rounded-full shrink-0"
                    style={{ background: rq.color + '22', color: rq.color, border: `1px solid ${rq.color}55` }}
                  >
                    {rq.badgeText}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SMILES 서열 + 파르마코포어 태그 하이라이트 */}
      {showDiagramSection && canonicalSmiles && !loading && regionEntries.length > 0 && (
        <div className="card-base p-4 bg-[#0b1020]">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">SMILES 서열 하이라이트 분석</p>
          <div className="rounded-lg bg-[#060d1a] p-3 border border-[#1e2d40]">
            <div className="text-xs font-mono break-all leading-relaxed flex flex-wrap items-center gap-0.5">
              {smilesTokens && smilesTokens.length > 0 ? (
                smilesTokens.map((tok, i) => (
                  <span
                    key={i}
                    style={{
                      backgroundColor: tok.color ? tok.color + '22' : 'transparent',
                      color: tok.color ? tok.color : '#cbd5e1',
                      border: tok.color ? `1px solid ${tok.color}55` : 'none',
                      padding: tok.color ? '1px 3.5px' : '0 1px',
                      borderRadius: tok.color ? '4px' : '0',
                      fontWeight: tok.color ? 700 : 400,
                    }}
                    title={tok.region ? `${REGION_LABELS[tok.region] ?? tok.region}${tok.quality ? ` (${usingDiff ? DIFF_QUALITY_LABELS[tok.quality] ?? tok.quality : QUALITY_LABELS[tok.quality] ?? tok.quality})` : ''}` : undefined}
                  >
                    {tok.text}
                  </span>
                ))
              ) : (
                <span className="text-gray-300">{canonicalSmiles}</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 잔기별 접촉 */}
      {analysis && (
        <div className="card-base p-4 space-y-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">잔기별 접촉</p>
          {Object.entries(analysis.contacts?.anchorResidues ?? {}).map(([res, info]: [string, any]) => (
            <div key={res} className="flex items-center justify-between py-1 border-b border-[#1e2d40] last:border-0">
              <span className="text-xs text-gray-300 font-mono">{info.label ?? `Res ${res}`}</span>
              <span className="text-xs font-bold text-cyan-400">{info.count}개</span>
            </div>
          ))}
          {Object.keys(analysis.contacts?.anchorResidues ?? {}).length === 0 && (
            <p className="text-xs text-gray-600">주요 잔기 접촉 없음</p>
          )}
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// 메인 페이지
// ──────────────────────────────────────────────────────────────
export const MoleculeHighlightPage: React.FC = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  const mutJobId     = params.get('mutJobId') || '';
  const wtJobId      = params.get('wtJobId') || '';
  const inhibitorId  = params.get('inhibitorId') || '';

  const inhibitor = INITIAL_INHIBITORS.find(i => i.id === inhibitorId);
  const smiles    = inhibitor?.smiles ?? '';

  const [diffResult, setDiffResult] = useState<DiffOverride | null>(null);
  const [diffError, setDiffError] = useState<string | null>(null);

  // 2D 구조 이미지는 WT/Mutant 둘 다 하이라이트 없이 깨끗하게 표시한다 —
  // 색 정보(무엇이 얼마나 바뀌었는지)는 아래 텍스트 섹션(포켓별 변화, 잔기별 접촉,
  // SMILES 하이라이트)에서 계속 보여주고, 상단 분자 그림 자체는 항상 동일하게 둔다.
  // WT/Mutant 리간드 SMILES가 같으므로 하나만 계산해 양쪽 패널에 재사용한다.
  const [plainSvg, setPlainSvg] = useState<string | null>(null);
  useEffect(() => {
    if (!smiles) return;
    let cancelled = false;
    getMoleculeHighlightPlain(smiles).then((res) => {
      if (!cancelled && res.success && res.svg) setPlainSvg(res.svg);
    }).catch(() => { /* 실패 시 기존 하이라이트로 자연 대체 */ });
    return () => { cancelled = true; };
  }, [smiles]);

  const [mutPanel, setMutPanel] = useState<PanelData>({
    label: '변이형 (Mutant)', jobId: mutJobId,
    accentClass: 'border-cyan-700/60 bg-cyan-950/20 text-cyan-300',
    analysis: null, svg: null, legend: [], regionQuality: null, smilesTokens: null, canonicalSmiles: '',
    loading: false, error: null,
  });
  const [wtPanel, setWtPanel] = useState<PanelData>({
    label: '야생형 (Wild-Type)', jobId: wtJobId,
    accentClass: 'border-emerald-700/60 bg-emerald-950/20 text-emerald-300',
    analysis: null, svg: null, legend: [], regionQuality: null, smilesTokens: null, canonicalSmiles: '',
    loading: false, error: null,
  });

  const runAnalysisAndHighlight = useCallback(async (
    jobId: string, inh: typeof inhibitor, cifPath: string,
    setPanel: React.Dispatch<React.SetStateAction<PanelData>>,
    mutLabel: string
  ) => {
    if (!jobId || !inh || !cifPath) return;
    setPanel(p => ({ ...p, loading: true, error: null }));

    try {
      // 1) 구조 분석
      const res = await client.post('/api/structure/analyze', {
        filepath: cifPath, inhibitorId: inh.id,
        variant: mutLabel,
      });
      const analysis: StructureAnalysisResult = res.data;

      // 2) 분자 하이라이트 SVG 생성
      const hlRes = await getMoleculeHighlight({
        smiles: inh.smiles,
        inhibitorId: inh.id,
        contacts:    analysis.contacts    as any,
        hbonds:      analysis.hbonds      as any,
        buriedArea:  analysis.buriedArea  as any,
      });

      if (!hlRes.success || !hlRes.svg) {
        setPanel(p => ({ ...p, loading: false, error: hlRes.error ?? '하이라이트 생성 실패', analysis }));
        return;
      }
      setPanel(p => ({
        ...p, loading: false, analysis,
        svg: hlRes.svg!,
        legend: hlRes.legend ?? [],
        regionQuality: (hlRes as any).regionQuality ?? null,
        smilesTokens: (hlRes as any).smilesTokens ?? null,
        canonicalSmiles: (hlRes as any).canonicalSmiles ?? '',
      }));
    } catch (e: any) {
      const errMsg =
        e?.response?.data?.error ||
        e?.response?.data?.details ||
        e?.response?.data?.message ||
        e?.message ||
        '알 수 없는 오류';
      const statusCode = e?.response?.status ? ` (HTTP ${e.response.status})` : '';
      setPanel(p => ({ ...p, loading: false, error: `${errMsg}${statusCode}` }));
    }
  }, []);

  // 페이지 진입 시 양쪽 분석 실행
  useEffect(() => {
    if (!inhibitorId || !smiles) return;

    const load = async () => {
      // Mutant 패널
      if (mutJobId) {
        let mutJob;
        try { mutJob = await getAnalysisJob(mutJobId); } catch (e: any) {
          const is404 = e?.response?.status === 404;
          setMutPanel(p => ({ ...p, loading: false, error: is404
            ? `서버가 재시작되어 Job이 초기화되었습니다. Step 5에서 🔄 WSL 동기화 후 다시 진입하세요. (${mutJobId})`
            : `Job 로드 실패: ${e?.message ?? '알 수 없는 오류'}` }));
          return;
        }
        const mutInh  = mutJob?.inhibitors?.find((i: any) => i.inhibitorId === inhibitorId);
        const mutPath = mutInh?.structureFilePath || `/api/af3/output/${mutJobId}_${inhibitorId}/${mutJobId}_${inhibitorId}_model.cif`;
        const mutLabel = mutJob?.mutations?.map((m: any) => `${m.wildTypeResidue}${m.position}${m.mutantResidue}`).join('/') || 'Mutant';
        if (inhibitor) await runAnalysisAndHighlight(mutJobId, inhibitor, mutPath, setMutPanel, mutLabel);
      }

      // WT 패널
      if (wtJobId && inhibitor) {
        let wtJob;
        try { wtJob = await getAnalysisJob(wtJobId); } catch (e: any) {
          const is404 = e?.response?.status === 404;
          setWtPanel(p => ({ ...p, loading: false, error: is404
            ? `서버가 재시작되어 WT Job이 초기화되었습니다. Step 5에서 🔄 WSL 동기화 후 다시 진입하세요. (${wtJobId})`
            : `WT Job 로드 실패: ${e?.message ?? '알 수 없는 오류'}` }));
          return;
        }
        const wtInh = wtJob?.inhibitors?.find((i: any) => i.inhibitorId === inhibitorId);
        const wtPath = wtInh?.structureFilePath || `/api/af3/output/${wtJobId}_${inhibitorId}/${wtJobId}_${inhibitorId}_model.cif`;
        await runAnalysisAndHighlight(wtJobId, inhibitor, wtPath, setWtPanel, 'WT');
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mutJobId, wtJobId, inhibitorId, smiles]);

  // WT/Mutant 양쪽 구조 분석이 모두 끝나면 diff(WT 대비 변화) 계산 —
  // Mutant 패널의 2D 다이어그램·영역별 결합력·SMILES 하이라이트는 이 결과로 대체된다.
  useEffect(() => {
    if (!wtJobId || !inhibitor) return;
    if (!wtPanel.analysis?.contacts || !mutPanel.analysis?.contacts) return;

    let cancelled = false;
    setDiffError(null);
    getMoleculeHighlightDiff({
      smiles: inhibitor.smiles,
      inhibitorId: inhibitor.id,
      wtContacts: wtPanel.analysis.contacts as any,
      wtHbonds: wtPanel.analysis.hbonds as any,
      mutContacts: mutPanel.analysis.contacts as any,
      mutHbonds: mutPanel.analysis.hbonds as any,
    }).then((res) => {
      if (cancelled) return;
      if (!res.success || !res.svg) {
        setDiffError(res.error ?? 'WT 대비 변화 계산 실패');
      } else {
        setDiffResult({
          svg: res.svg,
          regionDiff: res.regionDiff ?? {},
          smilesTokens: (res as any).smilesTokens ?? [],
          canonicalSmiles: (res as any).canonicalSmiles ?? '',
          legend: res.legend ?? [],
        });
      }
    }).catch((e: any) => {
      if (cancelled) return;
      setDiffError(e?.response?.data?.error ?? e?.message ?? '알 수 없는 오류');
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wtJobId, wtPanel.analysis, mutPanel.analysis]);

  if (!inhibitorId || !smiles) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-gray-400">
        <AlertCircle className="w-10 h-10" />
        <p className="text-sm">URL에 <code className="font-mono text-cyan-400">?mutJobId=&inhibitorId=</code> 파라미터가 필요합니다.</p>
        <Link to="/interaction" className="text-cyan-400 underline text-sm">← Step 5로 돌아가기</Link>
      </div>
    );
  }

  const diffPending = !!wtJobId && !diffResult && !diffError;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* 헤더 */}
      <div className="border-b border-[#243047] pb-4">
        <div className="flex items-center gap-2 text-gray-500 text-xs mb-3">
          <span className="font-mono bg-[#141b2d] px-2 py-0.5 rounded">JOB ID: {mutJobId || wtJobId}</span>
          <span>•</span>
          <span>STEP 7 – 분자 구조 하이라이트</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2.5">
          <FlaskConical className="w-7 h-7 text-violet-400" />
          분자 구조 결합 취약부 분석
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          {wtJobId
            ? 'WT 대비 Mutant에서 결합이 약해진/소실된 부위만 하이라이트합니다.'
            : 'AF3 구조 분석 기반으로 억제제의 결합 취약 부위를 2D 구조에 하이라이트합니다.'}
        </p>
      </div>

      {/* 억제제 정보 */}
      {inhibitor && (
        <div className="card-base p-4 flex flex-wrap gap-4 items-start bg-[#0b1020] border-violet-700/30">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">억제제</p>
            <p className="font-bold text-gray-100">{inhibitor.label || inhibitor.name}</p>
            <p className="text-xs font-mono text-gray-500 break-all mt-1">{smiles}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {inhibitor.warheadType && (
              <span className="px-2 py-1 rounded-lg bg-violet-900/50 text-violet-300 text-xs font-bold border border-violet-700/40 flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {inhibitor.warheadType} warhead
              </span>
            )}
            {inhibitor.type && (
              <span className="px-2 py-1 rounded-lg bg-slate-800/60 text-slate-300 text-xs border border-slate-700/40">
                {inhibitor.type}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 범례 설명 */}
      <div className="card-base p-4 bg-[#0b1020] border-[#1e2d40]">
        <div className="flex flex-col gap-3">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-cyan-400" />
              <p className="text-xs font-semibold text-gray-300">
                {wtJobId ? '변화 하이라이트 색상 (Mutant 패널, 원자 주변 배경색)' : '결합 강도 하이라이트 색상 (원자 주변 배경색)'}
              </p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              {(wtJobId
                ? [
                    { color: '#eb3838', label: '결합 소실 (Lost)' },
                    { color: '#ff8c1a', label: '결합 약화 (Weakened)' },
                    { color: '#4a90e2', label: '결합 개선 (Improved)' },
                  ]
                : [
                    { color: '#2ed26a', label: 'H-bond (강한 결합)' },
                    { color: '#ffd020', label: 'VdW 접촉' },
                    { color: '#ff8c1a', label: '약한 접촉 (잠재적 취약)' },
                    { color: '#eb3838', label: '접촉 없음 / 취약 부위' },
                  ]
              ).map((item, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: item.color }} />
                  <span className="text-xs text-gray-400">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-2 border-t border-[#1e2d40]">
            <div className="flex items-center gap-2 mb-2">
              <Atom className="w-4 h-4 text-violet-400" />
              <p className="text-xs font-semibold text-gray-300">분자 뼈대 원자 기호 색상 (RDKit CPK 표준)</p>
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              {[
                { color: '#b3b3bf', label: '탄소(C) / 뼈대 결합선' },
                { color: '#6699ff', label: '질소 (N)' },
                { color: '#ff6666', label: '산소 (O)' },
                { color: '#33cccc', label: '불소 (F)' },
                { color: '#cccc33', label: '황 (S)' },
                { color: '#33cc33', label: '염소 (Cl)' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <span className="text-xs font-bold font-mono bg-[#141b2d] px-1 rounded" style={{ color: item.color }}>Aa</span>
                  <span className="text-xs text-gray-400">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {diffError && (
        <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-700/30 text-xs text-rose-300 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>WT 대비 변화 계산 실패: {diffError} (Mutant 패널은 임시로 자체 분석 결과를 표시합니다.)</span>
        </div>
      )}

      {/* 메인 패널 (원본 | 변이 비교) */}
      <div className="flex flex-col lg:flex-row gap-5">
        {wtJobId ? <MolPanel data={wtPanel} plainSvg={plainSvg} /> : null}
        <MolPanel
          data={mutPanel}
          diffOverride={diffResult}
          diffPending={wtJobId ? diffPending : false}
        />
      </div>

      {/* 네비게이션 버튼 (하단) */}
      <div className="pt-4 border-t border-[#243047] flex justify-between items-center">
        <button
          onClick={() => navigate(`/interaction?jobId=${mutJobId}`)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          결합 붕괴 분석 (STAGE 2)으로 돌아가기
        </button>
        <button
          onClick={() => {
            // 실측 diff(다이어그램·포켓별 변화·SMILES 하이라이트)를 통째로 Stage 3로
            // 넘긴다 — 일반 SAR 지식이 아니라 "이번 변이에서 실제로 안 붙게 된 부위"를
            // 그대로 이어받아 보여주기 위함.
            if (diffResult?.svg) {
              sessionStorage.setItem(
                `af3_diff_${mutJobId}_${inhibitorId}`,
                JSON.stringify(diffResult)
              );
            }
            navigate(`/optimization?jobId=${mutJobId}&inhibitor=${inhibitorId}`);
          }}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-colors shadow-lg shadow-indigo-900/20"
        >
          다음 단계: 유도체 설계 (STAGE 3) <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default MoleculeHighlightPage;
