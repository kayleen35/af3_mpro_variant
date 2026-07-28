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
  inhibitorIds: string[],
  options?: { fullInference?: boolean; seed?: number }
): Promise<AnalysisJob> => {
  // 예측 시작 POST는 즉시 응답을 받아야 하므로 전용 timeout 사용
  // (전역 30초보다 길게 설정해 타임아웃으로 인한 UI 복귀 방지)
  const response = await client.post<AnalysisJob>(`/api/analysis/${jobId}/predict`, {
    inhibitorIds,
    fullInference: options?.fullInference || false,
    seed: options?.seed,
  }, { timeout: 60000 }); // 60초
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

/**
 * 7. 현재 세션 전체 Job 목록 조회 (WT vs Mutant 비교용)
 * GET /api/analysis/jobs
 */
export interface JobSummary {
  jobId: string;
  status: string;
  createdAt: string;
  mutationCount: number;
  mutationLabel: string;  // "WT (야생형 — 변이 없음)" 또는 "E166V/L50F"
  inhibitorCount: number;
  completedCount: number;
}

export const getJobsList = async (): Promise<{ jobs: JobSummary[]; wtSequenceAvailable: boolean }> => {
  const response = await client.get<{ jobs: JobSummary[]; wtSequenceAvailable: boolean }>('/api/analysis/jobs');
  return response.data;
};

// ──────────────────────────────────────────────
// 8. 분자 구조 하이라이트 (Step 7)
// POST /api/molecule/highlight
// ──────────────────────────────────────────────
export interface MoleculeHighlightRequest {
  smiles: string;
  inhibitorId: string;
  contacts: Record<string, unknown>;
  hbonds: Record<string, unknown>;
  buriedArea: Record<string, unknown>;
}

export interface MoleculeHighlightResponse {
  success: boolean;
  svg?: string;           // 전체 하이라이트된 2D SVG 문자열
  svgProblemOnly?: string;// 취약/미결합 부위만 하이라이트된 2D SVG 문자열
  smilesTokens?: any[];
  atomGroups?: {
    warheadAtoms: number[];
    p1Atoms: number[];
    p2Atoms: number[];
    highlightedCount: number;
  };
  legend?: { color: string; label: string }[];
  error?: string;
}

export const getMoleculeHighlight = async (
  payload: MoleculeHighlightRequest
): Promise<MoleculeHighlightResponse> => {
  const response = await client.post<MoleculeHighlightResponse>(
    '/api/molecule/highlight',
    payload,
    { timeout: 30000 }
  );
  return response.data;
};

// WT 대비 Mutant에서 결합이 약해진/개선된 부위만 하이라이트 (잔기 단위 비교)
export interface MoleculeHighlightDiffRequest {
  mode: 'diff';
  smiles: string;
  inhibitorId: string;
  wtContacts: Record<string, unknown>;
  wtHbonds: Record<string, unknown>;
  mutContacts: Record<string, unknown>;
  mutHbonds: Record<string, unknown>;
}

export interface MoleculeHighlightDiffResponse {
  success: boolean;
  svg?: string;
  regionDiff?: Record<string, { quality: string; color: string | null; reason: string }>;
  legend?: { color: string; label: string }[];
  error?: string;
}

export const getMoleculeHighlightDiff = async (
  payload: Omit<MoleculeHighlightDiffRequest, 'mode'>
): Promise<MoleculeHighlightDiffResponse> => {
  const response = await client.post<MoleculeHighlightDiffResponse>(
    '/api/molecule/highlight',
    { mode: 'diff', ...payload },
    { timeout: 30000 }
  );
  return response.data;
};

// 하이라이트 없이 깨끗한 2D 구조만 (WT 기준 참고용)
export interface MoleculeHighlightPlainResponse {
  success: boolean;
  svg?: string;
  error?: string;
}

export const getMoleculeHighlightPlain = async (
  smiles: string
): Promise<MoleculeHighlightPlainResponse> => {
  const response = await client.post<MoleculeHighlightPlainResponse>(
    '/api/molecule/highlight',
    { mode: 'plain', smiles },
    { timeout: 30000 }
  );
  return response.data;
};

// 후보 SMILES에 지정 pharmacophore 영역(warhead/p1/p2)의 특징적 구조가 아직
// 남아있는지 확인 (Stage 3에서 "손실 부위를 실제로 고쳤는지" 실시간 체크용)
export interface RegionCheckResponse {
  success: boolean;
  regionPresence?: Record<string, boolean>;
  error?: string;
}

export const checkRegionPresence = async (
  smiles: string,
  regions: string[]
): Promise<RegionCheckResponse> => {
  const response = await client.post<RegionCheckResponse>(
    '/api/molecule/highlight',
    { mode: 'check_regions', smiles, regions },
    { timeout: 15000 }
  );
  return response.data;
};

// ──────────────────────────────────────────────
// 9. 유도체 후보 AF3 재결합 (STAGE 4) — 실제 GPU 추론으로
//    structuralInteractionRecovery를 실측 값으로 채운다
// ──────────────────────────────────────────────
export interface Af3RebindStructureSummary {
  hbonds: { count: number };
  contacts: { total: number };
}

export interface Af3RebindState {
  status: 'running' | 'analyzing' | 'completed' | 'failed' | 'timeout';
  af3InhibitorId?: string;
  structureFilePath?: string;
  structuralInteractionRecovery?: 'improved' | 'similar' | 'worsened' | 'unresolved';
  parentAnalysis?: Af3RebindStructureSummary;
  candidateAnalysis?: Af3RebindStructureSummary;
  error?: string;
}

export const startAf3Rebind = async (jobId: string, candidateId: string): Promise<Af3RebindState> => {
  const response = await client.post<Af3RebindState>(
    `/api/analysis/${jobId}/reevaluate/af3`,
    { candidateId }
  );
  return response.data;
};

export const getAf3RebindStatus = async (jobId: string, candidateId: string): Promise<Af3RebindState> => {
  const response = await client.get<Af3RebindState>(
    `/api/analysis/${jobId}/reevaluate/af3/${candidateId}`
  );
  return response.data;
};
