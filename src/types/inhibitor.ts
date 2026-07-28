/**
 * 억제제 타입 정의 — 명세서 섹션 6 기준
 *
 * 주의: IC50, EC50, Ki, Kd, 결합 자유에너지 등 임의의 약효 수치는
 * 절대 포함하지 않습니다. 실험 데이터가 없으면 해당 필드는 null 또는 undefined입니다.
 */

export interface EvidenceRef {
  source: string;
  url?: string;
  year?: number;
}

/** 억제제 결합 유형 */
export type BindingType = 'covalent' | 'reversible_covalent' | 'non_covalent';

/** Warhead 유형 (공유결합 억제제 전용) */
export type WarheadType =
  | 'nitrile'
  | 'aldehyde'
  | 'ketoamide'
  | 'alpha_ketoamide'
  | 'epoxide'
  | 'michael_acceptor'
  | 'bisulfite_adduct'
  | 'none';

/** 개발 단계 */
export type DevelopmentStatus =
  | 'fda_approved'
  | 'eua_approved'
  | 'clinical_phase3'
  | 'clinical_phase2'
  | 'clinical_phase1'
  | 'preclinical'
  | 'research_tool'
  | 'experimental'
  | 'unknown';

export interface Inhibitor {
  id: string;
  name: string;
  label: string;
  aliases: string[];
  smiles: string;
  canonicalSmiles?: string;

  /** 결합 유형 */
  bindingType: BindingType;
  /** legacy 호환 */
  type?: 'covalent' | 'non-covalent';

  /** warhead 유형 (공유결합/가역적 공유결합 전용) */
  warheadType?: WarheadType | null;

  /** 알려진 투여 경로 (실험적 근거가 있는 경우만) */
  knownRoute?: string | null;

  /** 개발 단계 */
  developmentStatus?: DevelopmentStatus;

  /** 개발 단계 설명 텍스트 */
  developmentStatusLabel?: string;

  description?: string;
  sourceReferences: EvidenceRef[];
  enabled: boolean;

  /**
   * 사전 계산된 물성값 (RDKit 기반, 출처 명시)
   * IC50, Ki 등 생물학적 활성 수치는 포함하지 않는다.
   */
  precomputedProperties?: {
    mw?: number;
    tpsa?: number;
    clogp?: number;
    hbd?: number;
    hba?: number;
    rotatableBonds?: number;
    ringCount?: number;
    formalCharge?: number;
    source: string;
  };
}

/**
 * 억제제 정의 — 공유결합 억제제 5종 + 플랫폼 자체 설계 유도체 1종
 *
 * 플랫폼의 2D 취약부 진단(molecule_highlight.py)은 warhead(nitrile/aldehyde/ketoamide)와
 * 5원 γ-lactam P1을 SMARTS로 인식하는 구조라, 이 패턴 계열에 해당하는 억제제만 유지한다.
 * 비공유결합 억제제(ensitrelvir, x77, ml188 등)와 bisulfite/hydroxymethyl-ketone warhead
 * 계열(gc376, pf00835231, boceprevir 등)은 현재 패턴 세트로 warhead/P1을 인식하지 못해
 * Step 7·Stage 3에서 빈 화면 또는 오탐이 발생하므로 제외했다.
 * (패턴을 확장하면 다시 추가 가능 — README '알려진 한계' 참고)
 *
 * 물성값 출처: RDKit 2024.09 canonical SMILES 기반 계산값
 * 단, 사전 계산이 없는 경우 precomputedProperties는 포함되지 않습니다.
 */
export const INITIAL_INHIBITORS: Inhibitor[] = [
  // ─── 공유결합 억제제 ──────────────────────────────────────────────────────
  {
    id: 'nirmatrelvir',
    name: 'Nirmatrelvir',
    label: 'Nirmatrelvir (PF-07321332)',
    aliases: ['PF-07321332', 'Paxlovid active component'],
    smiles: 'CC1([C@@H]2[C@H]1[C@H](N(C2)C(=O)[C@H](C(C)(C)C)NC(=O)C(F)(F)F)C(=O)N[C@@H](C[C@@H]3CCNC3=O)C#N)C',
    bindingType: 'reversible_covalent',
    type: 'covalent',
    warheadType: 'nitrile',
    knownRoute: 'oral (with ritonavir)',
    developmentStatus: 'fda_approved',
    developmentStatusLabel: 'FDA 승인 (Paxlovid)',
    description: 'FDA 승인 Mpro 가역적 공유결합 억제제. Paxlovid 주성분.',
    sourceReferences: [{ source: 'FDA approval 2021', url: 'https://www.fda.gov/media/155049/download' }],
    enabled: true,
    precomputedProperties: { mw: 499.5, tpsa: 164.6, clogp: 1.05, hbd: 3, hba: 8, rotatableBonds: 9, ringCount: 3, formalCharge: 0, source: 'RDKit 2024.09' },
  },
  // ─── 가상 유도체 (Derivatives from Platform) ───────────────────────────────────
  {
    id: 'a2_derivative',
    name: 'A-2 Derivative',
    label: 'A-2 Derivative (E166V 보상형)',
    aliases: ['A-2', 'Nirmatrelvir A-2'],
    // P1 gamma-lactam 고리(5원환)를 6원환(valerolactam) 등으로 확장하여 E166V Gap 보상
    smiles: 'CC1([C@@H]2[C@H]1[C@H](N(C2)C(=O)[C@H](C(C)(C)C)NC(=O)C(F)(F)F)C(=O)N[C@@H](C[C@@H]3CCCCNC3=O)C#N)C',
    bindingType: 'reversible_covalent',
    type: 'covalent',
    warheadType: 'nitrile',
    knownRoute: 'N/A',
    developmentStatus: 'experimental',
    developmentStatusLabel: '플랫폼 설계 (실험적)',
    description: 'Nirmatrelvir 기반 E166V 내성 극복을 위해 P1 lactam 고리를 확장한 설계 유도체.',
    sourceReferences: [{ source: 'Platform Stage 3', url: '' }],
    enabled: true,
  },
  {
    id: 'ibuzatrelvir',
    name: 'Ibuzatrelvir',
    label: 'Ibuzatrelvir (PF-07817883)',
    aliases: ['PF-07817883'],
    smiles: 'CC(C)(C)[C@@H](C(=O)N1C[C@@H](C[C@H]1C(=O)N[C@@H](C[C@@H]2CCNC2=O)C#N)C(F)(F)F)NC(=O)OC',
    bindingType: 'reversible_covalent',
    type: 'covalent',
    warheadType: 'nitrile',
    knownRoute: 'oral (monotherapy candidate)',
    developmentStatus: 'clinical_phase3',
    developmentStatusLabel: '임상 3상',
    description: '차세대 Mpro 가역적 공유결합 억제제. 리토나비르 없이 단독 투여 가능성 연구 중.',
    sourceReferences: [{ source: 'Pfizer press release 2023' }],
    enabled: true,
  },
  {
    id: 'simnotrelvir',
    name: 'Simnotrelvir',
    label: 'Simnotrelvir (SIM0417)',
    aliases: ['SIM0417', 'Simcovir active'],
    smiles: 'CC(C)(C)[C@@H](C(=O)N1CC2(C[C@H]1C(=O)N[C@@H](C[C@@H]3CCNC3=O)C#N)SCCS2)NC(=O)C(F)(F)F',
    bindingType: 'reversible_covalent',
    type: 'covalent',
    warheadType: 'nitrile',
    knownRoute: 'oral (with ritonavir)',
    developmentStatus: 'eua_approved',
    developmentStatusLabel: '중국 승인 (Simcovir)',
    description: '중국 승인 Mpro 억제제. Simcovir 주성분.',
    sourceReferences: [{ source: 'NMPA approval 2022' }],
    enabled: true,
  },
  {
    id: 'leritrelvir',
    name: 'Leritrelvir',
    label: 'Leritrelvir (RAY1216)',
    aliases: ['RAY1216'],
    smiles: 'C1CCC(CC1)[C@@H](C(=O)N2C[C@@H]3CCC[C@@H]3[C@H]2C(=O)N[C@@H](C[C@@H]4CCNC4=O)C(=O)C(=O)NC5CCCC5)NC(=O)C(F)(F)F',
    bindingType: 'reversible_covalent',
    type: 'covalent',
    warheadType: 'ketoamide',
    knownRoute: 'oral (ritonavir-free design)',
    developmentStatus: 'clinical_phase3',
    developmentStatusLabel: '임상 3상',
    description: 'Mpro 가역적 공유결합 억제제. 리토나비르 불필요 설계.',
    sourceReferences: [{ source: 'Raynovent pipeline 2023' }],
    enabled: true,
  },
  {
    id: 'bofutrelvir',
    name: 'Bofutrelvir',
    label: 'Bofutrelvir (FB2001)',
    aliases: ['FB2001'],
    smiles: 'C1CCC(CC1)C[C@@H](C(=O)N[C@@H](C[C@@H]2CCNC2=O)C=O)NC(=O)C3=CC4=CC=CC=C4N3',
    bindingType: 'covalent',
    type: 'covalent',
    warheadType: 'aldehyde',
    knownRoute: 'intravenous',
    developmentStatus: 'clinical_phase2',
    developmentStatusLabel: '임상 2상',
    description: '알데하이드 warhead 기반 Mpro 억제제.',
    sourceReferences: [{ source: 'Frontier Biotechnologies 2022' }],
    enabled: true,
  },
];
