"""후보물질 연구 우선순위 점수화.

두 경로를 지원한다.
1. SMILES가 있으면 → RDKit + QSAR로 구조 기반 다성분 점수를 계산한다
   (ChatGPT 기획서 §7 Total Candidate Score 구조를 실제로 구현).
2. SMILES가 없으면 → 기존 MVP 휴리스틱(수동 입력 docking/affinity/ADMET)으로 폴백.

모든 점수는 연구 우선순위 산정용 예시이며 실제 치료 가능성/임상 성공률/안전성 판단이 아니다.
"""
from __future__ import annotations

from dataclasses import dataclass
from math import log10

from app.models.entities import CandidateMolecule


@dataclass(frozen=True)
class ScoreBreakdown:
    research_priority_score: float
    target_fit_score: float
    drug_likeness_score: float
    data_confidence_score: float
    risk_penalty: float
    rationale: str
    predicted_pic50: float | None = None
    nasal_delivery_score: float | None = None
    mpro_binding_score: float | None = None


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def _normalize_lower_is_better(value: float | None, best: float, worst: float, default: float = 50.0) -> float:
    if value is None:
        return default
    if best == worst:
        return default
    return _clamp((worst - value) / (worst - best) * 100)


def _normalize_affinity_nm(value: float | None, default: float = 50.0) -> float:
    if value is None or value <= 0:
        return default
    return _clamp((4.0 - log10(value)) / 4.0 * 100)


def _range_score(value: float | None, low: float, high: float, soft_margin: float, default: float = 50.0) -> float:
    if value is None:
        return default
    if low <= value <= high:
        return 100.0
    if value < low:
        return _clamp(100 - ((low - value) / soft_margin) * 100)
    return _clamp(100 - ((value - high) / soft_margin) * 100)


# ---- §7 다성분 가중치 (구조 기반 경로) ----
WEIGHTS = {
    "mpro_binding": 0.30,
    "key_interaction": 0.15,
    "admet_safety": 0.15,
    "nasal_delivery": 0.15,
    "chemical_stability": 0.10,
    "concordance": 0.10,
    "synth_novelty": 0.05,
}


def _score_structure_based(candidate: CandidateMolecule) -> ScoreBreakdown:
    from app.ml import predictor  # 지연 임포트(rdkit)

    a = predictor.analyze(candidate.smiles)
    desc = a["descriptors"]
    pred = a["predicted_pic50"]
    sim = a["similarity"]
    alerts = a["structural_alerts"]

    # 성분 점수 0~100
    mpro_binding = _clamp((pred - 4.0) / 7.0 * 100.0)               # 예측 pIC50(QSAR)
    key_interaction = _clamp(sim * 100.0)                          # 알려진 결합체와의 구조 유사(핵심 잔기 접촉 대리지표)
    admet_safety = _clamp(
        70.0 * desc["QED"] + (15.0 if desc["lipinski"] else 0.0)
        + (15.0 if desc["veber"] else 0.0) - 20.0 * len(alerts)
    )
    nasal = a["nasal_delivery"]
    chemical_stability = _clamp(100.0 - 25.0 * len(alerts) - max(0.0, desc["logP"] - 5.0) * 8.0)
    # concordance: docking 입력이 있으면 예측 pIC50와의 방향 일치, 없으면 모델 신뢰도(최근접 이웃 커버리지=유사도) 대리
    if candidate.docking_score is not None:
        dock_norm = _normalize_lower_is_better(candidate.docking_score, best=-12.0, worst=0.0) / 100.0
        concordance = _clamp(100.0 - abs(mpro_binding / 100.0 - dock_norm) * 100.0)
    else:
        concordance = _clamp(sim * 100.0)
    synth_novelty = _clamp((candidate.novelty_score if candidate.novelty_score is not None else 0.5) * 100.0)

    total = (
        WEIGHTS["mpro_binding"] * mpro_binding
        + WEIGHTS["key_interaction"] * key_interaction
        + WEIGHTS["admet_safety"] * admet_safety
        + WEIGHTS["nasal_delivery"] * nasal
        + WEIGHTS["chemical_stability"] * chemical_stability
        + WEIGHTS["concordance"] * concordance
        + WEIGHTS["synth_novelty"] * synth_novelty
    )
    ic50_nm = 10 ** (9 - pred)
    ic50_txt = f"{ic50_nm/1000:.1f} uM" if ic50_nm >= 1000 else f"{ic50_nm:.0f} nM"
    rationale = (
        f"Structure-based multi-component score (RDKit + QSAR). Predicted pIC50={pred:.2f} "
        f"(~{ic50_txt}); components — Mpro-binding {mpro_binding:.0f}, key-interaction(proxy) {key_interaction:.0f}, "
        f"ADMET-safety {admet_safety:.0f}, nasal-delivery {nasal:.0f}, chemical-stability {chemical_stability:.0f}, "
        f"concordance {concordance:.0f}, synth/novelty {synth_novelty:.0f}. "
        f"{'Alerts: ' + ', '.join(alerts) + '. ' if alerts else ''}"
        "Research-planning indicator only; not clinical efficacy, safety, dosing, synthesis feasibility, or therapeutic use."
    )
    return ScoreBreakdown(
        research_priority_score=round(_clamp(total), 2),
        target_fit_score=round((0.7 * mpro_binding + 0.3 * key_interaction), 2),
        drug_likeness_score=round(admet_safety, 2),
        data_confidence_score=round(concordance, 2),
        risk_penalty=round(20.0 * len(alerts) + (candidate.admet_risk_score or 0.0) * 40.0, 2),
        rationale=rationale,
        predicted_pic50=round(pred, 3),
        nasal_delivery_score=round(nasal, 2),
        mpro_binding_score=round(mpro_binding, 2),
    )


def _score_legacy(candidate: CandidateMolecule) -> ScoreBreakdown:
    """SMILES가 없을 때의 기존 MVP 휴리스틱(수동 입력 기반)."""
    docking_component = _normalize_lower_is_better(candidate.docking_score, best=-12.0, worst=0.0)
    affinity_component = _normalize_affinity_nm(candidate.binding_affinity_nm)
    target_fit_score = round((0.6 * docking_component) + (0.4 * affinity_component), 2)

    mw_score = _range_score(candidate.molecular_weight, low=150, high=500, soft_margin=250)
    logp_score = _range_score(candidate.logp, low=-1, high=5, soft_margin=4)
    drug_likeness_score = round((0.55 * mw_score) + (0.45 * logp_score), 2)

    data_confidence_score = round(candidate.data_quality_score * 100, 2)
    novelty_score = candidate.novelty_score * 100
    risk_penalty = round(candidate.admet_risk_score * 100, 2)

    raw_score = (
        0.45 * target_fit_score + 0.25 * drug_likeness_score + 0.20 * data_confidence_score
        + 0.10 * novelty_score - 0.20 * risk_penalty
    )
    rationale = (
        "Legacy heuristic (no SMILES): combines manually-provided docking, affinity, drug-likeness, "
        "data-confidence, novelty, and ADMET-risk. Provide a SMILES to enable structure-based QSAR scoring. "
        "Research-planning only; not clinical, safety, dosing, synthesis, or therapeutic guidance."
    )
    return ScoreBreakdown(
        research_priority_score=round(_clamp(raw_score), 2),
        target_fit_score=target_fit_score,
        drug_likeness_score=drug_likeness_score,
        data_confidence_score=data_confidence_score,
        risk_penalty=risk_penalty,
        rationale=rationale,
    )


def score_candidate(candidate: CandidateMolecule) -> ScoreBreakdown:
    """후보물질 연구 우선순위 점수. SMILES가 있으면 구조 기반 QSAR, 없으면 휴리스틱."""
    smiles = (candidate.smiles or "").strip()
    if smiles:
        try:
            return _score_structure_based(candidate)
        except Exception:
            return _score_legacy(candidate)
    return _score_legacy(candidate)
