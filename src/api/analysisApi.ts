import client from './client';
import type { MutationInput, AnalysisJob } from '../types/analysis';

export interface StructureFileResponse {
  jobId: string;
  inhibitorId: string;
  fileUrl: string;
  filePath?: string;
  format: 'mmcif' | 'pdb' | 'cif';
}

export interface ResearchReportResponse {
  job: AnalysisJob;
  generatedAt: string;
  researchSummary: string;
  exportOptions: {
    pdfAvailable: boolean;
    csvAvailable: boolean;
    chimeraXAvailable: boolean;
  };
}

/**
 * 1. 신규 분석 Job 생성
 * POST /api/analysis
 */
export const createAnalysisJob = async (input: MutationInput): Promise<AnalysisJob> => {
  const response = await client.post<AnalysisJob>('/api/analysis', input);
  return response.data;
};

/**
 * 2. 특정 분석 Job 상태 및 데이터 조회
 * GET /api/analysis/:jobId
 */
export const getAnalysisJob = async (jobId: string): Promise<AnalysisJob> => {
  const response = await client.get<AnalysisJob>(`/api/analysis/${jobId}`);
  return response.data;
};

/**
 * 3. 선택된 억제제 목록에 대한 AlphaFold3 결합 예측 시작
 * POST /api/analysis/:jobId/predict
 */
export const startPrediction = async (
  jobId: string,
  inhibitorIds: string[]
): Promise<AnalysisJob> => {
  const response = await client.post<AnalysisJob>(`/api/analysis/${jobId}/predict`, {
    inhibitorIds,
  });
  return response.data;
};

/**
 * 4. AF3 서버의 결합 예측 진행 상태 조회
 * GET /api/analysis/:jobId/status
 */
export const getPredictionStatus = async (jobId: string): Promise<AnalysisJob> => {
  const response = await client.get<AnalysisJob>(`/api/analysis/${jobId}/status`);
  return response.data;
};

/**
 * 5. AF3 생성 3D 구조 파일 경로 또는 URL 조회
 * GET /api/analysis/:jobId/structure/:inhibitorId
 */
export const getStructureFile = async (
  jobId: string,
  inhibitorId: string
): Promise<StructureFileResponse> => {
  const response = await client.get<StructureFileResponse>(
    `/api/analysis/${jobId}/structure/${inhibitorId}`
  );
  return response.data;
};

/**
 * 6. 종합 연구 보고서 조회
 * GET /api/analysis/:jobId/report
 */
export const getReport = async (jobId: string): Promise<ResearchReportResponse> => {
  const response = await client.get<ResearchReportResponse>(`/api/analysis/${jobId}/report`);
  return response.data;
};
