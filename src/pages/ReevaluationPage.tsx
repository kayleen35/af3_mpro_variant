import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ShieldCheck, ArrowRight, Dna, Activity, CheckCircle2, AlertTriangle, BarChart2, Beaker, Box } from 'lucide-react';
import client from '../api/client';
import { INITIAL_INHIBITORS } from '../types/inhibitor';
import type { FinalCandidateRecord } from '../types/optimization';
import { startAf3Rebind, getAf3RebindStatus } from '../api/analysisApi';
import type { Af3RebindState } from '../api/analysisApi';
import { LoadingState, ErrorState } from '../components/common';
import { StructureViewerPlaceholder } from '../components/structure';

const RECOVERY_LABEL: Record<string, string> = {
  improved: '구조적 상호작용 회복 확인',
  similar: '구조적 상호작용 유지 (변화 없음)',
  worsened: '구조적 상호작용 추가 손실',
  unresolved: '판정 보류',
};

const RECOVERY_COLOR: Record<string, string> = {
  improved: 'text-emerald-400',
  similar: 'text-gray-300',
  worsened: 'text-rose-400',
  unresolved: 'text-gray-500',
};

interface DerivativeAnalysisResult {
  success: boolean;
  properties: { mw: number; clogp: number; tpsa: number };
  admet: { status: string; flags: string[] };
  svg?: string;
  error?: string;
}

interface DerivativeDelta {
  mw: number;
  tpsa: number;
  clogp: number;
  addedAdmetFlags: string[];
  removedAdmetFlags: string[];
}

interface ExtendedFinalCandidateRecord extends FinalCandidateRecord {
  candidateSmiles?: string;
}

interface DockResult {
  bindingAffinity: number;
  parentBindingAffinity: number;
  delta: number;
  engine: string;
}

interface ReevaluateResponse {
  candidateId: string;
  parentAnalysis: DerivativeAnalysisResult;
  candidateAnalysis: DerivativeAnalysisResult;
  delta: DerivativeDelta;
  hardFilterPassed: boolean;
  reasons: string[];
  finalCandidate: ExtendedFinalCandidateRecord;
}

function formatDelta(value: number, unit = ''): { text: string; className: string } {
  const sign = value > 0 ? '+' : value < 0 ? '-' : '=';
  const className = value > 0 ? 'text-rose-400' : value < 0 ? 'text-emerald-400' : 'text-gray-500';
  return { text: `${sign} ${Math.abs(value).toFixed(2)}${unit}`, className };
}

export const ReevaluationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const jobId = searchParams.get('jobId');
  const candidateId = searchParams.get('candidateId');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ReevaluateResponse | null>(null);

  const [dockResult, setDockResult] = useState<DockResult | null>(null);
  const [docking, setDocking] = useState(false);
  const [dockError, setDockError] = useState<string | null>(null);

  const [af3State, setAf3State] = useState<Af3RebindState | null>(null);
  const [af3Error, setAf3Error] = useState<string | null>(null);

  // AF3 재결합이 진행 중(running/analyzing)인 동안 상태를 주기적으로 폴링한다 —
  // 실제 GPU 추론이라 QuickVina2와 달리 분 단위 이상 걸릴 수 있어 긴 요청을 붙잡지 않는다.
  useEffect(() => {
    if (!jobId || !candidateId) return;
    if (!af3State || af3State.status === 'completed' || af3State.status === 'failed' || af3State.status === 'timeout') return;
    let cancelled = false;
    const interval = setInterval(async () => {
      try {
        const s = await getAf3RebindStatus(jobId, candidateId);
        if (!cancelled) setAf3State(s);
      } catch (err: any) {
        if (!cancelled) setAf3Error(err?.response?.data?.error || 'AF3 재결합 상태 조회 실패');
      }
    }, 10000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [jobId, candidateId, af3State]);

  const runAf3Rebind = async () => {
    if (!jobId || !candidateId) return;
    setAf3Error(null);
    try {
      const s = await startAf3Rebind(jobId, candidateId);
      setAf3State(s);
    } catch (err: any) {
      setAf3Error(err?.response?.data?.error || 'AF3 재결합 시작 중 오류가 발생했습니다.');
    }
  };

  useEffect(() => {
    if (!jobId || !candidateId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await client.post<ReevaluateResponse>(`/api/analysis/${jobId}/reevaluate`, { candidateId });
        if (!cancelled) {
          setResult(res.data);
          const fc = res.data.finalCandidate;
          if (fc.bindingAffinity !== undefined && fc.parentBindingAffinity !== undefined) {
            setDockResult({
              bindingAffinity: fc.bindingAffinity,
              parentBindingAffinity: fc.parentBindingAffinity,
              delta: fc.bindingAffinityDelta ?? (fc.bindingAffinity - fc.parentBindingAffinity),
              engine: 'QuickVina2 (AutoDock Vina scoring function)',
            });
          }
        }
        // 이전에 AF3 재결합을 이미 시작/완료했으면(페이지 재방문) 그 상태를 이어받는다
        try {
          const s = await getAf3RebindStatus(jobId, candidateId);
          if (!cancelled) setAf3State(s);
        } catch { /* 아직 시작 전 — 버튼으로 시작 가능한 상태로 남는다 */ }
      } catch (err: any) {
        if (!cancelled) setError(err?.response?.data?.error || '재평가 데이터를 불러오지 못했습니다');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [jobId, candidateId]);

  const runDocking = async () => {
    if (!jobId || !candidateId) return;
    setDocking(true);
    setDockError(null);
    try {
      const res = await client.post<DockResult>(
        `/api/analysis/${jobId}/reevaluate/dock`,
        { candidateId },
        { timeout: 180000 } // QuickVina2 재도킹은 receptor 준비 포함 수십 초~2분 소요
      );
      setDockResult(res.data);
    } catch (err: any) {
      setDockError(err?.response?.data?.error || '재도킹 중 오류가 발생했습니다.');
    } finally {
      setDocking(false);
    }
  };

  if (!jobId || !candidateId) {
    return (
      <ErrorState
        title="후보 정보가 없습니다"
        message="유도체 설계(STAGE 3) 단계에서 '결합 재검증 진행' 버튼으로 진입해 주세요."
        onRetry={() => navigate('/optimization')}
      />
    );
  }

  if (loading) {
    return <LoadingState title="재평가 데이터 로딩 중..." description="저장된 유도체 후보의 물성 재평가 결과를 불러오고 있습니다." />;
  }

  if (error || !result) {
    return <ErrorState title="오류" message={error || '재평가 결과를 찾을 수 없습니다.'} onRetry={() => navigate(`/optimization?jobId=${jobId}`)} />;
  }

  const { parentAnalysis, candidateAnalysis, delta, hardFilterPassed, reasons, finalCandidate } = result;
  const parentInhibitor = INITIAL_INHIBITORS.find((i) => i.id === finalCandidate.parentInhibitorId);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="border-b border-[#243047] pb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2.5">
            <ShieldCheck className="w-7 h-7 text-cyan-400" />
            <span>설계 유도체 재검증 (STAGE 4)</span>
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            RDKit 실측 물성으로 parent 대비 변화량을 계산합니다. 구조적 상호작용 회복 여부는 별도 재검증이 필요합니다.
          </p>
        </div>
        <button
          onClick={() => navigate(`/final-ranking?jobId=${jobId}`)}
          className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-lg text-sm font-bold flex items-center gap-1.5 transition-colors shadow-lg"
        >
          <span>ADMET 평가 및 최종 결과로 이동</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Hard filter 판정 */}
      <div className={`p-4 rounded-xl border flex items-start gap-3 ${
        hardFilterPassed ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-rose-950/20 border-rose-500/30'
      }`}>
        {hardFilterPassed ? (
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
        )}
        <div>
          <h4 className="font-bold text-gray-200 mb-1">
            {hardFilterPassed ? '물성 기준 통과' : '물성 기준 미달'}
          </h4>
          <ul className="text-sm text-gray-400 list-disc pl-4 space-y-0.5">
            {reasons.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Parent result */}
        <div className="card-base p-6 bg-[#0b1020] border-gray-600/30">
          <div className="flex items-center gap-3 mb-4 border-b border-[#243047] pb-3">
            <Dna className="w-6 h-6 text-gray-400" />
            <h2 className="text-lg font-bold text-gray-200">{parentInhibitor?.label || parentInhibitor?.name || '원본 억제제'}</h2>
          </div>
          <PropertyGrid mw={parentAnalysis.properties.mw} tpsa={parentAnalysis.properties.tpsa} clogp={parentAnalysis.properties.clogp} />
          <AdmetRow admet={parentAnalysis.admet} />
        </div>

        {/* Candidate result */}
        <div className="card-base p-6 bg-[#141b2d] border-cyan-500/40">
          <div className="flex items-center gap-3 mb-4 border-b border-[#243047] pb-3">
            <Activity className="w-6 h-6 text-cyan-400" />
            <h2 className="text-lg font-bold text-cyan-300">설계 유도체 후보</h2>
          </div>
          <PropertyGrid
            mw={candidateAnalysis.properties.mw} mwDelta={delta.mw}
            tpsa={candidateAnalysis.properties.tpsa} tpsaDelta={delta.tpsa}
            clogp={candidateAnalysis.properties.clogp} clogpDelta={delta.clogp}
          />
          <AdmetRow admet={candidateAnalysis.admet} />
          {(delta.addedAdmetFlags.length > 0 || delta.removedAdmetFlags.length > 0) && (
            <div className="mt-3 text-xs space-y-1">
              {delta.addedAdmetFlags.map((f) => (
                <div key={f} className="text-rose-300">+ 새로 발생: {f}</div>
              ))}
              {delta.removedAdmetFlags.map((f) => (
                <div key={f} className="text-emerald-300">− 해소됨: {f}</div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 결합에너지 재도킹 — QuickVina2(AutoDock Vina 스코어링 함수) 실측 */}
      <div className="card-base p-5 bg-[#0b1020] border-[#243047]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-bold text-gray-300">결합에너지 재도킹 (AutoDock Vina 스코어링)</h3>
          </div>
          {!dockResult && (
            <button
              onClick={runDocking}
              disabled={docking}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
                docking ? 'bg-violet-500/20 text-violet-400 cursor-not-allowed' : 'bg-violet-500 hover:bg-violet-400 text-white'
              }`}
            >
              {docking ? '재도킹 실행 중... (최대 2분)' : 'AutoDock Vina 재도킹 실행'}
            </button>
          )}
        </div>

        {!dockResult && !docking && !dockError && (
          <p className="text-xs text-gray-500">
            아직 이 후보에 대한 결합에너지가 계산되지 않았습니다. 버튼을 누르면 parent 억제제의 AF3 예측 포켓에 QuickVina2로 실제 재도킹을 실행합니다.
          </p>
        )}
        {docking && (
          <p className="text-xs text-violet-300">Receptor 준비 및 QuickVina2 도킹 실행 중입니다. 잠시만 기다려주세요...</p>
        )}
        {dockError && (
          <div className="mt-2 p-3 rounded-lg bg-rose-950/20 border border-rose-700/30 text-xs text-rose-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{dockError}</span>
          </div>
        )}
        {dockResult && (
          <div className="grid grid-cols-3 gap-3 mt-2">
            <div className="bg-[#141b2d] border border-[#243047] rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">Parent 결합에너지</div>
              <div className="text-lg font-bold text-gray-200">{dockResult.parentBindingAffinity.toFixed(2)} <span className="text-xs font-normal text-gray-500">kcal/mol</span></div>
            </div>
            <div className="bg-[#141b2d] border border-cyan-500/40 rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">후보 결합에너지</div>
              <div className="text-lg font-bold text-cyan-300">{dockResult.bindingAffinity.toFixed(2)} <span className="text-xs font-normal text-gray-500">kcal/mol</span></div>
            </div>
            <div className="bg-[#141b2d] border border-[#243047] rounded-lg p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">변화량 (Δ)</div>
              <div className={`text-lg font-bold ${dockResult.delta < 0 ? 'text-emerald-400' : dockResult.delta > 0 ? 'text-rose-400' : 'text-gray-400'}`}>
                {dockResult.delta < 0 ? '▼' : dockResult.delta > 0 ? '▲' : '–'} {Math.abs(dockResult.delta).toFixed(2)}
              </div>
            </div>
          </div>
        )}
        {dockResult && (
          <p className="text-[13px] text-gray-600 mt-3">
            엔진: {dockResult.engine}. AF3가 예측한 parent 억제제의 mutant Mpro 포켓 좌표를 기준으로 parent/후보를 동일 조건에서 재도킹한 결과입니다.
            음수가 클수록 결합이 강하다는 뜻이며, 실제 억제 활성(IC50 등)을 의미하지 않습니다.
          </p>
        )}
      </div>

      {/* 구조적 상호작용 회복 검증 — 실제 AF3 GPU 재추론*/}
      <div className="card-base p-5 bg-[#0b1020] border-[#243047]">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Beaker className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-gray-300">구조적 상호작용 회복 (AF3 재결합)</h3>
          </div>
          {(!af3State || af3State.status === 'failed' || af3State.status === 'timeout') && (
            <button
              onClick={runAf3Rebind}
              className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors bg-amber-500 hover:bg-amber-400 text-gray-900"
            >
              AF3로 재결합 실행 (GPU, 분 단위 소요)
            </button>
          )}
        </div>

        {!af3State && !af3Error && (
          <p className="text-xs text-gray-500">
            아직 이 후보에 대한 AF3 재결합이 실행되지 않았습니다. 버튼을 누르면 후보 SMILES로 mutant 서열에 대해 AF3 전체 추론을 다시 실행하고,
            결과 구조의 실측 접촉·H-bond를 원본 parent 결합과 비교합니다. QuickVina2 도킹과 달리 실제 GPU 추론이라 분 단위 이상 걸릴 수 있습니다.
          </p>
        )}

        {af3Error && (
          <div className="mt-2 p-3 rounded-lg bg-rose-950/20 border border-rose-700/30 text-xs text-rose-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{af3Error}</span>
          </div>
        )}

        {(af3State?.status === 'running' || af3State?.status === 'analyzing') && (
          <p className="text-xs text-amber-300">
            {af3State.status === 'running'
              ? 'WSL AF3 엔진에서 GPU 추론 실행 중입니다. 이 페이지를 열어둔 채로 기다려주세요 (자동으로 상태가 갱신됩니다...'
              : '구조 예측 완료 후 접촉/H-bond 분석 중입니다...'}
          </p>
        )}

        {(af3State?.status === 'failed' || af3State?.status === 'timeout') && (
          <div className="mt-2 p-3 rounded-lg bg-rose-950/20 border border-rose-700/30 text-xs text-rose-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{af3State.error || 'AF3 재결합에 오류가 발생했습니다.'}</span>
          </div>
        )}

        {af3State?.status === 'completed' && af3State.structuralInteractionRecovery && af3State.parentAnalysis && af3State.candidateAnalysis && (
          <div className="space-y-3">
            <div className={`text-sm font-bold ${RECOVERY_COLOR[af3State.structuralInteractionRecovery]}`}>
              {RECOVERY_LABEL[af3State.structuralInteractionRecovery]}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#141b2d] border border-[#243047] rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">H-bond (parent → 후보)</div>
                <div className="text-lg font-bold text-gray-200">
                  {af3State.parentAnalysis.hbonds.count} ??{af3State.candidateAnalysis.hbonds.count}
                </div>
              </div>
              <div className="bg-[#141b2d] border border-[#243047] rounded-lg p-3 text-center">
                <div className="text-xs text-gray-500 mb-1">총 접촉수(parent → 후보)</div>
                <div className="text-lg font-bold text-gray-200">
                  {af3State.parentAnalysis.contacts.total} ??{af3State.candidateAnalysis.contacts.total}
                </div>
              </div>
            </div>
            <p className="text-[13px] text-gray-600">
              parent 억제제의 원본 mutant 결합 구조와, 이 후보 SMILES로 mutant 서열에 대해 새로 실행한 AF3 결합 구조를 실측 비교한 결과입니다.
            </p>

            {/* AF3가 새로 예측한 후보 복합체 3D 구조 — 위 수치가 어떤 구조에서 나온 것인지 직접 확인 */}
            {af3State.structureFilePath && (
              <div className="pt-2">
                <div className="flex items-center gap-2 mb-2">
                  <Box className="w-4 h-4 text-cyan-400" />
                  <h4 className="text-sm font-bold text-gray-300">AF3 예측 3D 복합체 구조 (후보)</h4>
                </div>
                <StructureViewerPlaceholder
                  structureUrl={af3State.structureFilePath}
                  inhibitorName="설계 유도체 후보"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

function PropertyGrid({ mw, tpsa, clogp, mwDelta, tpsaDelta, clogpDelta }: {
  mw: number; tpsa: number; clogp: number;
  mwDelta?: number; tpsaDelta?: number; clogpDelta?: number;
}) {
  const rows: { label: string; value: number; unit: string; delta?: number }[] = [
    { label: '분자량(MW)', value: mw, unit: '', delta: mwDelta },
    { label: 'TPSA', value: tpsa, unit: ' Å²', delta: tpsaDelta },
    { label: 'cLogP', value: clogp, unit: '', delta: clogpDelta },
  ];
  return (
    <div className="grid grid-cols-3 gap-3">
      {rows.map((r) => {
        const d = r.delta !== undefined ? formatDelta(r.delta, r.unit) : null;
        return (
          <div key={r.label} className="bg-[#0b1020] border border-[#243047] rounded-lg p-3 text-center">
            <div className="text-xs text-gray-500 mb-1">{r.label}</div>
            <div className="text-lg font-bold text-gray-200">{r.value.toFixed(2)}{r.unit}</div>
            {d && <div className={`text-[13px] font-bold mt-0.5 ${d.className}`}>{d.text}</div>}
          </div>
        );
      })}
    </div>
  );
}

function AdmetRow({ admet }: { admet: { status: string; flags: string[] } }) {
  return (
    <div className="flex items-center gap-3 mt-4 flex-wrap">
      <div className={`px-2 py-1 rounded text-xs font-bold ${admet.status === 'Good' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
        ADMET: {admet.status}
      </div>
      {admet.flags.length > 0 && (
        <div className="text-xs text-amber-300">Flags: {admet.flags.join(', ')}</div>
      )}
    </div>
  );
}

export default ReevaluationPage;
