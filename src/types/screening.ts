/**
 * 독성·비강 적합성 스크리닝 타입 정의
 * 명세서 섹션 7 기준
 *
 * 주의: 이 플랫폼은 연구·교육용 인실리코 분석 도구입니다.
 * 스크리닝 결과는 임상 안전성, 독성 확정, 치료 의사결정에 사용할 수 없습니다.
 */

/** 인실리코 독성 위험 예측 수준 — "안전" 또는 "독성 없음"으로 표현하지 않는다 */
export type ToxicityRisk = 'low' | 'moderate' | 'high' | 'unresolved';

/** 비강 국소 전달 적합성 예측 수준 */
export type NasalFeasibility = 'favorable' | 'borderline' | 'challenging' | 'unresolved';

/** 근거 신뢰도 등급 (데이터 출처 품질 기반) */
export type EvidenceConfidence = 'A' | 'B' | 'C' | 'D' | 'E';

/** AF3 계산 우선순위 */
export type Af3Priority = 'priority' | 'review' | 'low_priority';

/**
 * 단일 endpoint 스크리닝 결과
 * 실제 계산 결과가 없으면 status를 'not_evaluated'로 설정한다.
 */
export interface EndpointResult {
  endpoint: string;
  /** 예측 결과 레이블 (양성/음성, 위험/비위험 등) */
  result?: string | null;
  /** 예측 확률 또는 점수 (0–1) — 실제 모델 결과만 표시 */
  probability?: number | null;
  /** 상태: 실제 계산 결과 있음, 미평가, 계산 대기, 실험 필요 */
  status: 'evaluated' | 'not_evaluated' | 'pending' | 'experiment_required';
  /** 사용한 예측 모델명 */
  modelName?: string;
  /** 모델 버전 */
  modelVersion?: string;
  /** 계산 시각 */
  computedAt?: string;
  /** 구조 경고 메시지 */
  alerts?: string[];
}

/** 계산 가능한 물성값 (RDKit 기반) */
export interface PhysicochemicalProperties {
  molecularWeight?: number | null;
  tpsa?: number | null;
  clogp?: number | null;
  hbd?: number | null;   // hydrogen bond donors
  hba?: number | null;   // hydrogen bond acceptors
  rotatableBonds?: number | null;
  ringCount?: number | null;
  formalCharge?: number | null;
  inchiKey?: string | null;
  /** 데이터 출처 */
  computedBy?: string;
  computedAt?: string;
}

/** 비강 적합성 평가 결과 */
export interface NasalScreeningResult {
  /** 계산 가능 항목 */
  properties?: PhysicochemicalProperties;

  mwOk?: boolean;
  tpsaOk?: boolean;
  clogpOk?: boolean;
  solubilityRisk?: 'low' | 'moderate' | 'high' | 'unresolved';
  permeabilityRisk?: 'low' | 'moderate' | 'high' | 'unresolved';
  pgpRisk?: 'low' | 'moderate' | 'high' | 'unresolved';
  mucusBindingRisk?: 'low' | 'moderate' | 'high' | 'unresolved';

  /** 계산만으로 확정 불가 — 반드시 '실험 필요'로 표시 */
  experimentRequired: string[];

  nasalFeasibility: NasalFeasibility;
  reasons: string[];
}

/** 독성 스크리닝 결과 */
export interface ToxicityScreeningResult {
  ames?: EndpointResult;
  herg?: EndpointResult;
  dili?: EndpointResult;
  clintox?: EndpointResult;
  cyp3a4?: EndpointResult;
  cyp2d6?: EndpointResult;
  cyp2c9?: EndpointResult;
  cyp2c19?: EndpointResult;
  cyp1a2?: EndpointResult;
  cytotoxicity?: EndpointResult;
  ld50?: EndpointResult;

  /** 구조 경고 */
  toxicophoreAlerts: string[];
  painsAlerts: string[];
  reactiveGroupAlerts: string[];

  toxicityRisk: ToxicityRisk;
  reasons: string[];
}

/** 스크리닝 판정 결과 */
export interface ScreeningDecision {
  toxicityRisk: ToxicityRisk;
  nasalFeasibility: NasalFeasibility;
  evidenceConfidence: EvidenceConfidence;
  af3Priority: Af3Priority;
  reasons: string[];
}

/** 억제제 1개의 스크리닝 종합 결과 */
export interface InhibitorScreeningSummary {
  inhibitorId: string;
  inhibitorName: string;

  physicochemical?: PhysicochemicalProperties;
  toxicityResult?: ToxicityScreeningResult;
  nasalResult?: NasalScreeningResult;
  decision?: ScreeningDecision;

  /** 사용자가 수동으로 AF3 대상으로 선택했는지 */
  selectedForAf3: boolean;
  /** 사용자 메모 */
  userNote?: string;

  computedAt?: string;
}
