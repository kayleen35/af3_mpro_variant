import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, FileText } from 'lucide-react';
import { getAnalysisJob } from '../api/analysisApi';
import type { AnalysisJob } from '../types/analysis';
import { INITIAL_INHIBITORS } from '../types/inhibitor';
import { StructureViewerPlaceholder, ResiduePanel } from '../components/structure';
import { EmptyState, LoadingState, ErrorState, StatusPill } from '../components/common';

export const StructureViewerPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const jobId = searchParams.get('jobId');
  const activeInhibitorId = searchParams.get('inhibitor') || INITIAL_INHIBITORS[0].id;

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
        console.error('Failed to fetch job for viewer:', err);
        setError(
          err?.response?.data?.message ||
            `Job ID (${jobId}) 구조 정보를 불러오지 못했습니다. 로컬 AF3 서버 파일 접근 상태를 확인하세요.`
        );
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [jobId]);

  const handleTabChange = (id: string) => {
    if (jobId) {
      setSearchParams({ jobId, inhibitor: id });
    } else {
      setSearchParams({ inhibitor: id });
    }
  };

  if (!jobId) {
    return (
      <EmptyState
        title="선택된 분석 Job이 없습니다"
        description="구조 뷰어를 실행하기 위해 시퀀스 입력 및 결합 예측을 먼저 진행해주세요."
        actionLabel="시퀀스 입력 페이지 이동"
        onAction={() => navigate('/sequence')}
      />
    );
  }

  if (loading) {
    return (
      <LoadingState
        title="3D 복합체 구조 파일 (mmCIF / PDB) 마운트 중..."
        description="로컬 Ubuntu AF3 서버에서 생성된 Mpro-Variant-Inhibitor 3D 좌표 및 활성부위 기하학 데이터를 불러오고 있습니다."
        step="Loading Structural Coordinates"
      />
    );
  }

  if (error) {
    return (
      <ErrorState
        title="구조 데이터 마운트 실패"
        message={error}
        onRetry={() => window.location.reload()}
      />
    );
  }

  // 활성 억제제 메타데이터 탐색
  const activeInhibitorMeta = INITIAL_INHIBITORS.find((i) => i.id === activeInhibitorId) || INITIAL_INHIBITORS[0];
  const activeInhibitorResult = job?.inhibitors?.find((i) => i.inhibitorId === activeInhibitorId);
  const metrics = activeInhibitorResult?.metrics;

  return (
    <div className="space-y-6 animate-fadeIn flex flex-col min-h-[calc(100vh-12rem)]">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#243047] pb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-cyan-400">JOB ID: {jobId}</span>
            {job && <StatusPill status={job.status} size="sm" />}
          </div>
          <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2.5">
            <Box className="w-7 h-7 text-cyan-400" />
            <span>AlphaFold3 3D 구조 뷰어 ({activeInhibitorMeta.name})</span>
          </h1>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/report?jobId=${jobId}`)}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-violet-600 hover:from-cyan-400 hover:to-violet-500 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-cyan-500/20 transition-all self-start md:self-auto"
        >
          <FileText className="w-4 h-4" />
          <span>최종 연구 보고서 보기</span>
        </button>
      </div>

      {/* Main Content Grid: Left/Center Viewer Placeholder (3 cols) + Right Residue Panel (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1">
        {/* Central Large Viewer Panel */}
        <div className="lg:col-span-3 flex flex-col">
          <StructureViewerPlaceholder
            structureUrl={activeInhibitorResult?.structureFilePath}
            inhibitorName={activeInhibitorMeta.name}
            inhibitorId={activeInhibitorId}
            className="flex-1"
          />
        </div>

        {/* Right Residue Panel */}
        <div className="lg:col-span-1 flex flex-col">
          <ResiduePanel
            metrics={metrics}
            mutations={job?.mutations || []}
            selectedInhibitorName={activeInhibitorMeta.name}
            className="flex-1"
          />
        </div>
      </div>

      {/* Bottom Inhibitor Selection Tabs */}
      <div className="pt-2 border-t border-[#243047]">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5 font-mono">
          대상 억제제 전환 (Ligand Switching Tabs):
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3">
          {INITIAL_INHIBITORS.map((inhibitor) => {
            const isSelected = inhibitor.id === activeInhibitorId;
            const res = job?.inhibitors?.find((i) => i.inhibitorId === inhibitor.id);

            return (
              <button
                key={inhibitor.id}
                type="button"
                onClick={() => handleTabChange(inhibitor.id)}
                className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-cyan-500/15 border-cyan-500/60 shadow-md shadow-cyan-500/10 text-cyan-300'
                    : 'bg-[#0b1020] border-[#243047] hover:bg-[#111827] text-gray-400 hover:text-gray-200'
                }`}
              >
                <div className="flex flex-col items-start gap-1 mb-1.5">
                  <span className="font-bold text-xs truncate w-full" title={inhibitor.name}>{inhibitor.name}</span>
                  {res && <StatusPill status={res.status} size="sm" />}
                </div>
                <span className="text-[15px] font-mono opacity-80 line-clamp-1">
                  {res?.metrics && typeof res.metrics.cys145Distance === 'number'
                    ? `Cys145: ${res.metrics.cys145Distance.toFixed(2)}Å`
                    : '클릭하여 구조 렌더링'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StructureViewerPage;
