export type AnalysisStatus =
  | 'idle'
  | 'validating'
  | 'mutation_analyzing'
  | 'structure_generating'
  | 'complex_predicting'
  | 'interaction_analyzing'
  | 'completed'
  | 'failed';

export interface MutationInput {
  mode: 'mutation' | 'fasta';
  referenceId: string;
  mutationText?: string;
  fastaText?: string;
}

export interface MutationItem {
  position: number;
  wildTypeResidue: string;
  mutantResidue: string;
  structuralRegion?: string;
  expectedEffect?: string;
}

export interface BindingMetrics {
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
  confidence?: number;
  metrics?: BindingMetrics;
}

export interface AnalysisJob {
  jobId: string;
  input: MutationInput;
  status: AnalysisStatus;
  mutations: MutationItem[];
  inhibitors: InhibitorResult[];
  createdAt: string;
  updatedAt: string;
  errorMessage?: string;
}
