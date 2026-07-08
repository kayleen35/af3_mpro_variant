import client from '../api/client';
import type { MutationInput, AnalysisStatus, BindingMetrics } from '../types/analysis';

/**
 * 로컬 Ubuntu AlphaFold3 실행 서버 URL
 * 기본값: http://localhost:8000 (환경변수 VITE_AF3_SERVER_URL 또는 VITE_API_BASE_URL로 Overriding 가능)
 */
export const AF3_SERVER_URL =
  import.meta.env.VITE_AF3_SERVER_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface PreparedSequenceResponse {
  sequenceId: string;
  validatedFasta: string;
  dimerTemplate: string;
  residueCount: number;
}

export interface Af3JobSubmissionResponse {
  jobId: string;
  status: AnalysisStatus;
  submittedAt: string;
  serverContainerId?: string;
}

export interface Af3StatusPollingResponse {
  jobId: string;
  status: AnalysisStatus;
  progress: number;
  currentStep: string;
  errorMessage?: string;
}

export interface Af3StructureResponse {
  jobId: string;
  inhibitorId: string;
  fileUrl: string;
  localPath?: string;
  format: 'mmcif' | 'pdb' | 'cif';
}

export interface Af3ReportResponse {
  jobId: string;
  summary: string;
  generatedAt: string;
  exportReady: boolean;
}

export interface UbuntuServerHealthResponse {
  status: 'ok' | 'error' | 'unreachable';
  af3Version?: string;
  gpuAvailable?: boolean;
  activeWorkers?: number;
  message?: string;
}

/**
 * 1. 단백질 서열 검증 및 Mpro Dimer 템플릿 준비
 * POST /api/af3/prepare
 */
export const prepareInputSequence = async (
  input: MutationInput
): Promise<PreparedSequenceResponse> => {
  try {
    const response = await client.post<PreparedSequenceResponse>('/api/af3/prepare', input);
    return response.data;
  } catch (error: any) {
    console.error('[af3Service] prepareInputSequence error:', error);
    throw new Error(
      error?.response?.data?.message ||
        '로컬 Ubuntu AF3 서버에 서열 전처리 요청을 실패했습니다. 서버 연결을 확인하세요.'
    );
  }
};

/**
 * 2. 로컬 Ubuntu AF3 파이프라인에 모델링 Job 제출 (Dimer 모드 고정)
 * POST /api/af3/submit
 */
export const submitAf3Job = async (
  jobId: string,
  input: MutationInput,
  inhibitorIds: string[],
  seed?: number
): Promise<Af3JobSubmissionResponse> => {
  try {
    const payload = {
      jobId,
      input,
      inhibitorIds,
      dimerMode: true, // Mpro Homodimer 고정
      seed: typeof seed === 'number' ? seed : null,
    };
    const response = await client.post<Af3JobSubmissionResponse>('/api/af3/submit', payload);
    return response.data;
  } catch (error: any) {
    console.error('[af3Service] submitAf3Job error:', error);
    throw new Error(
      error?.response?.data?.message ||
        'AlphaFold3 모델링 연산 제출에 실패했습니다. 로컬 Ubuntu 서버의 GPU 워커 상태를 확인해주세요.'
    );
  }
};

/**
 * 3. AF3 연산 진행 상태 실시간 폴링
 * GET /api/af3/status/:jobId
 */
export const pollAf3Status = async (jobId: string): Promise<Af3StatusPollingResponse> => {
  try {
    const response = await client.get<Af3StatusPollingResponse>(`/api/af3/status/${jobId}`);
    return response.data;
  } catch (error: any) {
    console.error('[af3Service] pollAf3Status error:', error);
    throw new Error(
      error?.response?.data?.message || `Job ID (${jobId})의 상태 조회에 실패했습니다.`
    );
  }
};

/**
 * 4. 모델링 완료된 3D 복합체 구조 파일(mmCIF / PDB) 경로 다운로드 URL 획득
 * GET /api/af3/structure/:jobId/:inhibitorId
 */
export const fetchResultStructure = async (
  jobId: string,
  inhibitorId: string
): Promise<Af3StructureResponse> => {
  try {
    const response = await client.get<Af3StructureResponse>(
      `/api/af3/structure/${jobId}/${inhibitorId}`
    );
    return response.data;
  } catch (error: any) {
    console.error('[af3Service] fetchResultStructure error:', error);
    throw new Error(
      error?.response?.data?.message ||
        `억제제(${inhibitorId}) 3D 구조 파일을 로드할 수 없습니다.`
    );
  }
};

/**
 * 5. 특정 억제제와 변이체 간의 기하학적 결합 지표 추출
 * 주의: 임의의 약효 수치, IC50, Ki 값은 반환하지 않습니다.
 * GET /api/af3/metrics/:jobId/:inhibitorId
 */
export const fetchBindingMetrics = async (
  jobId: string,
  inhibitorId: string
): Promise<BindingMetrics> => {
  try {
    const response = await client.get<BindingMetrics>(
      `/api/af3/metrics/${jobId}/${inhibitorId}`
    );
    return response.data;
  } catch (error: any) {
    console.error('[af3Service] fetchBindingMetrics error:', error);
    throw new Error(
      error?.response?.data?.message ||
        `억제제(${inhibitorId}) 결합 지표를 불러오는 중 오류가 발생했습니다.`
    );
  }
};

/**
 * 6. 최종 연구 분석 종합 보고서 데이터 생성
 * GET /api/af3/report/:jobId
 */
export const generateResearchReport = async (jobId: string): Promise<Af3ReportResponse> => {
  try {
    const response = await client.get<Af3ReportResponse>(`/api/af3/report/${jobId}`);
    return response.data;
  } catch (error: any) {
    console.error('[af3Service] generateResearchReport error:', error);
    throw new Error(
      error?.response?.data?.message ||
        `Job ID (${jobId}) 연구 보고서 생성을 완료하지 못했습니다.`
    );
  }
};

/**
 * 7. 로컬 Ubuntu AlphaFold3 실행 서버 상태 헬스 체크
 * GET /api/af3/health
 */
export const checkUbuntuServerHealth = async (): Promise<UbuntuServerHealthResponse> => {
  try {
    const response = await client.get<UbuntuServerHealthResponse>('/api/af3/health');
    return response.data;
  } catch (error: any) {
    console.warn('[af3Service] checkUbuntuServerHealth unreachable:', error.message);
    return {
      status: 'unreachable',
      message: '로컬 Ubuntu AF3 서버(http://localhost:8000)에 연결할 수 없습니다. 컨테이너 구동 여부를 확인해주세요.',
    };
  }
};
