import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Cpu, Dna, ArrowRight, Activity, Zap } from 'lucide-react';
import { EmptyState, ResearchBadge, MetricCard, WorkflowStepper } from '../components/common';
import { INITIAL_INHIBITORS } from '../types/inhibitor';
import { InhibitorCard } from '../components/inhibitor';
import { getJobsList, type JobSummary } from '../api/analysisApi';
import type { WorkflowStepStatus } from '../types/analysis';

// 가장 최근 Job의 실제 상태만으로 계산 가능한 워크플로우 진행 상태
// (스크리닝/최적화/재평가/최종비교 단계는 아직 job 목록 API가 추적하지 않아 정직하게 'not_started'로 둔다)
function deriveWorkflowProgress(job: JobSummary): Partial<Record<string, WorkflowStepStatus>> {
  const af3Done = job.inhibitorCount > 0 && job.completedCount >= job.inhibitorCount;
  const af3Running = job.status.includes('predicting') || job.status.includes('partial_completed');
  return {
    sequence: 'completed',
    mutation: 'completed',
    screening: 'not_started',
    af3: af3Done ? 'completed' : af3Running ? 'running' : job.inhibitorCount > 0 ? 'running' : 'not_started',
    interaction: 'not_started',
    optimization: 'not_started',
    reevaluation: 'not_started',
    final: 'not_started',
  };
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [engineStatus, setEngineStatus] = useState<string>('CHECKING WSL ENGINE...');
  const [jobs, setJobs] = useState<JobSummary[] | null>(null);

  useEffect(() => {
    fetch('http://localhost:8000/api/af3/health')
      .then(res => res.json())
      .then(data => {
        if (data && data.status === 'ok') {
          setEngineStatus(`WSL AF3 READY (${data.gpuName || 'RTX 4070'})`);
        } else {
          setEngineStatus('WSL ENGINE OFFLINE');
        }
      })
      .catch(() => setEngineStatus('WSL ENGINE OFFLINE'));

    getJobsList()
      .then((res) => setJobs(res.jobs))
      .catch(() => setJobs([]));
  }, []);

  const latestJob = jobs && jobs.length > 0 ? jobs[0] : null;
  const totalCompletedStructures = (jobs || []).reduce((sum, j) => sum + j.completedCount, 0);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Welcome Banner */}
      <div className="card-base p-8 bg-[#111827] border-cyan-500/30 shadow-xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -left-10 -top-10 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold border ${engineStatus.includes('READY')
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                }`}>
                {engineStatus}
              </span>
              <ResearchBadge />
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
              SARS-CoV-2 Mpro-Variant Binder
            </h1>
            <p className="text-sm md:text-base text-gray-300 leading-relaxed">
              로컬 Ubuntu AlphaFold3 서버를 활용한 SARS-CoV-2 메인 프로테아제(Mpro, 3CLpro) 변이체 구조 분석 및
              16개 핵심 억제제의 복합체 결합 예측 전문 플랫폼입니다.
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/sequence')}
            className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-bold text-sm flex items-center gap-2.5 shadow-xl shadow-cyan-500/25 transition-all transform hover:-translate-y-0.5 active:translate-y-0 shrink-0"
          >
            <Dna className="w-5 h-5 stroke-[2.5]" />
            <span>+ 신규 분석 시작</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {jobs === null ? null : jobs.length === 0 ? (
        <EmptyState
          title="진행된 변이체 분석 내역이 없습니다"
          description="현재 로컬 데이터베이스 또는 메모리 저장소에 완료된 분석 Job이 없습니다. 우측 상단의 버튼을 눌러 첫 변이 분석을 실행해보세요."
          actionLabel="+ 첫 분석 실행하기"
          onAction={() => navigate('/sequence')}
        />
      ) : (
        <>
          {/* KPI Cards — 실제 job 목록에서 계산 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <MetricCard title="총 분석 Job 수" value={jobs.length} icon={Activity} />
            <MetricCard title="AF3 완료 구조" value={totalCompletedStructures} subtitle="전체 Job 합산" icon={Zap} iconColor="text-amber-400" />
            <MetricCard title="최근 Job 상태" value={latestJob!.mutationLabel} subtitle={latestJob!.status} icon={Dna} iconColor="text-cyan-400" />
          </div>

          {/* Workflow Progress — 가장 최근 Job 기준 */}
          {latestJob && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-gray-100">최근 분석 진행률 ({latestJob.jobId})</h2>
              <WorkflowStepper progress={deriveWorkflowProgress(latestJob)} currentStep="af3" onStepClick={(_, path) => navigate(path)} />
            </div>
          )}
        </>
      )}

      {/* Quick Info Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="card-base p-5 bg-[#0b1020] border-[#243047] flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
            <Dna className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-gray-200">변이 서열 입력 지원</h4>
            <p className="text-xs text-gray-400 mt-0.5">FASTA 전문 또는 L50F/E166A 간편 표기</p>
          </div>
        </div>

        <div className="card-base p-5 bg-[#0b1020] border-[#243047] flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-gray-200">로컬 AF3 가속 연산</h4>
            <p className="text-xs text-gray-400 mt-0.5">Dimer 모드 고정 및 씨드 파라미터 제어</p>
          </div>
        </div>

        <div className="card-base p-5 bg-[#0b1020] border-[#243047] flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-bold text-sm text-gray-200">구조 적합성 상대 비교</h4>
            <p className="text-xs text-gray-400 mt-0.5">Cys145 proximity 및 H-Bond 분석</p>
          </div>
        </div>
      </div>

      {/* Targeted Inhibitor List Overview */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-100">분석 대상 핵심 억제제 {INITIAL_INHIBITORS.length}종</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              논문 흐름 및 연구 목적에 맞춰 구성된 Mpro 표적 후보군입니다. (임의 약효 수치 배제)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {INITIAL_INHIBITORS.map((inhibitor) => (
            <InhibitorCard key={inhibitor.id} inhibitor={inhibitor} selectable={false} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
