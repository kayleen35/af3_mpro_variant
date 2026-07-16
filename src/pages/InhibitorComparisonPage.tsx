import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { BarChart2, Box, ShieldAlert, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';
import { getAnalysisJob } from '../api/analysisApi';
import type { AnalysisJob } from '../types/analysis';
import { EmptyState, LoadingState, ErrorState, StatusPill } from '../components/common';

export const InhibitorComparisonPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const jobId = searchParams.get('jobId');
  const elapsedSec = Number(searchParams.get('elapsed') || 0);
  const elapsedMin = Math.floor(elapsedSec / 60);
  const elapsedRemSec = elapsedSec % 60;

  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [loading, setLoading] = useState<boolean>(!!jobId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      return;
    }

    let intervalId: any;

    const fetchJob = async (silent = false) => {
      if (!silent) setLoading(true);
      setError(null);
      try {
        const data = await getAnalysisJob(jobId);
        setJob(data);
      } catch (err: any) {
        console.error('Failed to fetch job:', err);
        if (!silent) {
          setError(
            err?.response?.data?.message ||
              `Job ID (${jobId})의 예측 비교 정보를 조회할 수 없습니다. 서버 응답을 확인하세요.`
          );
        }
      } finally {
        if (!silent) setLoading(false);
      }
    };

    fetchJob();
    intervalId = setInterval(() => {
      fetchJob(true);
    }, 2000);

    return () => clearInterval(intervalId);
  }, [jobId]);

  if (!jobId) {
    return (
      <EmptyState
        title="선택된 분석 Job이 없습니다"
        description="억제제 결합 예측을 먼저 실행하여 비교 데이터를 생성해주세요."
        actionLabel="결합 예측 설정으로 이동"
        onAction={() => navigate('/sequence')}
      />
    );
  }

  if (loading) {
    return (
      <LoadingState
        title="억제제 구조 비교 연산 및 지표 추출 중..."
        description="선택된 억제제와 Mpro Dimer 복합체의 AlphaFold3 예측 결과를 불러오고 있습니다."
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="비교 데이터 로드 실패"
        message={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!job || !job.inhibitors || job.inhibitors.length === 0) {
    return (
      <EmptyState
        title="억제제 비교 데이터가 아직 없습니다"
        description="현재 Job에 포함된 억제제 예측 결과가 없습니다. 결합 예측 페이지에서 억제제 모델링을 실행해주세요."
        actionLabel="결합 예측 실행하기"
        onAction={() => navigate(`/prediction?jobId=${jobId}`)}
      />
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#243047] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-cyan-400">JOB ID: {jobId}</span>
            <StatusPill status={job.status} size="sm" />
            {elapsedSec > 0 && (
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-300">
                ⏱ 총 연산 시간: {elapsedMin > 0 ? `${elapsedMin}분 ` : ''}{elapsedRemSec}초
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2.5">
            <BarChart2 className="w-7 h-7 text-cyan-400" />
            <span>5개 억제제 구조 적합성 상대 비교</span>
          </h1>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/viewer?jobId=${jobId}&inhibitor=nirmatrelvir`)}
          className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all self-start md:self-auto"
        >
          <Box className="w-4 h-4" />
          <span>3D 구조 뷰어 열기</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Warning Notice */}
      <div className="p-4 rounded-xl bg-violet-950/30 border border-violet-500/40 flex items-start gap-3 text-xs text-violet-200">
        <ShieldAlert className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <span className="font-bold block text-violet-300">
            임의 약효 수치 및 불확실한 IC50 배제 안내
          </span>
          <span>
            본 화면의 지표는 AlphaFold3가 예측한 3D 복합체 포즈의 기하학적 매개변수(Cys145 근접도, 수소결합 수,
            입체 충돌 여부 등)만을 제공합니다. 생체 외/임상 약효를 나타내는 임의의 IC50, Ki 수치는 절대 삽입되지
            않습니다.
          </span>
        </div>
      </div>

      {/* Comparison Grid Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {job.inhibitors.map((item) => {
          const metrics = item.metrics;

          return (
            <div
              key={item.inhibitorId}
              className="card-base p-5 bg-[#0b1020] border-[#243047] flex flex-col justify-between space-y-4 hover:border-cyan-500/50 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-base text-gray-100">{item.name}</h3>
                  <StatusPill status={item.status} size="sm" />
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#141b2d] text-gray-400 border border-[#243047]">
                  ID: {item.inhibitorId}
                </span>
              </div>

              {/* Metrics Display or Pending State */}
              {metrics ? (
                <div className="space-y-2.5 pt-2 border-t border-[#243047]/60 text-xs font-mono">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Ranking Score:</span>
                    <span className={`font-bold ${(metrics.rankingScore ?? 0) > 0.5 ? 'text-emerald-300' : (metrics.rankingScore ?? 0) > 0.3 ? 'text-yellow-300' : 'text-rose-300'}`}>
                      {typeof metrics.rankingScore === 'number'
                        ? metrics.rankingScore.toFixed(4)
                        : '연산 대기'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">ipTM (interface):</span>
                    <span className="font-bold text-cyan-300">
                      {typeof metrics.iptm === 'number'
                        ? metrics.iptm.toFixed(4)
                        : '연산 대기'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">pTM (predicted):</span>
                    <span className="font-bold text-violet-300">
                      {typeof metrics.ptm === 'number'
                        ? metrics.ptm.toFixed(4)
                        : '연산 대기'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Ligand ipTM (avg):</span>
                    <span className={`font-bold ${(metrics.ligandIptm ?? 0) > 0.3 ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {typeof metrics.ligandIptm === 'number'
                        ? metrics.ligandIptm.toFixed(4)
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Ligand PAE (Chain A→C):</span>
                    <span className={`font-bold ${(metrics.ligandPaeA ?? 30) < 15 ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {typeof metrics.ligandPaeA === 'number'
                        ? `${metrics.ligandPaeA.toFixed(2)} Å`
                        : 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Steric Clash:</span>
                    <span className="flex items-center gap-1">
                      {(metrics.hasClash ?? 0) > 0 ? (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          <span className="text-rose-400">감지됨 ({(metrics.hasClash * 100).toFixed(1)}%)</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="text-emerald-400">없음 (Clean)</span>
                        </>
                      )}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-gray-500 font-mono border-t border-[#243047]/60">
                  현재 모델링 완료 후 3D 기하 구조 지표를 산출하고 있습니다.
                </div>
              )}

              <div className="pt-3 border-t border-[#243047]">
                <button
                  type="button"
                  onClick={() => navigate(`/viewer?jobId=${jobId}&inhibitor=${item.inhibitorId}`)}
                  className="w-full py-2 px-3 rounded-lg bg-[#141b2d] hover:bg-[#1f293d] text-cyan-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Box className="w-3.5 h-3.5" />
                  <span>이 억제제 포즈 3D 보기</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Comparison Table */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-gray-100">종합 비교 테이블</h2>
        <div className="card-base overflow-hidden bg-[#0b1020] border-[#243047]">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="border-b border-[#243047] bg-[#141b2d]/60 text-gray-400 uppercase">
                <th className="py-3 px-4">Inhibitor Name</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Cys145 Proximity</th>
                <th className="py-3 px-4">H-Bonds</th>
                <th className="py-3 px-4">E166/F167 Shift</th>
                <th className="py-3 px-4">Steric Clash</th>
                <th className="py-3 px-4">RMSD vs WT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#243047]/60 text-gray-300">
              {job.inhibitors.map((item) => (
                <tr key={item.inhibitorId} className="hover:bg-[#141b2d]/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-gray-100">{item.name}</td>
                  <td className="py-3.5 px-4">
                    <StatusPill status={item.status} size="sm" />
                  </td>
                  <td className="py-3.5 px-4 text-cyan-300 font-bold">
                    {item.metrics && typeof item.metrics.cys145Distance === 'number'
                      ? `${item.metrics.cys145Distance.toFixed(2)} Å`
                      : '-'}
                  </td>
                  <td className="py-3.5 px-4 text-violet-300 font-bold">
                    {item.metrics && typeof item.metrics.hBondCount === 'number'
                      ? `${item.metrics.hBondCount}`
                      : '-'}
                  </td>
                  <td className="py-3.5 px-4 text-gray-400">
                    {item.metrics?.a166f167Interaction || '-'}
                  </td>
                  <td className="py-3.5 px-4">
                    {item.metrics?.stericClash === 'Yes' || item.metrics?.stericClash === '감지됨' ? (
                      <span className="text-rose-400">Yes</span>
                    ) : (
                      <span className="text-emerald-400">No</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-sky-300">
                    {item.metrics && typeof item.metrics.poseConsistencyRmsd === 'number'
                      ? `${item.metrics.poseConsistencyRmsd.toFixed(2)} Å`
                      : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default InhibitorComparisonPage;
