import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Activity, ArrowRight, Dna, CheckCircle, AlertTriangle } from 'lucide-react';
import { getAnalysisJob } from '../api/analysisApi';
import type { AnalysisJob } from '../types/analysis';
import { EmptyState, LoadingState, ErrorState, StatusPill } from '../components/common';
import { ACTIVE_SITE_RESIDUES } from '../utils/constants';

export const MutationAnalysisPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const jobId = searchParams.get('jobId');

  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [loading, setLoading] = useState<boolean>(!!jobId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      return;
    }

    const fetchJob = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getAnalysisJob(jobId);
        setJob(data);
      } catch (err: any) {
        console.error('Failed to fetch job:', err);
        setError(
          err?.response?.data?.message ||
            `Job ID (${jobId})에 대한 변이 분석 결과를 불러오지 못했습니다. 로컬 AF3 서버 API 상태를 확인하세요.`
        );
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [jobId]);

  if (!jobId) {
    return (
      <EmptyState
        title="선택된 분석 Job이 없습니다"
        description="시퀀스 입력 페이지에서 단백질 변이 서열을 제출하여 새로운 분석 Job을 생성해주세요."
        actionLabel="시퀀스 입력 페이지로 이동"
        onAction={() => navigate('/sequence')}
      />
    );
  }

  if (loading) {
    return (
      <LoadingState
        title="변이 서열 분석 및 정렬 진행 중..."
        description="로컬 AlphaFold3 파이프라인에서 입력된 서열과 Wuhan-Hu-1 Wild-Type 기준 서열 간의 아미노산 변이 지점을 매핑하고 있습니다."
        step="Sequence Alignment & Validation"
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="변이 분석 조회 실패"
        message={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!job) {
    return (
      <EmptyState
        title="분석 데이터를 찾을 수 없습니다"
        description={`요청하신 Job ID (${jobId})의 데이터가 로컬 서버에 존재하지 않습니다.`}
        actionLabel="새 분석 시작"
        onAction={() => navigate('/sequence')}
      />
    );
  }

  const mutations = job.mutations || [];
  const mutantPositions = new Set(mutations.map((m) => m.position));

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Bar / Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#243047] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-cyan-400">JOB ID: {job.jobId}</span>
            <StatusPill status={job.status} size="sm" />
          </div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2.5">
            <Activity className="w-7 h-7 text-cyan-400" />
            <span>변이 분석 결과 요약</span>
          </h1>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/prediction?jobId=${job.jobId}`)}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all self-start md:self-auto"
        >
          <span>결합 예측 설정으로 이동</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Mutations Table Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-100 flex items-center gap-2">
            <Dna className="w-5 h-5 text-violet-400" />
            <span>감지된 아미노산 변이 내역</span>
          </h2>
          <span className="text-xs font-mono px-3 py-1 rounded-full bg-[#141b2d] border border-[#243047] text-gray-300">
            총 {mutations.length}개 변이 잔기
          </span>
        </div>

        {mutations.length > 0 ? (
          <div className="card-base overflow-hidden bg-[#0b1020] border-[#243047]">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#243047] bg-[#141b2d]/60 font-mono text-xs text-gray-400 uppercase tracking-wider">
                  <th className="py-3.5 px-6">잔기 위치 (Position)</th>
                  <th className="py-3.5 px-6">Wild-Type (Wuhan-Hu-1)</th>
                  <th className="py-3.5 px-6">Mutant Residue</th>
                  <th className="py-3.5 px-6">구조적 위치 / 기능 영역</th>
                  <th className="py-3.5 px-6">예상 구조 영향도</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#243047]/60 font-mono text-xs">
                {mutations.map((mut, idx) => (
                  <tr key={idx} className="hover:bg-[#141b2d]/40 transition-colors">
                    <td className="py-4 px-6 font-bold text-cyan-300">Pos #{mut.position}</td>
                    <td className="py-4 px-6 text-gray-400">{mut.wildTypeResidue}</td>
                    <td className="py-4 px-6 font-bold text-rose-400 bg-rose-950/20">{mut.mutantResidue}</td>
                    <td className="py-4 px-6 text-gray-300">{mut.structuralRegion || 'Surface / Loop'}</td>
                    <td className="py-4 px-6 text-gray-400">{mut.expectedEffect || '구조 변화 연산 대기'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="card-base p-8 text-center bg-[#0b1020] border-[#243047] text-gray-400 font-mono text-sm">
            입력된 서열에서 기준 서열 대비 아미노산 변이가 감지되지 않았습니다. (Wild-Type 서열 일치)
          </div>
        )}
      </div>

      {/* Active Site Residue Mapping Grid */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-100">주요 활성부위 및 포켓 잔기 목록</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            SARS-CoV-2 Mpro 활성 포켓(H41, C145 등) 주변의 주요 잔기 상호작용 지점입니다. 변이가 발생한 잔기는 하이라이트 표시됩니다.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {ACTIVE_SITE_RESIDUES.map((item) => {
            const match = item.label.match(/\d+/);
            const pos = match ? parseInt(match[0], 10) : -1;
            const isMutated = mutantPositions.has(pos);

            return (
              <div
                key={item.label}
                className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
                  isMutated
                    ? 'bg-rose-950/40 border-rose-500/60 shadow-md shadow-rose-500/10'
                    : 'bg-[#0b1020] border-[#243047] hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-mono font-bold text-sm ${isMutated ? 'text-rose-300' : 'text-cyan-400'}`}>
                    {item.label}
                  </span>
                  {isMutated ? (
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  )}
                </div>
                <span className="text-[13px] text-gray-400 leading-tight font-mono">{item.role}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default MutationAnalysisPage;
