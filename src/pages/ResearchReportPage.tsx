import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FileText, Download, ShieldAlert, CheckCircle2, AlertTriangle, ArrowLeft } from 'lucide-react';
import { getReport } from '../api/analysisApi';
import type { AnalysisJob } from '../types/analysis';
import { EmptyState, LoadingState, ErrorState, StatusPill, ResearchBadge } from '../components/common';

export const ResearchReportPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const jobId = searchParams.get('jobId');

  const [job, setJob] = useState<AnalysisJob | null>(null);
  const [summaryText, setSummaryText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(!!jobId);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId) {
      setLoading(false);
      return;
    }

    const fetchReportData = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getReport(jobId);
        setJob(data.job);
        setSummaryText(data.researchSummary || '종합 보고서 생성 완료 (로컬 Ubuntu AlphaFold3 파이프라인)');
      } catch (err: any) {
        console.error('Failed to fetch report:', err);
        setError(
          err?.response?.data?.message ||
            `Job ID (${jobId}) 연구 보고서 요약을 생성하는 중 오류가 발생했습니다. 백엔드 통신 상태를 확인하세요.`
        );
      } finally {
        setLoading(false);
      }
    };

    fetchReportData();
  }, [jobId]);

  if (!jobId) {
    return (
      <EmptyState
        title="선택된 분석 Job이 없습니다"
        description="최종 연구 보고서를 조회하려면 시퀀스 입력 및 억제제 결합 예측을 먼저 진행해주세요."
        actionLabel="신규 분석 시작"
        onAction={() => navigate('/sequence')}
      />
    );
  }

  if (loading) {
    return (
      <LoadingState
        title="최종 종합 연구 보고서 생성 중..."
        description="변이 내역과 억제제 결합 예측 지표를 집합하여 인쇄 및 데이터 내보내기용 문서를 편성하고 있습니다."
        step="Compiling Structural Research Report"
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="보고서 생성 실패"
        message={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!job) {
    return (
      <EmptyState
        title="보고서 데이터가 없습니다"
        description={`요청하신 Job ID (${jobId})에 대한 정보가 없습니다.`}
        actionLabel="새 분석 시작"
        onAction={() => navigate('/sequence')}
      />
    );
  }

  const mutations = job.mutations || [];
  const inhibitors = job.inhibitors || [];

  return (
    <div className="space-y-8 animate-fadeIn max-w-5xl mx-auto">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#243047] pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(`/viewer?jobId=${jobId}`)}
            className="p-2 rounded-xl bg-[#141b2d] border border-[#243047] hover:border-gray-600 text-gray-400 hover:text-gray-200 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-cyan-400">JOB ID: {job.jobId}</span>
              <StatusPill status={job.status} size="sm" />
            </div>
            <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2.5">
              <FileText className="w-7 h-7 text-cyan-400" />
              <span>SARS-CoV-2 Mpro-Variant 종합 연구 보고서</span>
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start md:self-auto">
          <ResearchBadge />
        </div>
      </div>

      {/* Export Action Toolbar (Disabled / Ready State) */}
      <div className="card-base p-5 bg-[#0b1020] border-[#243047] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-sm text-gray-200">연구 결과 데이터 내보내기</h3>
          <p className="text-xs text-gray-400 mt-0.5 font-mono">
            * 실제 파일 다운로드 및 스크립트 출력 기능은 현재 준비 중(Disabled) 상태입니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            type="button"
            disabled
            title="현재 준비 중인 내보내기 기능입니다."
            className="flex-1 md:flex-none px-4 py-2 rounded-xl bg-[#141b2d] border border-[#243047] text-gray-400 text-xs font-medium flex items-center justify-center gap-2 cursor-not-allowed opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            <span>PDF 보고서 내보내기 (준비중)</span>
          </button>
          <button
            type="button"
            disabled
            title="현재 준비 중인 내보내기 기능입니다."
            className="flex-1 md:flex-none px-4 py-2 rounded-xl bg-[#141b2d] border border-[#243047] text-gray-400 text-xs font-medium flex items-center justify-center gap-2 cursor-not-allowed opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV 데이터 내보내기 (준비중)</span>
          </button>
          <button
            type="button"
            disabled
            title="현재 준비 중인 내보내기 기능입니다."
            className="flex-1 md:flex-none px-4 py-2 rounded-xl bg-[#141b2d] border border-[#243047] text-gray-400 text-xs font-medium flex items-center justify-center gap-2 cursor-not-allowed opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            <span>ChimeraX Script (준비중)</span>
          </button>
        </div>
      </div>

      {/* Section 1: Overview Summary */}
      <div className="card-base p-6 bg-[#0b1020] border-[#243047] space-y-4">
        <h2 className="text-lg font-bold text-gray-100 border-b border-[#243047] pb-2.5">
          1. 분석 개요 및 메타데이터
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
          <div className="p-3 rounded-xl bg-[#141b2d] border border-[#243047]">
            <span className="text-gray-400 block mb-1">Target Complex</span>
            <span className="font-bold text-cyan-300 text-sm">SARS-CoV-2 Mpro Homodimer</span>
          </div>
          <div className="p-3 rounded-xl bg-[#141b2d] border border-[#243047]">
            <span className="text-gray-400 block mb-1">Execution Pipeline</span>
            <span className="font-bold text-violet-300 text-sm">Local Ubuntu AlphaFold3</span>
          </div>
          <div className="p-3 rounded-xl bg-[#141b2d] border border-[#243047]">
            <span className="text-gray-400 block mb-1">Total Mutated Residues</span>
            <span className="font-bold text-rose-300 text-sm">{mutations.length} AA</span>
          </div>
        </div>
        {summaryText && (
          <p className="text-xs text-gray-300 leading-relaxed font-mono bg-[#141b2d]/50 p-3.5 rounded-xl border border-[#243047]">
            {summaryText}
          </p>
        )}
      </div>

      {/* Section 2: Mutations Summary Table */}
      <div className="card-base p-6 bg-[#0b1020] border-[#243047] space-y-4">
        <h2 className="text-lg font-bold text-gray-100 border-b border-[#243047] pb-2.5">
          2. 입력 변이체 서열 분석 내역 ({mutations.length}건)
        </h2>
        {mutations.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-[#243047]">
            <table className="w-full text-left border-collapse text-xs font-mono">
              <thead>
                <tr className="bg-[#141b2d] text-gray-400 uppercase border-b border-[#243047]">
                  <th className="py-2.5 px-4">Residue Position</th>
                  <th className="py-2.5 px-4">Wild-Type AA</th>
                  <th className="py-2.5 px-4">Mutant AA</th>
                  <th className="py-2.5 px-4">Structural Region</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#243047]/60 text-gray-300">
                {mutations.map((m, i) => (
                  <tr key={i} className="hover:bg-[#141b2d]/40">
                    <td className="py-2.5 px-4 font-bold text-cyan-300">#{m.position}</td>
                    <td className="py-2.5 px-4">{m.wildTypeResidue}</td>
                    <td className="py-2.5 px-4 font-bold text-rose-400">{m.mutantResidue}</td>
                    <td className="py-2.5 px-4 text-gray-400">{m.structuralRegion || 'Surface / Loop'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-gray-400 font-mono">
            입력된 서열에 Wild-Type 기준 아미노산 변이가 감지되지 않았습니다.
          </p>
        )}
      </div>

      {/* Section 3: Inhibitor Modeling Summary */}
      <div className="card-base p-6 bg-[#0b1020] border-[#243047] space-y-4">
        <h2 className="text-lg font-bold text-gray-100 border-b border-[#243047] pb-2.5">
          3. 핵심 억제제 결합 예측 기하 지표
        </h2>
        <div className="overflow-hidden rounded-xl border border-[#243047]">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-[#141b2d] text-gray-400 uppercase border-b border-[#243047]">
                <th className="py-2.5 px-4">Inhibitor Name</th>
                <th className="py-2.5 px-4">Job Status</th>
                <th className="py-2.5 px-4">Cys145 Proximity</th>
                <th className="py-2.5 px-4">H-Bond Count</th>
                <th className="py-2.5 px-4">Steric Clash</th>
                <th className="py-2.5 px-4">Pose Consistency (RMSD)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#243047]/60 text-gray-300">
              {inhibitors.length > 0 ? (
                inhibitors.map((inh) => (
                  <tr key={inh.inhibitorId} className="hover:bg-[#141b2d]/40">
                    <td className="py-3 px-4 font-bold text-gray-100">{inh.name}</td>
                    <td className="py-3 px-4">
                      <StatusPill status={inh.status} size="sm" />
                    </td>
                    <td className="py-3 px-4 text-cyan-300 font-bold">
                      {inh.metrics && typeof inh.metrics.cys145Distance === 'number'
                        ? `${inh.metrics.cys145Distance.toFixed(2)} Å`
                        : '-'}
                    </td>
                    <td className="py-3 px-4 text-violet-300 font-bold">
                      {inh.metrics && typeof inh.metrics.hBondCount === 'number'
                        ? `${inh.metrics.hBondCount}`
                        : '-'}
                    </td>
                    <td className="py-3 px-4">
                      {inh.metrics?.stericClash === 'Yes' || inh.metrics?.stericClash === '감지됨' ? (
                        <span className="text-rose-400 flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" /> Yes
                        </span>
                      ) : (
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> No
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sky-300">
                      {inh.metrics && typeof inh.metrics.poseConsistencyRmsd === 'number'
                        ? `${inh.metrics.poseConsistencyRmsd.toFixed(2)} Å`
                        : '-'}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-gray-500">
                    아직 생성된 억제제 결합 예측 결과가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Highlighted Research Use Only Warning Notice */}
      <div className="p-6 rounded-2xl bg-[#0b1020] border-2 border-amber-500/50 shadow-xl flex items-start gap-4">
        <div className="w-12 h-12 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
          <ShieldAlert className="w-7 h-7 stroke-[1.75]" />
        </div>
        <div className="space-y-2">
          <h3 className="font-extrabold text-base text-amber-300 tracking-tight">
            IMPORTANT WARNING: RESEARCH USE ONLY (연구 전용 경고 문구)
          </h3>
          <p className="text-xs md:text-sm text-amber-200/90 leading-relaxed font-mono">
            본 연구 보고서 및 3D 구조 좌표는 로컬 Ubuntu AlphaFold3 서버의 인실리코(In-silico) 컴퓨터 모델링 연산
            결과입니다. 이 플랫폼과 제공되는 데이터는 오직 기초 연구 및 항바이러스제 후보물질 탐색 목적으로만
            설계되었습니다. <strong>임상 진단, 환자 치료, 약물 투여 등 의료 및 임상 목적에 절대 사용할 수 없습니다.</strong>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ResearchReportPage;
