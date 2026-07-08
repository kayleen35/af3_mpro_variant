export type InhibitorId =
  | 'nirmatrelvir'
  | 'ensitrelvir'
  | 'leritrelvir'
  | 'gc376'
  | 'compound4';

export interface Inhibitor {
  id: InhibitorId | string;
  name: string;
  label: string;
  enabled: boolean;
  description?: string;
  metadata?: Record<string, string>;
}

/**
 * 5개 억제제 초기 정의
 * 주의: 임의의 약효 수치, IC50, Ki, 결합친화도 점수 등은 절대 포함하지 않습니다.
 */
export const INITIAL_INHIBITORS: Inhibitor[] = [
  {
    id: 'nirmatrelvir',
    name: 'Nirmatrelvir',
    label: 'Nirmatrelvir (PF-07321332)',
    enabled: true,
    description: 'SARS-CoV-2 Mpro 표적 유기 억제제 (연구 분석용 표준 참고 리가нд)',
    metadata: {
      target: 'SARS-CoV-2 Mpro catalytic pocket',
      researchNote: 'Reference inhibitor for pose comparison',
    },
  },
  {
    id: 'ensitrelvir',
    name: 'Ensitrelvir',
    label: 'Ensitrelvir (S-217622)',
    enabled: true,
    description: '비펩타이드성 Mpro 억제제 구조 결합 예측 후보',
    metadata: {
      target: 'SARS-CoV-2 Mpro active site',
    },
  },
  {
    id: 'leritrelvir',
    name: 'Leritrelvir',
    label: 'Leritrelvir (RAY1216)',
    enabled: true,
    description: 'Mpro 표적 펩타이도미메틱 유도체 구조 후보군',
    metadata: {
      target: 'SARS-CoV-2 Mpro active site',
    },
  },
  {
    id: 'gc376',
    name: 'GC376',
    label: 'GC376 (Broad-spectrum protease inhibitor)',
    enabled: true,
    description: '광범위 코로나바이러스 3CLpro/Mpro 연구용 표준 실험 억제제',
    metadata: {
      target: 'SARS-CoV-2 Mpro catalytic dyad',
    },
  },
  {
    id: 'compound4',
    name: 'Compound 4',
    label: 'Compound 4 (Experimental Mpro Binder)',
    enabled: true,
    description: '연구 논문 흐름에 따른 신규 화합물 복합체 모델링 대상',
    metadata: {
      target: 'SARS-CoV-2 Mpro binding pocket',
    },
  },
];
