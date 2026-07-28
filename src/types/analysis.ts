/**
 * Mpro 변이–억제제 분석 플랫폼 — 분석 Job 공통 타입 정의
 * 명세서 섹션 3 기준
 */

export type AnalysisStatus =
  | 'created'
  | 'sequence_validating'
  | 'mutation_detecting'
  | 'screening_ready'
  | 'screening_running'
  | 'screening_completed'
  | 'af3_queued'
  | 'af3_running'
  | 'af3_partial_completed'
  | 'af3_completed'
  | 'interaction_analyzing'
  | 'optimization_ready'
  | 'optimization_running'
  | 'reevaluation_running'
  | 'finalized'
  | 'failed'
  | 'cancelled'
  | 'timeout'
  // legacy — 하위 호환
  | 'idle'
  | 'validating'
  | 'mutation_analyzing'
  | 'structure_generating'
  | 'complex_predicting'
  | 'interaction_analyzing_legacy'
  | 'completed';

export type MutationType = 'substitution' | 'insertion' | 'deletion';

export type StructuralRegion =
  | 'catalytic_site'
  | 'substrate_binding_pocket'
  | 'dimer_interface'
  | 'domain_core'
  | 'surface_loop'
  | 'unknown';

export interface EvidenceReference {
  source: string;
  url?: string;
  year?: number;
  note?: string;
}

export interface MutationInput {
  mode: 'mutation' | 'fasta';
  referenceId: string;
  mutationText?: string;
  fastaText?: string;
  dimerMode?: boolean;
}

export interface MutationItem {
  mutationId?: string;
  position: number;
  wildTypeResidue: string;
  mutantResidue: string;
  mutationType?: MutationType;

  structuralRegion?: StructuralRegion | string;
  nearbyKeyResidues?: string[];
  distanceToCatalyticResidue?: number | null;

  literatureEvidence?: EvidenceReference[];
  expectedEffect?: string;
  interpretation?: string;
}

/** AF3 출력 지표 — 구조 예측 신뢰도 전용 (약효 점수가 아님) */
export interface BindingMetrics {
  rankingScore?: number | null;
  iptm?: number | null;
  ptm?: number | null;
  ligandIptm?: number | null;
  ligandPaeA?: number | null;
  ligandPaeB?: number | null;
  hasClash?: boolean | null;
  fractionDisordered?: number | null;
  // legacy
  cys145Distance?: number;
  hBondCount?: number;
  a166f167Interaction?: string;
  stericClash?: string;
  poseConsistencyRmsd?: number;
  researchFitScore?: number;
}

export interface InhibitorResult {
  inhibitorId: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  structureFilePath?: string;
  confidence?: number | null;
  metrics?: BindingMetrics;
  realMetrics?: Record<string, unknown>;
}

/** 워크플로우 단계 상태 */
export type WorkflowStepStatus = 'not_started' | 'ready' | 'running' | 'completed' | 'failed';

export interface WorkflowProgress {
  sequence: WorkflowStepStatus;
  mutation: WorkflowStepStatus;
  screening: WorkflowStepStatus;
  af3: WorkflowStepStatus;
  interaction: WorkflowStepStatus;
  optimization: WorkflowStepStatus;
  reevaluation: WorkflowStepStatus;
  final: WorkflowStepStatus;
}

export interface JobError {
  code: string;
  message: string;
  timestamp: string;
  step?: string;
}

export interface AnalysisJob {
  jobId: string;
  status: AnalysisStatus;

  input: MutationInput;
  referenceId?: string;
  mutations: MutationItem[];

  inhibitors: InhibitorResult[];
  inhibitorScreening?: import('./screening').InhibitorScreeningSummary[];
  af3Predictions?: import('./interaction').Af3PredictionRecord[];
  interactionComparisons?: import('./interaction').InteractionComparisonRecord[];

  optimizationRuns?: import('./optimization').OptimizationRun[];
  finalCandidates?: import('./optimization').FinalCandidateRecord[];

  workflowProgress?: WorkflowProgress;

  createdAt: string;
  updatedAt: string;

  warnings?: string[];
  errors?: JobError[];
  errorMessage?: string;
}
