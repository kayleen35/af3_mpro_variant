import type { NasalFeasibility } from '../types/screening';

/**
 * 비강(nasal) 국소 전달 적합성 물성 평가
 *
 * 판정 축은 MW / TPSA / cLogP / HBD 4개이며, 임계값은 기존 스크리닝 단계
 * (ScreeningPage)에서 쓰던 값을 그대로 승계해 1단계와 5단계 판정이 어긋나지
 * 않도록 한다. HBD만 새로 추가된 축이다.
 *
 * 수용해도는 비강 투여의 실질적 최대 제약이지만 ESOL 추정치라 불확실성이 커
 * 판정 점수에는 반영하지 않고 '제형 과제' 참고 지표로만 별도 반환한다.
 */

export type NasalCriterionStatus = 'pass' | 'borderline' | 'fail';

export interface NasalCriterion {
  key: 'mw' | 'tpsa' | 'clogp' | 'hbd';
  label: string;
  /** 실측 계산값 */
  value: number;
  /** 화면 표기용 포맷된 값 */
  display: string;
  /** 통과 기준 설명 */
  criterion: string;
  status: NasalCriterionStatus;
  /** 왜 그렇게 판정했는지 */
  note: string;
}

export interface NasalSolubilityNote {
  mgPerMl: number;
  logS?: number;
  /** 가정한 필요 농도 (mg/mL) */
  requiredMgPerMl: number;
  /** 필요 농도 대비 부족 배수 (1 미만이면 충분) */
  shortfallFactor: number;
  sufficient: boolean;
  method: string;
}

export interface NasalAssessment {
  feasibility: NasalFeasibility;
  score: number;
  criteria: NasalCriterion[];
  solubility?: NasalSolubilityNote;
  /** 기존 ScreeningPage 호환용 근거 문자열 */
  reasons: string[];
}

/** 비강 1회 투여 부피 한계에서 유도한 필요 농도 가정 (5 mg / 100 µL) */
export const NASAL_DOSE_ASSUMPTION = {
  doseMg: 5,
  volumeUl: 100,
  get requiredMgPerMl() {
    return this.doseMg / (this.volumeUl / 1000);
  },
};

export interface NasalInputProps {
  mw?: number | null;
  tpsa?: number | null;
  clogp?: number | null;
  hbd?: number | null;
  solubilityMgPerMl?: number | null;
  solubilityLogS?: number | null;
}

const STATUS_SCORE: Record<NasalCriterionStatus, number> = {
  pass: 1,
  borderline: 0,
  fail: -1,
};

export function assessNasalFeasibility(props?: NasalInputProps | null): NasalAssessment {
  if (!props) {
    return { feasibility: 'unresolved', score: 0, criteria: [], reasons: ['물성값 없음'] };
  }

  const criteria: NasalCriterion[] = [];

  if (typeof props.mw === 'number') {
    const v = props.mw;
    const status: NasalCriterionStatus = v <= 500 ? 'pass' : v <= 600 ? 'borderline' : 'fail';
    criteria.push({
      key: 'mw', label: '분자량 (MW)', value: v, display: `${v.toFixed(1)} Da`,
      criterion: '≤ 500 Da', status,
      note: status === 'pass' ? '비강 점막 투과 적합 범위'
        : status === 'borderline' ? '500–600 Da 경계 — 투과 효율 저하 가능'
        : '600 Da 초과 — 점막 투과 불리',
    });
  }

  if (typeof props.tpsa === 'number') {
    const v = props.tpsa;
    const status: NasalCriterionStatus = v <= 140 ? 'pass' : v <= 180 ? 'borderline' : 'fail';
    criteria.push({
      key: 'tpsa', label: '극성 표면적 (TPSA)', value: v, display: `${v.toFixed(1)} Å²`,
      criterion: '≤ 140 Å²', status,
      note: status === 'pass' ? '경점막 수동 확산 유리'
        : status === 'borderline' ? '140–180 Å² 경계 — 투과 저하 가능'
        : '180 Å² 초과 — 수동 확산 불리',
    });
  }

  if (typeof props.clogp === 'number') {
    const v = props.clogp;
    const status: NasalCriterionStatus =
      v >= -1 && v <= 4 ? 'pass' : v > 4 && v <= 5.5 ? 'borderline' : 'fail';
    criteria.push({
      key: 'clogp', label: '친유성 (cLogP)', value: v, display: v.toFixed(2),
      criterion: '−1 ~ 4', status,
      note: status === 'pass' ? '용해도·막투과 균형 범위'
        : status === 'borderline' ? '4–5.5 경계 — 수용해도 저하 우려'
        : '범위 이탈 — 용해 또는 투과 한쪽이 불리',
    });
  }

  if (typeof props.hbd === 'number') {
    const v = props.hbd;
    const status: NasalCriterionStatus = v <= 3 ? 'pass' : v <= 5 ? 'borderline' : 'fail';
    criteria.push({
      key: 'hbd', label: '수소결합 주개 (HBD)', value: v, display: String(v),
      criterion: '≤ 3', status,
      note: status === 'pass' ? '막 투과 저해 요인 적음'
        : status === 'borderline' ? '4–5개 경계 — 탈수화 비용 증가'
        : '6개 이상 — 막 투과 불리',
    });
  }

  if (criteria.length === 0) {
    return { feasibility: 'unresolved', score: 0, criteria: [], reasons: ['물성값 없음'] };
  }

  const score = criteria.reduce((acc, c) => acc + STATUS_SCORE[c.status], 0);
  const feasibility: NasalFeasibility =
    score >= 3 ? 'favorable' : score >= 1 ? 'borderline' : 'challenging';

  // 용해도 — 판정 점수에는 반영하지 않는 참고 지표
  let solubility: NasalSolubilityNote | undefined;
  if (typeof props.solubilityMgPerMl === 'number') {
    const required = NASAL_DOSE_ASSUMPTION.requiredMgPerMl;
    const actual = props.solubilityMgPerMl;
    solubility = {
      mgPerMl: actual,
      logS: typeof props.solubilityLogS === 'number' ? props.solubilityLogS : undefined,
      requiredMgPerMl: required,
      shortfallFactor: actual > 0 ? required / actual : Infinity,
      sufficient: actual >= required,
      method: 'ESOL (Delaney 2004) 추정치',
    };
  }

  return {
    feasibility,
    score,
    criteria,
    solubility,
    reasons: criteria.map((c) => `${c.label} ${c.display} — ${c.note}`),
  };
}
