from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_session
from app.models.entities import (
    AuditLog,
    CandidateMolecule,
    LigandComplexRecord,
    ProteinTarget,
    ScoringResult,
    ScoringRun,
    ValidationReport,
)
from app.schemas.entities import (
    AgentOptimizeRequest,
    AuditLogRead,
    CandidateCreate,
    CandidateRead,
    DashboardSummary,
    LigandComplexCreate,
    LigandComplexRead,
    ProteinTargetCreate,
    ProteinTargetRead,
    QsarSummary,
    ScoringResultRead,
    ScoringRunCreate,
    ScoringRunRead,
    ValidationReportRead,
)
from app.ml.predictor import qsar_metrics
from app.services.agent import optimize as agent_optimize
from app.services.scoring import score_candidate
from app.services.validation import build_cross_validation_report, qsar_scaffold_cv_report

router = APIRouter()


async def _audit(
    session: AsyncSession,
    *,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    detail: str | None = None,
    actor: str = "system",
) -> None:
    session.add(
        AuditLog(actor=actor, action=action, entity_type=entity_type, entity_id=entity_id, detail=detail)
    )


@router.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok", "scope": "research decision support only"}


@router.get("/targets", response_model=list[ProteinTargetRead])
async def list_targets(session: AsyncSession = Depends(get_session)):
    result = await session.scalars(select(ProteinTarget).order_by(ProteinTarget.id))
    return list(result)


@router.post("/targets", response_model=ProteinTargetRead, status_code=201)
async def create_target(payload: ProteinTargetCreate, session: AsyncSession = Depends(get_session)):
    target = ProteinTarget(**payload.model_dump())
    session.add(target)
    await session.flush()
    await _audit(session, action="create", entity_type="ProteinTarget", entity_id=target.id, detail=target.name)
    await session.commit()
    await session.refresh(target)
    return target


@router.get("/complexes", response_model=list[LigandComplexRead])
async def list_complexes(
    target_id: int | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    statement = select(LigandComplexRecord).order_by(desc(LigandComplexRecord.created_at)).limit(limit)
    if target_id is not None:
        statement = statement.where(LigandComplexRecord.target_id == target_id)
    result = await session.scalars(statement)
    return list(result)


@router.post("/complexes", response_model=LigandComplexRead, status_code=201)
async def create_complex(payload: LigandComplexCreate, session: AsyncSession = Depends(get_session)):
    target = await session.get(ProteinTarget, payload.target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    record = LigandComplexRecord(**payload.model_dump())
    session.add(record)
    await session.flush()
    await _audit(session, action="create", entity_type="LigandComplexRecord", entity_id=record.id, detail=record.ligand_name)
    await session.commit()
    await session.refresh(record)
    return record


@router.get("/candidates", response_model=list[CandidateRead])
async def list_candidates(
    target_id: int | None = None,
    limit: int = Query(default=100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    statement = select(CandidateMolecule).order_by(desc(CandidateMolecule.created_at)).limit(limit)
    if target_id is not None:
        statement = statement.where(CandidateMolecule.target_id == target_id)
    result = await session.scalars(statement)
    return list(result)


@router.post("/candidates", response_model=CandidateRead, status_code=201)
async def create_candidate(payload: CandidateCreate, session: AsyncSession = Depends(get_session)):
    target = await session.get(ProteinTarget, payload.target_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target not found")
    candidate = CandidateMolecule(**payload.model_dump())
    session.add(candidate)
    await session.flush()
    await _audit(session, action="create", entity_type="CandidateMolecule", entity_id=candidate.id, detail=candidate.name)
    await session.commit()
    await session.refresh(candidate)
    return candidate


@router.post("/scoring-runs", response_model=ScoringRunRead, status_code=201)
async def create_scoring_run(payload: ScoringRunCreate, session: AsyncSession = Depends(get_session)):
    run = ScoringRun(**payload.model_dump())
    session.add(run)
    await session.flush()
    await _audit(session, action="create", entity_type="ScoringRun", entity_id=run.id, detail=run.name)
    await session.commit()
    await session.refresh(run)
    return run


@router.post("/candidates/{candidate_id}/score", response_model=ScoringResultRead, status_code=201)
async def score_candidate_endpoint(candidate_id: int, session: AsyncSession = Depends(get_session)):
    candidate = await session.get(CandidateMolecule, candidate_id)
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    run = ScoringRun(name=f"Score {candidate.name}", description="Single-candidate research-priority scoring run")
    session.add(run)
    await session.flush()

    breakdown = score_candidate(candidate)
    result = ScoringResult(
        run_id=run.id,
        candidate_id=candidate.id,
        research_priority_score=breakdown.research_priority_score,
        target_fit_score=breakdown.target_fit_score,
        drug_likeness_score=breakdown.drug_likeness_score,
        data_confidence_score=breakdown.data_confidence_score,
        risk_penalty=breakdown.risk_penalty,
        rationale=breakdown.rationale,
        predicted_pic50=breakdown.predicted_pic50,
        nasal_delivery_score=breakdown.nasal_delivery_score,
        mpro_binding_score=breakdown.mpro_binding_score,
    )
    session.add(result)
    await session.flush()
    await _audit(session, action="score", entity_type="CandidateMolecule", entity_id=candidate.id, detail=candidate.name)
    await session.commit()
    await session.refresh(result)
    return result


@router.get("/scoring-results", response_model=list[ScoringResultRead])
async def list_scoring_results(
    limit: int = Query(default=50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
):
    result = await session.scalars(select(ScoringResult).order_by(desc(ScoringResult.created_at)).limit(limit))
    return list(result)


@router.post("/validation/cross-validate", response_model=ValidationReportRead, status_code=201)
async def run_cross_validation(
    target_id: int | None = None,
    folds: int = Query(default=5, ge=2, le=10),
    session: AsyncSession = Depends(get_session),
):
    statement = select(LigandComplexRecord)
    if target_id is not None:
        statement = statement.where(LigandComplexRecord.target_id == target_id)
    records = list(await session.scalars(statement))

    metrics = build_cross_validation_report(records, folds=folds)
    report = ValidationReport(
        model_name=metrics.model_name,
        dataset_size=metrics.dataset_size,
        folds=metrics.folds,
        mae=metrics.mae,
        rmse=metrics.rmse,
        r2=metrics.r2,
        summary=metrics.summary,
    )
    session.add(report)
    await session.flush()
    await _audit(session, action="cross_validate", entity_type="ValidationReport", entity_id=report.id, detail=report.model_name)
    await session.commit()
    await session.refresh(report)
    return report


@router.get("/validation/reports", response_model=list[ValidationReportRead])
async def list_validation_reports(
    limit: int = Query(default=50, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
):
    result = await session.scalars(select(ValidationReport).order_by(desc(ValidationReport.created_at)).limit(limit))
    return list(result)


@router.get("/validation/qsar-summary", response_model=QsarSummary)
async def qsar_summary():
    """6,368종 학습 QSAR의 정직한 scaffold-CV 성능 지표(사전 계산)."""
    m = qsar_metrics()
    return QsarSummary(
        n_compounds=int(m["n_compounds"]),
        n_scaffolds=int(m["n_scaffolds"]),
        random_forest=m["random_forest"],
        ridge_linear_js=m["ridge_linear_js"],
        similarity_baseline=m["similarity_baseline"],
        features=m["features"],
        scope_note="Scaffold-CV honest generalization metrics for the QSAR pIC50 model. Research indicator only.",
    )


@router.post("/validation/qsar-report", response_model=ValidationReportRead, status_code=201)
async def create_qsar_validation_report(session: AsyncSession = Depends(get_session)):
    """실측 6,368종 scaffold-CV 결과를 ValidationReport로 영속화."""
    metrics = qsar_scaffold_cv_report()
    report = ValidationReport(
        model_name=metrics.model_name, dataset_size=metrics.dataset_size, folds=metrics.folds,
        mae=metrics.mae, rmse=metrics.rmse, r2=metrics.r2, summary=metrics.summary,
    )
    session.add(report)
    await session.flush()
    await _audit(session, action="qsar_validate", entity_type="ValidationReport", entity_id=report.id, detail=metrics.model_name)
    await session.commit()
    await session.refresh(report)
    return report


@router.post("/agent/optimize")
async def agent_optimize_endpoint(payload: AgentOptimizeRequest, session: AsyncSession = Depends(get_session)):
    """자율 에이전트 리드 최적화 파이프라인(가설→QSAR→도구기반 최적화→규제/제형)."""
    try:
        result = agent_optimize(payload.smiles, rounds=payload.rounds)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    await _audit(session, action="agent_optimize", entity_type="CandidateMolecule", detail=payload.smiles[:200])
    await session.commit()
    return result


@router.get("/dashboard", response_model=DashboardSummary)
async def get_dashboard(session: AsyncSession = Depends(get_session)):
    target_count = await session.scalar(select(func.count(ProteinTarget.id)))
    complex_count = await session.scalar(select(func.count(LigandComplexRecord.id)))
    candidate_count = await session.scalar(select(func.count(CandidateMolecule.id)))
    scoring_count = await session.scalar(select(func.count(ScoringResult.id)))
    average_score = await session.scalar(select(func.avg(ScoringResult.research_priority_score)))

    recent_scoring = list(
        await session.scalars(select(ScoringResult).order_by(desc(ScoringResult.created_at)).limit(5))
    )
    recent_reports = list(
        await session.scalars(select(ValidationReport).order_by(desc(ValidationReport.created_at)).limit(5))
    )

    return DashboardSummary(
        target_count=target_count or 0,
        complex_count=complex_count or 0,
        candidate_count=candidate_count or 0,
        scoring_result_count=scoring_count or 0,
        average_research_priority_score=round(float(average_score), 2) if average_score is not None else None,
        recent_scoring_results=recent_scoring,
        recent_validation_reports=recent_reports,
        scope_note="Research decision-support only. No clinical, dosing, synthesis, or therapeutic guidance is provided.",
    )


@router.get("/admin/audit-logs", response_model=list[AuditLogRead])
async def list_audit_logs(
    limit: int = Query(default=100, ge=1, le=500),
    session: AsyncSession = Depends(get_session),
):
    result = await session.scalars(select(AuditLog).order_by(desc(AuditLog.created_at)).limit(limit))
    return list(result)
