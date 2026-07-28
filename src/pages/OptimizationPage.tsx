import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FlaskConical, AlertTriangle, ArrowRight, ShieldAlert, CheckCircle2, Dna, Activity, GitCompareArrows } from 'lucide-react';
import client from '../api/client';
import { checkRegionPresence } from '../api/analysisApi';
import { INITIAL_INHIBITORS } from '../types/inhibitor';
import type { ModificationType } from '../types/optimization';
import { EmptyState, LoadingState, ErrorState } from '../components/common';

const REGION_LABELS: Record<string, string> = {
  warhead: 'Warhead (Cys145 공유결합)',
  p1: 'P1 pocket (S1 anchor)',
  p2: 'P2 pocket',
};

type SmilesToken = { text: string; region: string | null; quality: string | null; color: string | null; isProblem?: boolean };

interface DiffContext {
  svg: string;
  regionDiff: Record<string, { quality: string; color: string | null; reason: string }>;
  smilesTokens: SmilesToken[];
  canonicalSmiles: string;
  legend: { color: string; label: string }[];
}

interface FlaggedRegion {
  region: string;
  quality: 'lost' | 'weakened';
  reason: string;
}

export const OptimizationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const jobId = searchParams.get('jobId');
  const inhibitorId = searchParams.get('inhibitor');

  const [loading, setLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // A-2 버튼으로 채운 것인지, 사용자가 직접 SMILES를 수정한 것인지 구분 —
  // 서버에 후보를 저장할 때 modificationType/rationale을 여기에 맞춰 정직하게 기록한다.
  const [usedA2Preset, setUsedA2Preset] = useState(false);

  const parentInhibitor = INITIAL_INHIBITORS.find(i => i.id === inhibitorId);
  const a2Derivative = INITIAL_INHIBITORS.find(i => i.id === 'a2_derivative');

  const [smilesInput, setSmilesInput] = useState(parentInhibitor?.smiles || '');

  // Step 7에서 계산한 "WT 대비 실측 변화"(다이어그램·포켓별 변화·SMILES 하이라이트)를
  // 그대로 이어받는다 — 일반 SAR 지식이 아니라 이번 변이의 실측 결과를 보여준다.
  const [diffContext, setDiffContext] = useState<DiffContext | null>(null);
  const [regionPresence, setRegionPresence] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    if (!jobId || !inhibitorId) return;
    const raw = sessionStorage.getItem(`af3_diff_${jobId}_${inhibitorId}`);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.svg) setDiffContext(parsed);
    } catch { /* 저장된 값이 손상됐으면 조용히 무시하고 기본 안내로 대체 */ }
  }, [jobId, inhibitorId]);

  const flaggedRegions: FlaggedRegion[] = diffContext
    ? Object.entries(diffContext.regionDiff)
        .filter(([, info]) => info.quality === 'lost' || info.quality === 'weakened')
        .map(([region, info]) => ({ region, quality: info.quality as 'lost' | 'weakened', reason: info.reason }))
    : [];

  const analyzeDerivative = async (smilesToAnalyze: string) => {
    setLoading(true);
    setError(null);
    setRegionPresence(null);
    try {
      const res = await client.post('/api/derivative/analyze', {
        smiles: smilesToAnalyze
      });
      if (res.data.success) {
        setAnalysisResult(res.data);
        if (flaggedRegions.length > 0) {
          checkRegionPresence(smilesToAnalyze, flaggedRegions.map(f => f.region))
            .then((r) => { if (r.success) setRegionPresence(r.regionPresence ?? null); })
            .catch(() => { /* 체크 실패해도 물성 분석 결과는 그대로 유지 */ });
        }
      } else {
        setError(res.data.error || 'Failed to analyze derivative');
      }
    } catch (err: any) {
      console.error(err);
      setError(err?.response?.data?.error || '분석 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const proceedToReevaluation = async () => {
    if (!jobId || !inhibitorId || !parentInhibitor) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const modificationType: ModificationType = usedA2Preset ? 'fragment_replacement' : 'r_group_replacement';
      const rationale = usedA2Preset
        ? ['Nitrile Warhead 유지: Cys145 공유결합 확보', 'P1 γ-lactam 고리 확장: E166V로 인한 S1 포켓 Gap 보상']
        : ['사용자 정의 SMILES 수정'];

      const res = await client.post(`/api/analysis/${jobId}/optimize`, {
        parentInhibitorId: inhibitorId,
        parentSmiles: parentInhibitor.smiles,
        smiles: smilesInput,
        modificationType,
        rationale,
      });
      const candidateId = res.data.candidateId;
      navigate(`/reevaluation?jobId=${jobId}&candidateId=${candidateId}`);
    } catch (err: any) {
      setSubmitError(err?.response?.data?.error || '후보 저장 중 오류가 발생했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!jobId || !inhibitorId) {
    return (
      <EmptyState
        title="선택된 상호작용 약화 억제제가 없습니다"
        description="상호작용 비교 단계에서 '구조변경 후보 생성'을 클릭하여 진입해 주세요."
        actionLabel="상호작용 비교로 돌아가기"
        onAction={() => navigate(`/interaction${jobId ? `?jobId=${jobId}` : ''}`)}
        icon={<FlaskConical className="w-7 h-7 stroke-[1.5] text-cyan-500/70" />}
      />
    );
  }

  if (!parentInhibitor) {
    return <ErrorState title="오류" message="알 수 없는 억제제 ID입니다." onRetry={() => navigate('/')} />;
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="border-b border-[#243047] pb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2.5">
            <FlaskConical className="w-7 h-7 text-cyan-400" />
            <span>유도체 설계 (STAGE 3)</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            결합 실패 지점을 기반으로 스캐폴드를 변형하고 SMILES 구조를 평가합니다.
          </p>
        </div>
      </div>

      {/* Row 1: 2D 분자 구조 — WT | Mutant 나란히 */}
      {diffContext && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card-base p-5 bg-[#0b1020]">
            <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
              <Dna className="w-4 h-4 text-emerald-400" /> WT (야생형)
            </h3>
            <div className="min-h-[280px] flex items-center justify-center bg-[#060d1a] rounded-xl overflow-hidden">
              <div className="max-w-md w-full [&>svg]:w-full [&>svg]:h-auto" dangerouslySetInnerHTML={{ __html: diffContext.svg }} style={{ lineHeight: 0 }} />
            </div>
          </div>
          <div className="card-base p-5 bg-[#0b1020]">
            <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
              <GitCompareArrows className="w-4 h-4 text-violet-400" /> Mutant (WT 대비 변화)
            </h3>
            <div className="min-h-[280px] flex items-center justify-center bg-white rounded-xl overflow-hidden">
              {loading ? (
                <span className="text-xs text-gray-500">분석 중...</span>
              ) : analysisResult?.svg ? (
                <div
                  className="max-w-md w-full p-2 [&>svg]:w-full [&>svg]:h-auto"
                  dangerouslySetInnerHTML={{ __html: analysisResult.svg.replace(/<\?xml.*\?>/, '') }}
                />
              ) : (
                <span className="text-xs text-gray-500 px-4 text-center">
                  아래에서 SMILES를 편집하고 "분자 물성 및 하이라이트 분석"을 누르면<br />여기에 결과 구조가 표시됩니다.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Row 2: 서열 (포켓별 변화 + WT/Mutant SMILES) | 수정서열 (편집 폼) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel: 포켓별 변화 + WT/Mutant SMILES */}
        <div className="space-y-4">
          <div className="card-base p-5 bg-[#0b1020] h-full">
            {diffContext ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <p className="text-[12px] font-semibold text-gray-500 uppercase tracking-wider mb-1">포켓별 WT → Mutant 변화</p>
                  {Object.entries(diffContext.regionDiff).map(([region, info]) => (
                    <div key={region} className="flex items-center justify-between py-1.5 border-b border-[#1e2d40] last:border-0 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: info.color ?? '#3f4a5e' }} />
                        <span className="text-xs text-gray-300 truncate">{REGION_LABELS[region] ?? region}</span>
                      </div>
                      <span className="text-[12px] font-mono shrink-0 text-right" style={{ color: info.color ?? '#6b7280' }}>
                        {info.quality === 'unchanged' ? 'WT 대비 변화 없음' : info.reason}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <div>
                    <p className="text-[12px] text-gray-500 mb-1">WT (야생형, 고정)</p>
                    <div className="rounded-lg bg-[#060d1a] p-2.5 border border-[#1e2d40] text-[12px] font-mono text-gray-400 break-all">
                      {diffContext.canonicalSmiles}
                    </div>
                  </div>
                  <div>
                    <p className="text-[12px] text-gray-500 mb-1">Mutant (WT 대비 변화 하이라이트)</p>
                    <div className="rounded-lg bg-[#060d1a] p-2.5 border border-[#1e2d40] text-[12px] font-mono break-all flex flex-wrap items-center gap-0.5">
                      {diffContext.smilesTokens.map((tok, i) => (
                        <span
                          key={i}
                          style={{
                            backgroundColor: tok.color ? tok.color + '22' : 'transparent',
                            color: tok.color ? tok.color : '#94a3b8',
                            border: tok.color ? `1px solid ${tok.color}55` : 'none',
                            padding: tok.color ? '1px 3px' : '0 1px',
                            borderRadius: tok.color ? '4px' : '0',
                            fontWeight: tok.color ? 700 : 400,
                          }}
                        >
                          {tok.text}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-600 py-10 text-center">
                Step 7(분자 구조 하이라이트)에서 "WT 대비 변화"를 확인하고 들어오면<br />
                이번 변이의 실측 결과가 여기 표시됩니다.
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: 분자 구조 편집 (수정서열) */}
        <div className="space-y-4">
          <div className="card-base p-5 bg-[#0b1020] h-full">
            <h3 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2">
              <Dna className="w-4 h-4 text-cyan-400" /> 분자 구조 편집
            </h3>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-400 mb-2">현재 SMILES 입력</div>
                <textarea
                  value={smilesInput}
                  onChange={(e) => { setSmilesInput(e.target.value); setUsedA2Preset(false); setRegionPresence(null); }}
                  className="w-full h-24 bg-[#141b2d] border border-[#243047] rounded-lg p-3 text-sm font-mono text-gray-200 focus:outline-none focus:border-cyan-500 transition-colors"
                  placeholder="SMILES 문자열을 입력하세요"
                />
              </div>

              {flaggedRegions.length > 0 ? (
                <div className="p-2.5 rounded-lg bg-[#141b2d] border border-[#243047] text-xs space-y-1.5">
                  <p className="text-gray-500 text-[12px] uppercase tracking-wider mb-1">손실 부위 수정 확인 (분석 시 자동 체크)</p>
                  {flaggedRegions.map((f) => {
                    const addressed = regionPresence ? regionPresence[f.region] === false : null;
                    return (
                      <div key={f.region} className="flex items-center justify-between">
                        <span className="text-gray-300">{REGION_LABELS[f.region] ?? f.region}</span>
                        {addressed === null ? (
                          <span className="text-gray-600">분석 대기</span>
                        ) : (
                          <span className={`font-bold ${addressed ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {addressed ? '✓ 수정됨' : '⚠ 아직 그대로'}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-500/30 text-xs">
                  <div className="font-bold text-rose-400 mb-1 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4" /> 결합력 상실 극복 전략 참고
                  </div>
                  <ul className="list-disc pl-4 text-rose-300/80 space-y-1">
                    <li>Nitrile Warhead 유지: Cys145 공유결합 확보</li>
                    <li>P1 γ-lactam 고리 확장: S1 포켓 Gap 보상 등 일반적 전략 참고</li>
                  </ul>
                  <p className="text-gray-600 mt-2">※ Step 7에서 "WT 대비 변화" 확인 후 들어오면 이번 변이의 실측 손실 부위가 여기 표시됩니다.</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setSmilesInput(parentInhibitor.smiles); setUsedA2Preset(false); setRegionPresence(null); }}
                  className="py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 border border-[#243047] hover:bg-[#1a233a] transition-all text-gray-300"
                >
                  원본 (Nirmatrelvir) 복원
                </button>
                <button
                  onClick={() => {
                    if (a2Derivative) {
                      setSmilesInput(a2Derivative.smiles);
                      setUsedA2Preset(true);
                      setRegionPresence(null);
                    }
                  }}
                  className="py-2.5 rounded-lg font-bold text-xs flex items-center justify-center gap-2 bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/50 transition-all"
                >
                  A-2 유도체 (P1 확장) 적용
                </button>
              </div>

              <button
                onClick={() => analyzeDerivative(smilesInput)}
                disabled={loading || !smilesInput}
                className={`w-full py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all mt-4 ${
                  loading || !smilesInput
                    ? 'bg-cyan-500/20 text-cyan-400 cursor-not-allowed'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-gray-900 shadow-lg '
                }`}
              >
                <Activity className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? '분석 중...' : '분자 물성 및 하이라이트 분석'}</span>
              </button>

              {error && (
                <div className="mt-3 p-3 rounded-xl bg-rose-950/20 border border-rose-700/30 text-xs text-rose-300 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 분석 결과 (좌우 카드 아래, 전체 폭) */}
      <div className="space-y-4">
        {!loading && !analysisResult && !error && (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-8 border border-dashed border-[#243047] rounded-xl bg-[#141b2d]/30">
              <Activity className="w-10 h-10 text-gray-600 mb-4" />
              <h3 className="text-gray-300 font-bold mb-1">유도체를 분석해보세요</h3>
              <p className="text-sm text-gray-500">
                SMILES를 입력하고 분석 버튼을 누르면 주요 파마코포어 영역과<br />물리화학적 특성(MW, cLogP 등)이 계산됩니다.
              </p>
            </div>
          )}

          {loading && (
            <div className="h-full min-h-[300px] flex items-center justify-center border border-[#243047] rounded-xl bg-[#141b2d]/30">
              <LoadingState title="물성 계산 중..." description="RDKit을 통한 구조 분석 및 ADMET Flag를 계산하고 있습니다." />
            </div>
          )}

          {!loading && analysisResult && (
            <div className="space-y-4 animate-fadeIn">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  분석 완료
                </h3>
                <button
                  onClick={proceedToReevaluation}
                  disabled={submitting}
                  className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors shadow-lg ${
                    submitting ? 'bg-emerald-500/20 text-emerald-400 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-400 text-gray-900'
                  }`}
                >
                  <span>{submitting ? '후보 저장 중...' : '결합 재검증 진행 (STAGE 4)'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {submitError && (
                <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-700/30 text-xs text-rose-300 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="card-base p-4 bg-[#141b2d] border border-[#243047] space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[#0b1020] border border-[#243047] rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500 mb-1">분자량 (MW)</div>
                    <div className="text-lg font-bold text-gray-200">{analysisResult.properties.mw}</div>
                  </div>
                  <div className="bg-[#0b1020] border border-[#243047] rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500 mb-1">cLogP</div>
                    <div className="text-lg font-bold text-gray-200">{analysisResult.properties.clogp}</div>
                  </div>
                  <div className="bg-[#0b1020] border border-[#243047] rounded-lg p-3 text-center">
                    <div className="text-xs text-gray-500 mb-1">TPSA</div>
                    <div className="text-lg font-bold text-gray-200">{analysisResult.properties.tpsa}</div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`px-2 py-1 rounded text-xs font-bold ${analysisResult.admet.status === 'Good' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                    ADMET: {analysisResult.admet.status}
                  </div>
                  {analysisResult.admet.flags.length > 0 && (
                    <div className="text-xs text-amber-300">
                      Flags: {analysisResult.admet.flags.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
      </div>
    </div>
  );
};

export default OptimizationPage;
