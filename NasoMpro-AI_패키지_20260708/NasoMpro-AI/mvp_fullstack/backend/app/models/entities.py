from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class ProteinTarget(Base, TimestampMixin):
    __tablename__ = "protein_targets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    organism: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pdb_reference: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    complexes: Mapped[list["LigandComplexRecord"]] = relationship(back_populates="target")
    candidates: Mapped[list["CandidateMolecule"]] = relationship(back_populates="target")


class LigandComplexRecord(Base, TimestampMixin):
    __tablename__ = "ligand_complex_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    target_id: Mapped[int] = mapped_column(ForeignKey("protein_targets.id"), nullable=False, index=True)
    ligand_name: Mapped[str] = mapped_column(String(255), nullable=False)
    ligand_smiles: Mapped[str | None] = mapped_column(Text, nullable=True)
    pdb_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    docking_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    binding_affinity_nm: Mapped[float | None] = mapped_column(Float, nullable=True)
    molecular_weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    logp: Mapped[float | None] = mapped_column(Float, nullable=True)
    hbond_donors: Mapped[int | None] = mapped_column(Integer, nullable=True)
    hbond_acceptors: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tpsa: Mapped[float | None] = mapped_column(Float, nullable=True)
    data_source: Mapped[str | None] = mapped_column(String(255), nullable=True)
    assay_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    observed_activity_label: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    target: Mapped[ProteinTarget] = relationship(back_populates="complexes")


class CandidateMolecule(Base, TimestampMixin):
    __tablename__ = "candidate_molecules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    smiles: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_id: Mapped[int] = mapped_column(ForeignKey("protein_targets.id"), nullable=False, index=True)
    molecular_weight: Mapped[float | None] = mapped_column(Float, nullable=True)
    logp: Mapped[float | None] = mapped_column(Float, nullable=True)
    docking_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    binding_affinity_nm: Mapped[float | None] = mapped_column(Float, nullable=True)
    admet_risk_score: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    novelty_score: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    data_quality_score: Mapped[float] = mapped_column(Float, default=0.5, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="research", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    target: Mapped[ProteinTarget] = relationship(back_populates="candidates")
    scoring_results: Mapped[list["ScoringResult"]] = relationship(back_populates="candidate")


class ScoringRun(Base, TimestampMixin):
    __tablename__ = "scoring_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    results: Mapped[list["ScoringResult"]] = relationship(back_populates="run")


class ScoringResult(Base, TimestampMixin):
    __tablename__ = "scoring_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("scoring_runs.id"), nullable=False, index=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey("candidate_molecules.id"), nullable=False, index=True)
    research_priority_score: Mapped[float] = mapped_column(Float, nullable=False)
    target_fit_score: Mapped[float] = mapped_column(Float, nullable=False)
    drug_likeness_score: Mapped[float] = mapped_column(Float, nullable=False)
    data_confidence_score: Mapped[float] = mapped_column(Float, nullable=False)
    risk_penalty: Mapped[float] = mapped_column(Float, nullable=False)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    predicted_pic50: Mapped[float | None] = mapped_column(Float, nullable=True)
    nasal_delivery_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    mpro_binding_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    run: Mapped[ScoringRun] = relationship(back_populates="results")
    candidate: Mapped[CandidateMolecule] = relationship(back_populates="scoring_results")


class ValidationReport(Base, TimestampMixin):
    __tablename__ = "validation_reports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    model_name: Mapped[str] = mapped_column(String(255), nullable=False)
    dataset_size: Mapped[int] = mapped_column(Integer, nullable=False)
    folds: Mapped[int] = mapped_column(Integer, nullable=False)
    mae: Mapped[float | None] = mapped_column(Float, nullable=True)
    rmse: Mapped[float | None] = mapped_column(Float, nullable=True)
    r2: Mapped[float | None] = mapped_column(Float, nullable=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False)


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    actor: Mapped[str] = mapped_column(String(255), default="system", nullable=False)
    action: Mapped[str] = mapped_column(String(255), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(255), nullable=False)
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
