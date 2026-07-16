export interface Inhibitor {
  id: string;
  name: string;
  label: string;
  smiles: string;
  enabled: boolean;
  type: 'covalent' | 'non-covalent';
  description?: string;
}

/**
 * 16개 억제제 정의 — 모두 SMILES 기반
 * 공유결합(covalent) 9종 + 비공유결합(non-covalent) 7종
 * 주의: 임의의 약효 수치, IC50, Ki, 결합친화도 점수 등은 절대 포함하지 않습니다.
 */
export const INITIAL_INHIBITORS: Inhibitor[] = [
  // ─── 공유결합 억제제 (Covalent) ─────────────────────────────────────────
  {
    id: 'nirmatrelvir',
    name: 'Nirmatrelvir',
    label: 'Nirmatrelvir (PF-07321332)',
    smiles: 'CC1([C@@H]2[C@H]1[C@H](N(C2)C(=O)[C@H](C(C)(C)C)NC(=O)C(F)(F)F)C(=O)N[C@@H](C[C@@H]3CCNC3=O)C#N)C',
    enabled: true,
    type: 'covalent',
    description: 'FDA 승인 Mpro 공유결합 억제제. Paxlovid 주성분.',
  },
  {
    id: 'ibuzatrelvir',
    name: 'Ibuzatrelvir',
    label: 'Ibuzatrelvir (PF-07817883)',
    smiles: 'CC(C)(C)[C@@H](C(=O)N1C[C@@H](C[C@H]1C(=O)N[C@@H](C[C@@H]2CCNC2=O)C#N)C(F)(F)F)NC(=O)OC',
    enabled: true,
    type: 'covalent',
    description: '차세대 Mpro 공유결합 억제제. 경구 단독 투여 가능성.',
  },
  {
    id: 'simnotrelvir',
    name: 'Simnotrelvir',
    label: 'Simnotrelvir (SIM0417)',
    smiles: 'CC(C)(C)[C@@H](C(=O)N1CC2(C[C@H]1C(=O)N[C@@H](C[C@@H]3CCNC3=O)C#N)SCCS2)NC(=O)C(F)(F)F',
    enabled: true,
    type: 'covalent',
    description: '중국 승인 Mpro 억제제. Simcovir 주성분.',
  },
  {
    id: 'leritrelvir',
    name: 'Leritrelvir',
    label: 'Leritrelvir (RAY1216)',
    smiles: 'C1CCC(CC1)[C@@H](C(=O)N2C[C@@H]3CCC[C@@H]3[C@H]2C(=O)N[C@@H](C[C@@H]4CCNC4=O)C(=O)C(=O)NC5CCCC5)NC(=O)C(F)(F)F',
    enabled: true,
    type: 'covalent',
    description: 'Mpro 공유결합 억제제. 리토나비르 불필요 설계.',
  },
  {
    id: 'pomotrelvir',
    name: 'Pomotrelvir',
    label: 'Pomotrelvir (PBI-0451)',
    smiles: 'C1C[C@H](C(=O)NC1)C[C@@H](C#N)NC(=O)[C@H](CC2CC2)NC(=O)C3=CC4=C(N3)C(=CC=C4)Cl',
    enabled: true,
    type: 'covalent',
    description: '흡입형 Mpro 억제제. 폐 국소 전달 연구 대상.',
  },
  {
    id: 'gc376',
    name: 'GC376',
    label: 'GC376',
    smiles: 'CC(C)C[C@@H](C(=O)N[C@@H](C[C@@H]1CCNC1=O)[C@@H](O)S(=O)(=O)O)NC(=O)OCc2ccccc2',
    enabled: true,
    type: 'covalent',
    description: '광범위 코로나바이러스 Mpro 연구용 표준 억제제.',
  },
  {
    id: 'pf00835231',
    name: 'PF-00835231',
    label: 'PF-00835231',
    smiles: 'CC(C)C[C@@H](C(=O)N[C@@H](C[C@@H]1CCNC1=O)C(=O)CO)NC(=O)C2=CC3=C(N2)C=CC=C3OC',
    enabled: true,
    type: 'covalent',
    description: 'Nirmatrelvir 전구체. 정맥주사용 Mpro 억제제.',
  },
  {
    id: 'boceprevir',
    name: 'Boceprevir',
    label: 'Boceprevir',
    smiles: 'CC1([C@@H]2[C@H]1[C@H](N(C2)C(=O)[C@H](C(C)(C)C)NC(=O)NC(C)(C)C)C(=O)N[C@@H](CC3CCC3)[C@H](C(=O)N)O)C',
    enabled: true,
    type: 'covalent',
    description: 'HCV 프로테아제 억제제. Mpro 교차반응성 연구 대상.',
  },
  {
    id: 'bofutrelvir',
    name: 'Bofutrelvir',
    label: 'Bofutrelvir (FB2001)',
    smiles: 'C1CCC(CC1)C[C@@H](C(=O)N[C@@H](C[C@@H]2CCNC2=O)C=O)NC(=O)C3=CC4=CC=CC=C4N3',
    enabled: true,
    type: 'covalent',
    description: '알데하이드 warhead 기반 Mpro 억제제.',
  },
  // ─── 비공유결합 억제제 (Non-covalent) ───────────────────────────────────
  {
    id: 'ensitrelvir',
    name: 'Ensitrelvir',
    label: 'Ensitrelvir (S-217622)',
    smiles: 'CN1C=C2C=C(C(=CC2=N1)Cl)NC3=NC(=O)N(C(=O)N3CC4=CC(=C(C=C4F)F)F)CC5=NN(C=N5)C',
    enabled: true,
    type: 'non-covalent',
    description: '일본 승인 비공유결합 Mpro 억제제. Xocova 주성분.',
  },
  {
    id: 'x77',
    name: 'X77',
    label: 'X77 (6W63)',
    smiles: 'CC(C)(C)C1=CC=C(C=C1)N([C@H](C2=CN=CC=C2)C(=O)NC3CCCCC3)C(=O)C4=CN=CN4',
    enabled: true,
    type: 'non-covalent',
    description: '비공유결합 Mpro 억제제. PDB 6W63 구조 기반.',
  },
  {
    id: 'ml188',
    name: 'ML188',
    label: 'ML188 (7L0D)',
    smiles: 'CC(C)(C)C1=CC=C(C=C1)N([C@H](C2=CN=CC=C2)C(=O)NC(C)(C)C)C(=O)C3=CC=CO3',
    enabled: true,
    type: 'non-covalent',
    description: '비공유결합 Mpro 억제제. PDB 7L0D 구조 기반.',
  },
  {
    id: 'mat_pos_e194df51',
    name: 'MAT-POS-e194df51-1',
    label: 'MAT-POS-e194df51-1',
    smiles: 'C1CC1(CS(=O)(=O)N2C[C@H](C3=C(C2)C=CC(=C3)Cl)C(=O)NC4=CN=CC5=CC=CC=C54)C#N',
    enabled: true,
    type: 'non-covalent',
    description: 'Moonshot 프로젝트 비공유결합 Mpro 억제제 후보.',
  },
  {
    id: 'mat_pos_b3e365b9',
    name: 'MAT-POS-b3e365b9-1',
    label: 'MAT-POS-b3e365b9-1',
    smiles: 'C1COC2=C([C@@H]1C(=O)NC3=CN=CC4=CC=CC=C43)C=C(C=C2)Cl',
    enabled: true,
    type: 'non-covalent',
    description: 'Moonshot 프로젝트 비공유결합 Mpro 억제제 후보.',
  },
  {
    id: 'secutrelvir',
    name: 'Secutrelvir',
    label: 'Secutrelvir (S-892216)',
    smiles: 'C1C2(CC1(F)F)CN(C2)C3=C(C(=O)N(C(=O)N3CC#N)C4=CC(=CN=C4)Cl)C5=CC(=C(C=C5)F)Cl',
    enabled: true,
    type: 'non-covalent',
    description: '비공유결합 Mpro 억제제. 내성 변이 대응 설계.',
  },
  {
    id: 'olgotrelvir',
    name: 'Olgotrelvir',
    label: 'Olgotrelvir',
    smiles: 'CC(C)C[C@@H](C(=O)N[C@@H](C[C@@H]1CCNC1=O)CO)NC(=O)c2cc3ccccc3[nH]2',
    enabled: true,
    type: 'non-covalent',
    description: '비공유결합 Mpro 억제제 후보.',
  },
];
