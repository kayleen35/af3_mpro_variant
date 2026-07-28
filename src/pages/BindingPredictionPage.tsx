import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Zap, Play, Lock, Hash, ShieldCheck, CheckSquare, Square } from 'lucide-react';
import { startPrediction, getPredictionStatus } from '../api/analysisApi';
import { INITIAL_INHIBITORS } from '../types/inhibitor';
import { InhibitorCard } from '../components/inhibitor';
import { EmptyState, LoadingState } from '../components/common';

// sessionStorage 키 헬퍼
const STORAGE_KEY = (jobId: string) => `af3_predict_${jobId}`;

export const BindingPredictionPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const jobId = searchParams.get('jobId');

  // 페이지 리로드 시 sessionStorage에서 상태 복구
  const savedState = jobId ? sessionStorage.getItem(STORAGE_KEY(jobId)) : null;
  const parsed = savedState ? (() => { try { return JSON.parse(savedState); } catch { return null; } })() : null;

  const [selectedIds, setSelectedIds] = useState<string[]>(
    INITIAL_INHIBITORS.map((i) => i.id)
  );
  const [seed, setSeed] = useState<string>('');
  const [fullInference] = useState<boolean>(true);

  // isPredicting이 true면 폴링 루프 useEffect가 자동 실행됨
  const [isPredicting, setIsPredicting] = useState<boolean>(parsed?.isPredicting ?? false);
  const [pollingStep, setPollingStep] = useState<string>(parsed?.pollingStep ?? '초기화 중');
  const [error, setError] = useState<string | null>(null);

  // startTime은 ref로 관리 (렌더 트리거 없이 갱신)
  const startTimeRef = useRef<number>(parsed?.startTime ?? Date.now());
  // 폴링 루프 중단 플래그
  const stopPollingRef = useRef<boolean>(false);

  const handleToggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === INITIAL_INHIBITORS.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(INITIAL_INHIBITORS.map((i) => i.id));
    }
  };

  // sessionStorage에 현재 상태 저장
  const persistState = useCallback((step: string) => {
    if (!jobId) return;
    sessionStorage.setItem(
      STORAGE_KEY(jobId),
      JSON.stringify({ isPredicting: true, pollingStep: step, startTime: startTimeRef.current })
    );
  }, [jobId]);

  const clearPersistedState = useCallback(() => {
    if (jobId) sessionStorage.removeItem(STORAGE_KEY(jobId));
  }, [jobId]);

  // ─────────────────────────────────────────────
  // 폴링 루프: isPredicting이 true인 동안 실행
  // startPrediction과 완전히 분리된 useEffect로 관리
  // → handleStartPrediction의 catch가 폴링 에러를 삼키는 문제 원천 차단
  // ─────────────────────────────────────────────
  useEffect(() => {
    if (!isPredicting || !jobId) return;

    stopPollingRef.current = false;
    let rafId: ReturnType<typeof setTimeout>;

    const poll = async () => {
      const POLL_INTERVAL = 10000; // 10초

      while (!stopPollingRef.current) {
        await new Promise((r) => { rafId = setTimeout(r, POLL_INTERVAL); });
        if (stopPollingRef.current) break;

        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;

        try {
          const statusRes = await getPredictionStatus(jobId);

          if (statusRes?.status === 'completed' || statusRes?.status?.startsWith('partial_completed')) {
            const totalSec = Math.floor((Date.now() - startTimeRef.current) / 1000);
            const totalMin = Math.floor(totalSec / 60);
            const remSec = totalSec % 60;
            const isPartial = statusRes.status?.startsWith('partial_completed');
            const doneMsg = isPartial
              ? `✅ 일부 억제제 구조 생성 완료! (총 ${totalMin}분 ${remSec}초 소요) — 부분 결과 페이지로 이동합니다...`
              : `✅ 3D 구조 생성 완료! (총 ${totalMin}분 ${remSec}초 소요) — 결과 페이지로 이동합니다...`;
            setPollingStep(doneMsg);
            clearPersistedState();
            await new Promise((r) => setTimeout(r, 1200));
            navigate(`/comparison?jobId=${jobId}&elapsed=${totalSec}`);
            return;
          }

          if (statusRes?.status === 'timeout') {
            setError('GPU 연산 시간이 초과되었습니다. WSL 내 로그를 확인해주세요.');
            clearPersistedState();
            setIsPredicting(false);
            return;
          }
        } catch (_) {
          // 네트워크 에러 — 계속 polling (화면 복귀 없음)
        }

        const stepMsg = `GPU 연산 진행 중... (${minutes}분 ${seconds}초 경과) — 단백질 구조 폴딩 및 리간드 도킹 수행 중`;
        setPollingStep(stepMsg);
        persistState(stepMsg);
      }
    };

    poll().catch((err) => {
      // 폴링 루프 자체의 예상치 못한 에러 — 에러 메시지만 표시, 화면 복귀 안 함
      console.error('[Polling] Unexpected error:', err);
    });

    return () => {
      stopPollingRef.current = true;
      clearTimeout(rafId);
    };
  }, [isPredicting, jobId, navigate, persistState, clearPersistedState]);

  // ─────────────────────────────────────────────
  // 예측 시작: POST만 담당 (폴링은 useEffect가 맡음)
  // ─────────────────────────────────────────────
  const handleStartPrediction = async () => {
    if (!jobId) return;
    if (selectedIds.length === 0) {
      setError('최소 1개 이상의 억제제를 선택해야 결합 예측을 시작할 수 있습니다.');
      return;
    }

    setError(null);

    startTimeRef.current = Date.now();
    const initStep = 'WSL Ubuntu AlphaFold 3 엔진에 예측 요청 전송 중...';

    try {
      // POST 요청 — 성공/실패와 무관하게 여기서만 에러 처리
      await startPrediction(jobId, selectedIds, {
        fullInference,
        seed: seed ? Number(seed) : undefined,
      });

      // POST 성공 → isPredicting = true → useEffect 폴링 루프 자동 시작
      persistState(initStep);
      setPollingStep(initStep);
      setIsPredicting(true);
    } catch (err: any) {
      // POST 자체 실패 시에만 에러 표시 (폴링 에러는 여기 도달하지 않음)
      console.error('Prediction start error:', err);
      setError(
        err?.response?.data?.message ||
          '로컬 Ubuntu AF3 예측 파이프라인 호출에 실패했습니다. 서버 컨테이너가 실행 중인지 확인하세요.'
      );
    }
  };

  if (!jobId) {
    return (
      <EmptyState
        title="분석 Job이 지정되지 않았습니다"
        description="시퀀스 입력 페이지에서 변이 정보를 먼저 제출하여 Job ID를 획득해주세요."
        actionLabel="시퀀스 입력 페이지 이동"
        onAction={() => navigate('/sequence')}
      />
    );
  }

  if (isPredicting) {
    return (
      <LoadingState
        title="AlphaFold3 억제제 결합 예측 실행 중..."
        description={`선택된 ${selectedIds.length || 16}개 억제제(Nirmatrelvir, GC376 등)와 Mpro Dimer 복합체 간의 3D 구조 및 상호작용을 병렬 연산하고 있습니다.`}
        step={pollingStep}
      />
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Header */}
      <div className="border-b border-[#243047] pb-4">
        <div className="flex items-center gap-2 mb-1 text-xs font-mono text-cyan-400">
          <span>JOB ID: {jobId}</span>
          <span>&bull;</span>
          <span>MODE: COMPLEX PREDICTION</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2.5">
          <Zap className="w-7 h-7 text-cyan-400" />
          <span>억제제 결합 예측 설정</span>
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          분석 대상 억제제 리가нд를 선택하고 로컬 AlphaFold3 파이프라인 실행 파라미터를 설정합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left 2 Cols: Inhibitor Selection */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-100">분석 대상 억제제 선택</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                기본적으로 5개 핵심 억제제가 모두 선택되어 있습니다. (임의의 약효/IC50 수치 제외)
              </p>
            </div>
            <button
              type="button"
              onClick={handleSelectAll}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#141b2d] border border-[#243047] hover:border-gray-600 text-xs text-gray-300 font-mono transition-colors"
            >
              {selectedIds.length === INITIAL_INHIBITORS.length ? (
                <>
                  <CheckSquare className="w-4 h-4 text-cyan-400" />
                  <span>전체 해제</span>
                </>
              ) : (
                <>
                  <Square className="w-4 h-4 text-gray-500" />
                  <span>전체 선택</span>
                </>
              )}
            </button>
          </div>

          <div className="space-y-3">
            {INITIAL_INHIBITORS.map((inhibitor) => (
              <InhibitorCard
                key={inhibitor.id}
                inhibitor={inhibitor}
                selected={selectedIds.includes(inhibitor.id)}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </div>

        {/* Right Col: AF3 Execution Parameters & Submit */}
        <div className="space-y-6">
          <div className="card-base p-6 bg-[#0b1020] border-[#243047] space-y-6">
            <div className="flex items-center gap-2 border-b border-[#243047] pb-3">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <h3 className="font-bold text-sm text-gray-100">AlphaFold3 실행 옵션</h3>
            </div>

            {/* Mpro Dimer Mode Fixed */}
            <div className="p-4 rounded-xl bg-[#141b2d]/80 border border-cyan-500/30 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-gray-200">Mpro Dimer Mode</span>
                <span className="inline-flex items-center gap-1 text-[13px] font-mono text-cyan-400 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-500/40">
                  <Lock className="w-3 h-3" />
                  <span>고정값</span>
                </span>
              </div>
              <p className="text-[13px] text-gray-400 leading-relaxed">
                SARS-CoV-2 Mpro는 Homodimer 복합체에서 촉매 기질 결합 능력이 발생하므로, 다이머 모델링 모드가 필수
                고정됩니다.
              </p>
            </div>

            {/* WSL Ubuntu GPU Engine Execution */}
            <div className="p-4 rounded-xl bg-[#141b2d] border border-violet-500/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-violet-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-violet-400" />
                  <span>WSL Ubuntu AlphaFold 3 GPU 모델링</span>
                </span>
                <span className="text-[13px] font-mono px-2 py-0.5 rounded bg-violet-950/80 text-violet-300 border border-violet-500/50 font-bold">
                  RTX 4070
                </span>
              </div>
              <p className="text-[13px] text-gray-300 leading-relaxed">
                입력된 단백질 서열이 WSL Ubuntu 서버로 전송되어 정식 입력 파일(JSON)을 생성한 후, 로컬 GPU(NVIDIA RTX 4070) 및 PyTorch/JAX 엔진으로 실제 3D 복합체 구조를 신규 모델링합니다.
              </p>
            </div>

            {/* Optional Seed Input */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5 font-mono">
                <Hash className="w-3.5 h-3.5 text-violet-400" />
                <span>Random Seed 값 (선택 사항)</span>
              </label>
              <input
                type="number"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="예: 42 (재현 가능한 연산 필요 시)"
                className="w-full px-4 py-3 rounded-xl bg-[#141b2d] border border-[#243047] text-gray-100 font-mono text-xs placeholder:text-gray-600 focus:outline-none focus:border-cyan-500 transition-colors"
              />
              <p className="text-[13px] text-gray-500 font-mono">
                * 비워둘 경우 로컬 AF3 서버에서 임의 시드가 자동 할당됩니다.
              </p>
            </div>

            {error && (
              <div className="p-3.5 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-300 text-xs font-mono leading-relaxed">
                {error}
              </div>
            )}

            <div className="pt-2">
              <button
                type="button"
                onClick={handleStartPrediction}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-cyan-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
              >
                <span>억제제 결합 예측 실행 ({selectedIds.length}종)</span>
                <Play className="w-4 h-4 fill-current" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BindingPredictionPage;
