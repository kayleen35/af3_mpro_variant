const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export type Target = {
  id: number;
  name: string;
  organism?: string | null;
  pdb_reference?: string | null;
  description?: string | null;
  created_at: string;
};

export type Candidate = {
  id: number;
  name: string;
  smiles?: string | null;
  target_id: number;
  molecular_weight?: number | null;
  logp?: number | null;
  docking_score?: number | null;
  binding_affinity_nm?: number | null;
  admet_risk_score: number;
  novelty_score: number;
  data_quality_score: number;
  status: string;
  notes?: string | null;
  created_at: string;
};

export type ComplexRecord = {
  id: number;
  target_id: number;
  ligand_name: string;
  ligand_smiles?: string | null;
  pdb_id?: string | null;
  docking_score?: number | null;
  binding_affinity_nm?: number | null;
  molecular_weight?: number | null;
  logp?: number | null;
  hbond_donors?: number | null;
  hbond_acceptors?: number | null;
  tpsa?: number | null;
  data_source?: string | null;
  assay_type?: string | null;
  observed_activity_label?: string | null;
  notes?: string | null;
  created_at: string;
};

export type ScoringResult = {
  id: number;
  run_id: number;
  candidate_id: number;
  research_priority_score: number;
  target_fit_score: number;
  drug_likeness_score: number;
  data_confidence_score: number;
  risk_penalty: number;
  rationale: string;
  predicted_pic50?: number | null;
  nasal_delivery_score?: number | null;
  mpro_binding_score?: number | null;
  created_at: string;
};

export type AgentTrajectoryStep = {
  round: number;
  id: string;
  predicted_pic50: number;
  nasal: number;
  similarity_to_anchor: number;
  measured_pic50?: number | null;
  utility: number;
  smiles: string;
};

export type AgentResult = {
  agents: { name: string; role: string; tool?: string }[];
  seed: {
    smiles: string;
    predicted_pic50: number;
    nasal_delivery: number;
    similarity: number;
    structural_alerts: string[];
  };
  trajectory: AgentTrajectoryStep[];
  final_candidate: AgentTrajectoryStep;
  predicted_pic50_gain: number;
  disclaimer: string;
};

export type QsarSummary = {
  n_compounds: number;
  n_scaffolds: number;
  random_forest: { spearman: number; pearson: number; r2: number; rmse: number };
  ridge_linear_js: { spearman: number; pearson: number; r2: number; rmse: number };
  similarity_baseline: { spearman: number };
  features: string;
  scope_note: string;
};

export type ValidationReport = {
  id: number;
  model_name: string;
  dataset_size: number;
  folds: number;
  mae?: number | null;
  rmse?: number | null;
  r2?: number | null;
  summary: string;
  created_at: string;
};

export type AuditLog = {
  id: number;
  actor: string;
  action: string;
  entity_type: string;
  entity_id?: number | null;
  detail?: string | null;
  created_at: string;
};

export type Dashboard = {
  target_count: number;
  complex_count: number;
  candidate_count: number;
  scoring_result_count: number;
  average_research_priority_score?: number | null;
  recent_scoring_results: ScoringResult[];
  recent_validation_reports: ValidationReport[];
  scope_note: string;
};

export const api = {
  getDashboard: () => apiFetch<Dashboard>("/api/dashboard"),
  listTargets: () => apiFetch<Target[]>("/api/targets"),
  listCandidates: () => apiFetch<Candidate[]>("/api/candidates"),
  createCandidate: (payload: Partial<Candidate>) =>
    apiFetch<Candidate>("/api/candidates", { method: "POST", body: JSON.stringify(payload) }),
  scoreCandidate: (candidateId: number) =>
    apiFetch<ScoringResult>(`/api/candidates/${candidateId}/score`, { method: "POST" }),
  listComplexes: () => apiFetch<ComplexRecord[]>("/api/complexes"),
  createComplex: (payload: Partial<ComplexRecord>) =>
    apiFetch<ComplexRecord>("/api/complexes", { method: "POST", body: JSON.stringify(payload) }),
  listScoringResults: () => apiFetch<ScoringResult[]>("/api/scoring-results"),
  runCrossValidation: (targetId?: number) => {
    const query = targetId ? `?target_id=${targetId}&folds=5` : "?folds=5";
    return apiFetch<ValidationReport>(`/api/validation/cross-validate${query}`, { method: "POST" });
  },
  listValidationReports: () => apiFetch<ValidationReport[]>("/api/validation/reports"),
  getQsarSummary: () => apiFetch<QsarSummary>("/api/validation/qsar-summary"),
  createQsarReport: () => apiFetch<ValidationReport>("/api/validation/qsar-report", { method: "POST" }),
  optimizeAgent: (smiles: string, rounds = 5) =>
    apiFetch<AgentResult>("/api/agent/optimize", { method: "POST", body: JSON.stringify({ smiles, rounds }) }),
  listAuditLogs: () => apiFetch<AuditLog[]>("/api/admin/audit-logs")
};
