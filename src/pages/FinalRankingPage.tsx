import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Trophy, Star, Shield, Activity, Dna, ArrowLeft, Droplets } from 'lucide-react';
import { getAnalysisJob } from '../api/analysisApi';
import { INITIAL_INHIBITORS } from '../types/inhibitor';
import type { FinalCandidateRecord, FinalCategory } from '../types/optimization';
import { EmptyState, LoadingState, ErrorState } from '../components/common';
import { NasalFeasibilityBadge } from '../components/common/RiskBadge';
import { assessNasalFeasibility, NASAL_DOSE_ASSUMPTION } from '../utils/nasal';
import type { NasalAssessment } from '../utils/nasal';

interface DerivativeAnalysisResult {
  properties: {
    mw: number; clogp: number; tpsa: number;
    hbd?: number;
    solubility?: { logS?: number; mgPerMl?: number };
  };
  admet: { status: string; flags: string[] };
}

interface ExtendedFinalCandidateRecord extends FinalCandidateRecord {
  candidateSmiles?: string;
  parentAnalysis?: DerivativeAnalysisResult;
  candidateAnalysis?: DerivativeAnalysisResult;
}

type RowCategory = FinalCategory | 'baseline';

interface RankingRow {
  id: string;
  name: string;
  type: 'Baseline' | 'Optimized Candidate';
  mw: number;
  tpsa: number;
  clogp: number;
  structuralAlertCount: number;
  category: RowCategory;
  bindingAffinity?: number;
  bindingAffinityDelta?: number;
  /** 비강 전달 적합성 평가 (물성값이 없으면 unresolved) */
  nasal: NasalAssessment;
}

function formatDelta(value: number): { text: string; className: string } {
  const sign = value < 0 ? '▼' : value > 0 ? '▲' : '–';
  const className = value < 0 ? 'text-emerald-400' : value > 0 ? 'text-rose-400' : 'text-gray-500';
  return { text: `${sign} ${Math.abs(value).toFixed(2)}`, className };
}

const CATEGORY_LABEL: Record<RowCategory, string> = {
  baseline: 'Baseline',
  top_structural_candidate: 'Top Structural',
  top_nasal_feasibility_candidate: 'Top Nasal',
  balanced_candidate: 'Balanced',
  high_risk_candidate: 'High Risk',
  insufficient_evidence: 'Insufficient Evidence',
};

const CATEGORY_COLOR: Record<RowCategory, string> = {
  baseline: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  top_structural_candidate: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  top_nasal_feasibility_candidate: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  balanced_candidate: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  high_risk_candidate: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  insufficient_evidence: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const CATEGORY_ICON: Record<RowCategory, React.ReactNode> = {
  baseline: null,
  top_structural_candidate: <Dna className="w-4 h-4" />,
  top_nasal_feasibility_candidate: <Activity className="w-4 h-4" />,
  balanced_candidate: <Star className="w-4 h-4" />,
  high_risk_candidate: <Shield className="w-4 h-4" />,
  insufficient_evidence: null,
};

/** 후보 레코드에서 비강 적합성 평가 입력값을 뽑는다 (실측 저장값 우선) */
function nasalOf(candidate: ExtendedFinalCandidateRecord): NasalAssessment {
  const props = candidate.candidateAnalysis?.properties;
  return assessNasalFeasibility({
    mw: candidate.mw,
    tpsa: candidate.tpsa,
    clogp: candidate.clogp,
    hbd: candidate.hbd ?? props?.hbd ?? null,
    solubilityMgPerMl: candidate.solubilityMgPerMl ?? props?.solubility?.mgPerMl ?? null,
    solubilityLogS: candidate.solubilityLogS ?? props?.solubility?.logS ?? null,
  });
}

// 명세서 13.3 규칙: 구조 재검증(AF3) 없이는 'Top Structural'로 분류하지 않는다.
function categorize(candidate: ExtendedFinalCandidateRecord, nasal: NasalAssessment): FinalCategory {
  const structuralRecovered = candidate.improvement?.structuralInteractionRecovery === 'improved';
  if (structuralRecovered) return 'top_structural_candidate';

  const clogp = candidate.clogp ?? 0;
  const structuralAlerts = candidate.structuralAlertCount ?? 0;

  // 분자량은 비강 적합성 축(≤500 / 500–600 / >600)과 하드필터(>700)에서 이미 평가한다.
  // 여기서 또 위험 신호로 쓰면 Lipinski 초과만으로 High Risk가 되어, MW 500을 넘는
  // 승인 프로테아제 억제제(Leritrelvir 639, Boceprevir 522 등)까지 위험으로 분류된다.
  const highRisk = clogp > 5 || structuralAlerts > 0 || candidate.improvement?.toxicityNasalProfile === 'worsened';
  if (highRisk) return 'high_risk_candidate';

  // 비강 적합성 판정은 src/utils/nasal.ts로 일원화 (1단계 스크리닝과 동일 기준)
  if (nasal.feasibility === 'favorable') return 'top_nasal_feasibility_candidate';

  return 'balanced_candidate';
}

export const FinalRankingPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const jobId = searchParams.get('jobId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<RankingRow[]>([]);

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const job = await getAnalysisJob(jobId);
        if (cancelled) return;

        const candidates = (job.finalCandidates || []) as ExtendedFinalCandidateRecord[];
        const list: RankingRow[] = [];
        const seenParents = new Set<string>();

        candidates.forEach((c) => {
          if (!seenParents.has(c.parentInhibitorId) && c.parentAnalysis) {
            seenParents.add(c.parentInhibitorId);
            const parentInhibitor = INITIAL_INHIBITORS.find((i) => i.id === c.parentInhibitorId);
            list.push({
              id: c.parentInhibitorId,
              name: parentInhibitor?.label || parentInhibitor?.name || c.parentInhibitorId,
              type: 'Baseline',
              mw: c.parentAnalysis.properties.mw,
              tpsa: c.parentAnalysis.properties.tpsa,
              clogp: c.parentAnalysis.properties.clogp,
              structuralAlertCount: 0,
              category: 'baseline',
              bindingAffinity: c.parentBindingAffinity,
              // parent(원본 억제제)도 동일 기준으로 평가해 후보와 나란히 비교한다
              nasal: assessNasalFeasibility({
                mw: c.parentAnalysis.properties.mw,
                tpsa: c.parentAnalysis.properties.tpsa,
                clogp: c.parentAnalysis.properties.clogp,
                hbd: c.parentAnalysis.properties.hbd ?? null,
                solubilityMgPerMl: c.parentAnalysis.properties.solubility?.mgPerMl ?? null,
                solubilityLogS: c.parentAnalysis.properties.solubility?.logS ?? null,
              }),
            });
          }

          const nasal = nasalOf(c);
          list.push({
            id: c.candidateId,
            name: `Deriv-${c.candidateId.slice(0, 6)}`,
            type: 'Optimized Candidate',
            mw: c.mw ?? 0,
            tpsa: c.tpsa ?? 0,
            clogp: c.clogp ?? 0,
            structuralAlertCount: c.structuralAlertCount ?? 0,
            category: categorize(c, nasal),
            bindingAffinity: c.bindingAffinity,
            bindingAffinityDelta: c.bindingAffinityDelta,
            nasal,
          });
        });

        setRows(list);
      } catch (err: any) {
        if (!cancelled) setError(err?.response?.data?.error || 'Job 데이터를 불러오지 못했습니다.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [jobId]);

  if (!jobId) {
    return (
      <EmptyState
        title="분석 Job이 지정되지 않았습니다"
        description="스크리닝 단계부터 분석을 진행한 뒤 최종 비교로 이동해주세요."
        actionLabel="스크리닝으로 돌아가기"
        onAction={() => navigate('/screening')}
        icon={<Trophy className="w-7 h-7 stroke-[1.5] text-amber-500/70" />}
      />
    );
  }

  if (loading) {
    return <LoadingState title="최종 순위 데이터 로딩 중..." description="job에 저장된 유도체 후보 재평가 결과를 불러오고 있습니다." />;
  }

  if (error) {
    return <ErrorState title="오류" message={error} onRetry={() => navigate(`/optimization?jobId=${jobId}`)} />;
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title="최종 분석 데이터가 없습니다"
        description="이 Job에는 아직 단계별 유도체 후보가 없습니다. 유도체 설계(STAGE 3)를 먼저 진행해주세요."
        actionLabel="유도체 설계로 이동"
        onAction={() => navigate(`/optimization?jobId=${jobId}`)}
        icon={<Trophy className="w-7 h-7 stroke-[1.5] text-amber-500/70" />}
      />
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn pb-10">
      <div className="border-b border-[#243047] pb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-amber-300 flex items-center gap-2.5">
            <Trophy className="w-7 h-7 text-amber-400" />
            <span>최종 순위 및 종합 비교 (Final Ranking)</span>
          </h1>
          <p className="text-sm text-gray-400 mt-2">
            구조 복원력, 독성 위험, 비강 전달 적합성 축을 모두 고려하여, 단 하나의 최고가 아닌 다차원적 목적에 맞는 <strong>우수 카테고리 후보군</strong>을 제안합니다.
          </p>
        </div>
      </div>

      <div className="card-base overflow-hidden bg-[#0b1020] border-[#243047]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-[#141b2d] border-b border-[#243047] text-xs uppercase text-gray-400">
              <tr>
                <th className="px-6 py-4 font-bold">후보 / 억제제 (Name)</th>
                <th className="px-6 py-4 font-bold">분류 (Type)</th>
                <th className="px-6 py-4 font-bold">분자량 (MW)</th>
                <th className="px-6 py-4 font-bold">극성 (TPSA / cLogP)</th>
                <th className="px-6 py-4 font-bold">구조 경고</th>
                <th className="px-6 py-4 font-bold">결합에너지 (kcal/mol)</th>
                <th className="px-6 py-4 font-bold">비강 적합성</th>
                <th className="px-6 py-4 font-bold">최종 카테고리 (Category)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#243047]/60">
              {rows.map((item) => (
                <tr key={item.id} className="hover:bg-[#1a233a] transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-gray-200">{item.name}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs ${item.type === 'Baseline' ? 'text-gray-400' : 'text-cyan-400 font-bold'}`}>
                      {item.type}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-gray-300">
                    <span className={item.mw > 550 ? 'text-rose-400' : ''}>{item.mw.toFixed(1)}</span>
                  </td>
                  <td className="px-6 py-4 font-mono text-gray-300">
                    {item.tpsa.toFixed(1)} / {item.clogp.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 font-mono text-gray-300">
                    {item.structuralAlertCount > 0 ? (
                      <span className="text-rose-400">{item.structuralAlertCount}건</span>
                    ) : (
                      <span className="text-gray-600">없음</span>
                    )}
                  </td>
                  <td className="px-6 py-4 font-mono text-gray-300">
                    {item.bindingAffinity !== undefined ? (
                      <div className="flex items-center gap-2">
                        <span>{item.bindingAffinity.toFixed(2)}</span>
                        {item.bindingAffinityDelta !== undefined && (
                          <span className={`text-[15px] font-bold ${formatDelta(item.bindingAffinityDelta).className}`}>
                            {formatDelta(item.bindingAffinityDelta).text}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-600">미측정</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {item.nasal.feasibility === 'unresolved' ? (
                      <span className="text-gray-600 text-xs">물성값 없음</span>
                    ) : (
                      <NasalFeasibilityBadge feasibility={item.nasal.feasibility} />
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className={`px-3 py-1.5 rounded inline-flex items-center gap-2 border ${CATEGORY_COLOR[item.category]}`}>
                      {CATEGORY_ICON[item.category]}
                      <span className="font-bold text-xs">{CATEGORY_LABEL[item.category]}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 비강 전달 적합성 상세 — 판정 근거를 수치와 함께 공개 */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Droplets className="w-5 h-5 text-cyan-400" />
          <h2 className="text-lg font-bold text-gray-100">비강 전달 적합성 상세</h2>
          <span className="text-xs text-gray-500">
            MW · TPSA · cLogP · HBD 4개 축 판정 (수용해도는 참고 지표)
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rows.filter((r) => r.nasal.feasibility !== 'unresolved').map((item) => (
            <div key={`nasal-${item.id}`} className="card-base p-5 bg-[#0b1020] border-[#243047]">
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-[#243047]">
                <div>
                  <div className="font-bold text-base text-gray-200">{item.name}</div>
                  <div className="text-sm text-gray-500">{item.type}</div>
                </div>
                <NasalFeasibilityBadge feasibility={item.nasal.feasibility} />
              </div>

              <div className="space-y-2">
                {item.nasal.criteria.map((c) => (
                  <div key={c.key} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-gray-400 shrink-0 w-36">{c.label}</span>
                    <span className="font-mono text-gray-200 shrink-0 w-24 text-right">{c.display}</span>
                    <span className="text-gray-600 shrink-0 w-20 text-right font-mono">{c.criterion}</span>
                    <span
                      className={`font-bold shrink-0 w-14 text-right ${
                        c.status === 'pass' ? 'text-emerald-400'
                          : c.status === 'borderline' ? 'text-amber-400' : 'text-rose-400'
                      }`}
                    >
                      {c.status === 'pass' ? '통과' : c.status === 'borderline' ? '경계' : '미달'}
                    </span>
                  </div>
                ))}
              </div>

              {item.nasal.solubility && (
                <div className="mt-3 pt-3 border-t border-[#243047]">
                  <div className="text-sm text-gray-500 mb-1">
                    수용해도 (참고 — 판정 미반영)
                  </div>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="font-mono text-base text-gray-200">
                      {item.nasal.solubility.mgPerMl.toFixed(3)} mg/mL
                    </span>
                    <span className={`text-sm font-bold ${item.nasal.solubility.sufficient ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {item.nasal.solubility.sufficient
                        ? '필요 농도 충족'
                        : `필요 농도의 1/${Math.round(item.nasal.solubility.shortfallFactor)} 수준`}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">
                    비강 1회 투여 부피 한계({NASAL_DOSE_ASSUMPTION.volumeUl} µL)에서{' '}
                    {NASAL_DOSE_ASSUMPTION.doseMg} mg 투여 시 {NASAL_DOSE_ASSUMPTION.requiredMgPerMl} mg/mL 필요.
                    {item.nasal.solubility.method} — 가용화제·염 형태 등 제형 검토 필요 여부를 가늠하는 참고값이며 실험 측정이 필요합니다.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-center pt-8 border-t border-[#243047]">
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-[#141b2d] hover:bg-[#1a233a] border border-[#243047] text-gray-300 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>대시보드로 돌아가기</span>
        </button>
      </div>
    </div>
  );
};

export default FinalRankingPage;
