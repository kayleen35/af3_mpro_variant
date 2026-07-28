/**
 * 상호작용 분석 및 AF3 예측 결과 타입 정의
 * 명세서 섹션 9, 8 기준
 *
 * AF3 출력값(ranking_score, ipTM, pTM 등)은 구조 예측 신뢰도로만 해석한다.
 * "잘 붙는다", "강한 억제제" 등의 표현은 사용하지 않는다.
 */

export type Af3PredictionStatus = 'queued' | 'running' | 'completed' | 'failed';

export type InteractionType =
  | 'hydrogen_bond'
  | 'hydrophobic'
  | 'salt_bridge'
  | 'pi_stacking'
  | 'pi_cation'
  | 'halogen'
  | 'steric_clash'
  | 'covalent_geometry';

export type StructuralResistanceRisk = 'low' | 'moderate' | 'high' | 'unresolved';

/** AF3 단일 예측 결과 레코드 */
export interface Af3PredictionRecord {
  predictionId: string;
  jobId: string;
  inhibitorId: string;
  targetType: 'wt' | 'mutant' | 'optimized';
  seed: number;
  status: Af3PredictionStatus;

  structureFilePath?: string;
  summaryFilePath?: string;

  /**
   * 이하 값은 구조 예측 신뢰도 지표이다.
   * 약물 결합 친화도, IC50, Ki, 약효를 나타내지 않는다.
   */
  rankingScore?: number | null;
  iptm?: number | null;
  ptm?: number | null;
  ligandIptm?: number | null;
  ligandPae?: number | null;
  hasClash?: boolean | null;
  fractionDisordered?: number | null;

  createdAt: string;
  completedAt?: string;
}

/** 잔기 수준 상호작용 정보 */
export interface ResidueInteraction {
  residueId: string;
  residueName: string;
  chainId: string;
  residueNumber: number;

  interactionTypes: InteractionType[];

  ligandAtomIds?: number[];
  distance?: number | null;
  angle?: number | null;
}

/** 공유결합 warhead 기하 정보 */
export interface CovalentGeometry {
  cys145SulfurDistance?: number | null;
  approachAngle?: number | null;
  preReactionPoseConsistency?: 'consistent' | 'inconsistent' | 'unresolved';
  warheadOrientationChange?: string;
  cys145ClashRisk?: 'low' | 'moderate' | 'high' | 'unresolved';
}

/** WT–Mutant 상호작용 비교 결과 */
export interface InteractionComparisonRecord {
  inhibitorId: string;
  wtPredictionId: string;
  mutantPredictionId: string;

  retainedInteractions: ResidueInteraction[];
  lostInteractions: ResidueInteraction[];
  gainedInteractions: ResidueInteraction[];
  clashInteractions: ResidueInteraction[];

  covalentGeometry?: CovalentGeometry;

  /** 리간드 구조 변화 (단백질 정렬 후) */
  ligandRmsd?: number | null;
  pocketRmsd?: number | null;
  /** seed 간 pose 일관성 (0–1, 높을수록 일관됨) */
  poseConsistency?: number | null;

  structuralResistanceRisk: StructuralResistanceRisk;

  /**
   * 권장 표현 예시:
   * "WT 대비 수소결합 2개 소실"
   * "E166 주변 입체 충돌 가능성"
   * "구조 기반 내성 위험 높음"
   * 금지: "결합 실패", "약효 소실", "내성 확정"
   */
  interpretation: string[];

  computedAt?: string;
}
