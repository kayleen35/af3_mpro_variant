from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class ProteinTargetBase(BaseModel):
    name: str
    organism: str | None = None
    pdb_reference: str | None = None
    description: str | None = None


class ProteinTargetCreate(ProteinTargetBase):
    pass


class ProteinTargetRead(ProteinTargetBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LigandComplexBase(BaseModel):
    target_id: int
    ligand_name: str
    ligand_smiles: str | None = None
    pdb_id: str | None = None
    docking_score: float | None = None
    binding_affinity_nm: float | None = Field(default=None, ge=0)
    molecular_weight: float | None = Field(default=None, ge=0)
    logp: float | None = None
    hbond_donors: int | None = Field(default=None, ge=0)
    hbond_acceptors: int | None = Field(default=None, ge=0)
    tpsa: float | None = Field(default=None, ge=0)
    data_source: str | None = None
    assay_type: str | None = None
    observed_activity_label: str | None = Field(default=None, description="active, moderate, inactive")
    notes: str | None = None


class LigandComplexCreate(LigandComplexBase):
    pass


class LigandComplexRead(LigandComplexBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CandidateBase(BaseModel):
    name: str
    smiles: str | None = None
    target_id: int
    molecular_weight: float | None = Field(default=None, ge=0)
    logp: float | None = None
    docking_score: float | None = None
    binding_affinity_nm: float | None = Field(default=None, ge=0)
    admet_risk_score: float = Field(default=0.5, ge=0, le=1)
    novelty_score: float = Field(default=0.5, ge=0, le=1)
    data_quality_score: float = Field(default=0.5, ge=0, le=1)
    status: str = "research"
    notes: str | None = None


class CandidateCreate(CandidateBase):
    pass


class CandidateRead(CandidateBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ScoringRunCreate(BaseModel):
    name: str
    description: str | None = None


class ScoringRunRead(ScoringRunCreate):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ScoringResultRead(BaseModel):
    id: int
    run_id: int
    candidate_id: int
    research_priority_score: float
    target_fit_score: float
    drug_likeness_score: float
    data_confidence_score: float
    risk_penalty: float
    rationale: str
    predicted_pic50: float | None = None
    nasal_delivery_score: float | None = None
    mpro_binding_score: float | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AgentOptimizeRequest(BaseModel):
    smiles: str
    rounds: int = Field(default=5, ge=1, le=10)


class QsarSummary(BaseModel):
    n_compounds: int
    n_scaffolds: int
    random_forest: dict
    ridge_linear_js: dict
    similarity_baseline: dict
    features: str
    scope_note: str


class ValidationReportRead(BaseModel):
    id: int
    model_name: str
    dataset_size: int
    folds: int
    mae: float | None
    rmse: float | None
    r2: float | None
    summary: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class AuditLogRead(BaseModel):
    id: int
    actor: str
    action: str
    entity_type: str
    entity_id: int | None
    detail: str | None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class DashboardSummary(BaseModel):
    target_count: int
    complex_count: int
    candidate_count: int
    scoring_result_count: int
    average_research_priority_score: float | None
    recent_scoring_results: list[ScoringResultRead]
    recent_validation_reports: list[ValidationReportRead]
    scope_note: str
