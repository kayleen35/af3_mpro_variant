from app.models.entities import CandidateMolecule
from app.services.scoring import score_candidate

NIRMATRELVIR = (
    "CC1([C@@H]2[C@H]1[C@H](N(C2)C(=O)[C@H](C(C)(C)C)NC(=O)C(F)(F)F)"
    "C(=O)N[C@@H](C[C@@H]3CCNC3=O)C#N)C"
)


def test_score_candidate_returns_research_priority_range():
    candidate = CandidateMolecule(
        id=1,
        name="test",
        target_id=1,
        molecular_weight=350,
        logp=2.2,
        docking_score=-8.5,
        binding_affinity_nm=100,
        admet_risk_score=0.25,
        novelty_score=0.6,
        data_quality_score=0.8,
    )

    result = score_candidate(candidate)

    assert 0 <= result.research_priority_score <= 100
    assert 0 <= result.target_fit_score <= 100
    assert "research" in result.rationale.lower()
    assert "clinical" in result.rationale.lower()


def test_structure_based_scoring_from_smiles():
    """SMILES가 있으면 QSAR 예측 pIC50이 채워지고 다성분 점수가 나온다."""
    candidate = CandidateMolecule(
        id=2, name="Nirmatrelvir", target_id=1, smiles=NIRMATRELVIR,
        admet_risk_score=0.3, novelty_score=0.5, data_quality_score=0.8,
    )
    result = score_candidate(candidate)

    assert result.predicted_pic50 is not None
    assert 3.0 <= result.predicted_pic50 <= 12.0
    assert result.mpro_binding_score is not None
    assert result.nasal_delivery_score is not None
    assert 0 <= result.research_priority_score <= 100
    assert "qsar" in result.rationale.lower()


def test_agent_optimize_improves_or_holds():
    from app.services.agent import optimize

    out = optimize(NIRMATRELVIR, rounds=5)
    assert "trajectory" in out and len(out["trajectory"]) >= 1
    assert out["final_candidate"]["predicted_pic50"] >= out["trajectory"][0]["predicted_pic50"] - 1e-6
    assert len(out["agents"]) == 4


def test_qsar_validation_report_has_real_metrics():
    from app.services.validation import qsar_scaffold_cv_report

    report = qsar_scaffold_cv_report()
    assert report.dataset_size >= 6000
    assert report.r2 is not None and 0 <= report.r2 <= 1
    assert "scaffold" in report.summary.lower()
