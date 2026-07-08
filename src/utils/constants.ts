export const REFERENCE_SEQUENCES = [
  {
    id: 'wuhan-hu-1',
    label: 'Wuhan-Hu-1 SARS-CoV-2 Mpro (NC_045512.2 / P0DTD1)',
    description: 'SARS-CoV-2 Main Protease (3CLpro) Wild-Type Reference Sequence (306 amino acids)',
  },
];

export const ACTIVE_SITE_RESIDUES = [
  { label: 'H41', role: 'Catalytic dyad' },
  { label: 'L50/F50', role: 'Mutation hotspot / Pocket border' },
  { label: 'G143', role: 'Oxyanion hole' },
  { label: 'S144', role: 'Oxyanion hole' },
  { label: 'C145', role: 'Catalytic dyad (Nucleophile)' },
  { label: 'E166/A166', role: 'Dimerization / Substrate binding (S1 pocket)' },
  { label: 'L167/F167', role: 'Mutation hotspot / Outer loop' },
  { label: 'Q189', role: 'S2 pocket loop' },
  { label: 'T190', role: 'S4 pocket' },
];

export const RESIDUE_PANEL_GROUPS = [
  {
    groupName: 'Catalytic dyad',
    residues: ['H41', 'C145'],
    description: 'Mpro 촉매 반응 핵심 쌍 (Histidine-Cysteine catalytic dyad)',
  },
  {
    groupName: 'Oxyanion hole',
    residues: ['G143', 'S144', 'C145'],
    description: '기질 기질 결합 시 전이 상태 안정화 영역',
  },
  {
    groupName: 'Mutation hotspots',
    residues: ['L50/F50', 'E166/A166', 'L167/F167'],
    description: '주요 코로나 변이 균주에서 빈번하게 관찰되는 구조 변형 지점',
  },
  {
    groupName: 'Pocket residues',
    residues: ['H163', 'M165', 'Q189', 'T190'],
    description: '기질 및 억제제 인식 포켓 (S1, S2, S4 subsites)',
  },
];
