/**
 * 구조변경 후보 생성 및 최종 비교 타입 정의
 * 명세서 섹션 10, 12, 13 기준
 */

export type ModificationType =
  | 'r_group_replacement'
  | 'fragment_replacement'
  | 'linker_change'
  | 'functional_group_addition'
  | 'functional_group_removal';

export type ImprovementLevel = 'improved' | 'similar' | 'worsened' | 'unresolved';
export type PredictionConfidence = 'high' | 'moderate' | 'low';

export type FinalCategory =
  | 'top_structural_candidate'
  | 'top_nasal_feasibility_candidate'
  | 'balanced_candidate'
  | 'high_risk_candidate'
  | 'insufficient_evidence';

/** 구조변경 후보 */
export interface OptimizedCandidate {
  candidateId: string;
  parentInhibitorId: string;

  smiles: string;
  canonicalSmiles?: string;

  modifiedAtomIds: number[];
  modificationType: ModificationType;

  /** 변경 이유 (어떤 interaction 소실을 보완하려 했는가) */
  rationale: string[];
  /** 예상 복원 interaction */
  expectedRecoveredInteraction: string[];

  /** 합성 가능성 점수 (1–10, SA Score 기반) — 높을수록 어렵다 */
  syntheticAccessibility?: number | null;
  /** 구조 경고 목록 */
  structuralAlerts: string[];

  createdAt?: string;
}

/** 개선 판정 — 세 축으로 분리, 종합점수 하나로 확정하지 않는다 */
export interface ImprovementAssessment {
  structuralInteractionRecovery: ImprovementLevel;
  toxicityNasalProfile: ImprovementLevel;
  predictionConfidence: PredictionConfidence;
  reasons: string[];
}

/** 최적화 실행 기록 */
export interface OptimizationRun {
  runId: string;
  jobId: string;
  inhibitorId: string;
  status: 'pending' | 'running' | 'completed' | 'failed';

  candidates: OptimizedCandidate[];
  selectedCandidateIds: string[];

  createdAt: string;
  completedAt?: string;
}

/** 최종 비교 레코드 */
export interface FinalCandidateRecord {
  candidateId: string;
  parentInhibitorId: string;
  isOriginalInhibitor: boolean;

  /** 구조 분석 축 */
  af3Confidence?: PredictionConfidence;
  ligandPoseConsistency?: number | null;
  retainedInteractionCount?: number;
  recoveredInteractionCount?: number;
  hasClash?: boolean;
  wtMutantLigandRmsd?: number | null;
  parentOptimizedLigandRmsd?: number | null;

  /** 결합에너지 재도킹 (QuickVina2, kcal/mol) — 도킹을 아직 안 돌렸으면 미정의 */
  bindingAffinity?: number;
  parentBindingAffinity?: number;
  bindingAffinityDelta?: number;

  /** 독성 축 */
  toxicityRisk?: import('./screening').ToxicityRisk;
  structuralAlertCount?: number;

  /** 비강 적합성 축 */
  nasalFeasibility?: import('./screening').NasalFeasibility;
  mw?: number | null;
  tpsa?: number | null;
  clogp?: number | null;
  /** 비강 전달 물성 평가용 (RDKit 실측) — 없으면 판정 보류 */
  hbd?: number | null;
  solubilityMgPerMl?: number | null;
  solubilityLogS?: number | null;

  /** 개발 가능성 */
  syntheticAccessibility?: number | null;
  evidenceConfidence?: import('./screening').EvidenceConfidence;

  /** 개선 판정 */
  improvement?: ImprovementAssessment;

  /** 최종 카테고리 */
  finalCategory: FinalCategory;

  /**
   * 최종 결론 예시:
   * "Candidate-A는 mutant Mpro에서 parent 대비 소실된 H163 상호작용이
   *  구조적으로 복원되는 포즈가 반복 seed에서 관찰되었다."
   */
  summaryText: string;
}
