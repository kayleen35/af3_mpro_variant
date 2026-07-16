"""Core cheminformatics scoring for SARS-CoV-2 Mpro inhibitor assessment.

This module intentionally has no Streamlit dependency. All molecular
properties, similarities, and ranking scores are computed from RDKit objects.
The scores are transparent heuristics for triage, not experimental activity.
"""

from __future__ import annotations

import pickle
from dataclasses import dataclass
from functools import lru_cache
from math import isfinite
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd
from rdkit import Chem, DataStructs
from rdkit.Chem import Crippen, Descriptors, Lipinski, QED, rdFingerprintGenerator


PRESET_INHIBITORS: dict[str, str] = {
    "Nirmatrelvir": "CC1([C@@H]2[C@H]1[C@H](N(C2)C(=O)[C@H](C(C)(C)C)NC(=O)C(F)(F)F)C(=O)N[C@@H](C[C@@H]3CCNC3=O)C#N)C",
    "Ensitrelvir": r"Cn1cnc(CN2C(=O)N(Cc3cc(F)c(F)cc3F)C(=N\c3cc4cn(C)nc4cc3Cl)\NC2=O)n1",
    "GC376": "CC(C)C[C@@H](C(=O)N[C@@H](CC1CCNC1=O)C(O)S(=O)(=O)[O-])NC(=O)OCC2=CC=CC=C2.[Na+]",
}


NASAL_DELIVERY_FORMULA = {
    "MW": "25점: 350 이하 만점, 350-500 선형 감점, 650 이상 0점",
    "MolLogP": "25점: 1.0-3.0 만점, 0-1 및 3-5 구간 선형 감점, 그 밖 0점",
    "TPSA": "20점: 90 이하 만점, 90-120 선형 감점, 180 이상 0점",
    "NumHDonors": "15점: 2 이하 만점, 2-4 선형 감점, 6 이상 0점",
    "NumRotatableBonds": "10점: 6 이하 만점, 6-10 선형 감점, 14 이상 0점",
    "QED": "5점: RDKit QED x 5",
}

MPRO_FIT_FORMULA = {
    "Similarity": "50점: Morgan fingerprint Tanimoto similarity x 50",
    "QED": "15점: RDKit QED x 15",
    "TPSA": "10점: TPSA 140 이하 만점, 220 이상 0점",
    "MW": "10점: MW 650 이하 만점, 800 이상 0점",
    "HBA": "5점: HBA 10 이하 만점, 14 이상 0점",
    "RotatableBonds": "5점: rotatable bonds 12 이하 만점, 18 이상 0점",
    "Lipinski": "5점: Lipinski 통과 시 5점, 아니면 0점",
}

COMPOSITE_FORMULA = {
    "mpro_fit": 0.40,
    "mpro_similarity": 0.25,
    "nasal_delivery": 0.25,
    "qed": 0.10,
}

_FINGERPRINT_GENERATOR = rdFingerprintGenerator.GetMorganGenerator(
    radius=2, fpSize=2048
)


@dataclass(frozen=True)
class ScoreBundle:
    nasal_delivery: float
    mpro_fit: float
    mpro_similarity: float
    qed_score: float
    composite: float


def parse_smiles(smiles: str) -> Chem.Mol:
    """Parse and sanitize a SMILES string, raising ValueError when invalid."""

    if not isinstance(smiles, str) or not smiles.strip():
        raise ValueError("SMILES가 비어 있습니다.")

    mol = Chem.MolFromSmiles(smiles.strip(), sanitize=True)
    if mol is None:
        raise ValueError(f"유효하지 않은 SMILES입니다: {smiles}")
    return mol


def canonical_smiles(smiles_or_mol: str | Chem.Mol) -> str:
    mol = parse_smiles(smiles_or_mol) if isinstance(smiles_or_mol, str) else smiles_or_mol
    return Chem.MolToSmiles(mol, canonical=True, isomericSmiles=True)


def descriptors(mol: Chem.Mol) -> dict[str, float | int | bool]:
    """Compute RDKit molecular descriptors and rule-pass booleans."""

    mw = float(Descriptors.MolWt(mol))
    logp = float(Crippen.MolLogP(mol))
    tpsa = float(Descriptors.TPSA(mol))
    hbd = int(Lipinski.NumHDonors(mol))
    hba = int(Lipinski.NumHAcceptors(mol))
    rot = int(Lipinski.NumRotatableBonds(mol))
    qed = float(QED.qed(mol))

    lipinski_pass = mw <= 500 and logp <= 5 and hbd <= 5 and hba <= 10
    veber_pass = tpsa <= 140 and rot <= 10

    return {
        "MW": mw,
        "MolLogP": logp,
        "TPSA": tpsa,
        "NumHDonors": hbd,
        "NumHAcceptors": hba,
        "NumRotatableBonds": rot,
        "QED": qed,
        "lipinski_pass": lipinski_pass,
        "veber_pass": veber_pass,
    }


def _fingerprint(mol: Chem.Mol):
    return _FINGERPRINT_GENERATOR.GetFingerprint(mol)


def mpro_similarity(mol: Chem.Mol) -> float:
    """Return max Morgan Tanimoto similarity to preset Mpro inhibitors."""

    query_fp = _fingerprint(mol)
    preset_fps = [_fingerprint(parse_smiles(smi)) for smi in PRESET_INHIBITORS.values()]
    return float(max(DataStructs.TanimotoSimilarity(query_fp, fp) for fp in preset_fps))


def _score_low_better(value: float, full_at: float, zero_at: float) -> float:
    if value <= full_at:
        return 1.0
    if value >= zero_at:
        return 0.0
    return (zero_at - value) / (zero_at - full_at)


def _score_range(value: float, low: float, high: float, min_zero: float, max_zero: float) -> float:
    if low <= value <= high:
        return 1.0
    if value < low:
        if value <= min_zero:
            return 0.0
        return (value - min_zero) / (low - min_zero)
    if value >= max_zero:
        return 0.0
    return (max_zero - value) / (max_zero - high)


def _clamp_score(value: float) -> float:
    if not isfinite(value):
        return 0.0
    return round(max(0.0, min(100.0, value)), 2)


def nasal_delivery_score(desc: dict[str, float | int | bool]) -> float:
    """Transparent 0-100 nasal delivery heuristic from RDKit properties."""

    score = 0.0
    score += 25.0 * _score_low_better(float(desc["MW"]), full_at=350.0, zero_at=650.0)
    score += 25.0 * _score_range(float(desc["MolLogP"]), low=1.0, high=3.0, min_zero=0.0, max_zero=5.0)
    score += 20.0 * _score_low_better(float(desc["TPSA"]), full_at=90.0, zero_at=180.0)
    score += 15.0 * _score_low_better(float(desc["NumHDonors"]), full_at=2.0, zero_at=6.0)
    score += 10.0 * _score_low_better(float(desc["NumRotatableBonds"]), full_at=6.0, zero_at=14.0)
    score += 5.0 * float(desc["QED"])
    return _clamp_score(score)


def mpro_fit_score(desc: dict[str, float | int | bool], sim: float) -> float:
    """Transparent 0-100 Mpro fit score combining similarity and properties."""

    score = 0.0
    score += 50.0 * sim
    score += 15.0 * float(desc["QED"])
    score += 10.0 * _score_low_better(float(desc["TPSA"]), full_at=140.0, zero_at=220.0)
    score += 10.0 * _score_low_better(float(desc["MW"]), full_at=650.0, zero_at=800.0)
    score += 5.0 * _score_low_better(float(desc["NumHAcceptors"]), full_at=10.0, zero_at=14.0)
    score += 5.0 * _score_low_better(float(desc["NumRotatableBonds"]), full_at=12.0, zero_at=18.0)
    score += 5.0 if bool(desc["lipinski_pass"]) else 0.0
    return _clamp_score(score)


def composite_score(mpro_fit: float, sim: float, nasal: float, qed: float) -> float:
    """Weighted total: Mpro fit 40%, similarity 25%, nasal 25%, QED 10%."""

    score = (
        COMPOSITE_FORMULA["mpro_fit"] * mpro_fit
        + COMPOSITE_FORMULA["mpro_similarity"] * (sim * 100.0)
        + COMPOSITE_FORMULA["nasal_delivery"] * nasal
        + COMPOSITE_FORMULA["qed"] * (qed * 100.0)
    )
    return _clamp_score(score)


def score_molecule(mol: Chem.Mol) -> ScoreBundle:
    desc = descriptors(mol)
    sim = mpro_similarity(mol)
    nasal = nasal_delivery_score(desc)
    fit = mpro_fit_score(desc, sim)
    comp = composite_score(fit, sim, nasal, float(desc["QED"]))
    return ScoreBundle(
        nasal_delivery=nasal,
        mpro_fit=fit,
        mpro_similarity=round(sim, 4),
        qed_score=round(float(desc["QED"]) * 100.0, 2),
        composite=comp,
    )


# ===== ML QSAR 예측 pIC50 (RandomForest, scaffold-CV ρ=0.81) =====
_QSAR_PATH = Path(__file__).resolve().parent.parent / "ml" / "qsar_rf.pkl"
_QSAR_DESC_KEYS = ["MW", "MolLogP", "TPSA", "NumHDonors", "NumHAcceptors", "NumRotatableBonds", "QED"]


@lru_cache(maxsize=1)
def _load_qsar() -> dict:
    """학습된 QSAR 번들(RandomForest + 표준화 파라미터)을 1회만 로드."""
    with open(_QSAR_PATH, "rb") as fh:
        return pickle.load(fh)


@lru_cache(maxsize=1)
def _qsar_generator():
    bundle = _load_qsar()
    return rdFingerprintGenerator.GetMorganGenerator(radius=bundle["radius"], fpSize=bundle["n_bits"])


def _qsar_features(mol: Chem.Mol) -> np.ndarray:
    """학습과 동일: [Morgan(2048) | 표준화 7 descriptor], hstack morgan 우선."""
    bundle = _load_qsar()
    fp = _qsar_generator().GetFingerprint(mol)
    bits = np.frombuffer(fp.ToBitString().encode("ascii"), dtype=np.uint8).astype(np.float64) - ord("0")
    desc = descriptors(mol)
    cont = np.array([float(desc[k]) for k in _QSAR_DESC_KEYS], dtype=np.float64)
    cont_std = (cont - np.asarray(bundle["desc_mean"])) / np.asarray(bundle["desc_std"])
    return np.hstack([bits, cont_std])


def predict_pic50(mol: Chem.Mol) -> float:
    """RandomForest QSAR로 SARS-CoV-2 Mpro 저해 pIC50을 예측(비임상 계산값)."""
    bundle = _load_qsar()
    x = _qsar_features(mol).reshape(1, -1)
    return float(bundle["model"].predict(x)[0])


def spearman_rho(x: Iterable[float], y: Iterable[float]) -> float:
    """순수 numpy Spearman 순위상관(동점 평균순위). scipy 불필요."""
    a = np.asarray(list(x), dtype=float)
    b = np.asarray(list(y), dtype=float)
    if len(a) < 2 or len(a) != len(b):
        return 0.0

    def _rank(v: np.ndarray) -> np.ndarray:
        order = np.argsort(v, kind="mergesort")
        r = np.empty(len(v), dtype=float)
        r[order] = np.arange(len(v), dtype=float)
        uniq, inv, cnt = np.unique(v, return_inverse=True, return_counts=True)
        sums = np.zeros(len(cnt))
        np.add.at(sums, inv, r)
        return (sums / cnt)[inv]

    ra, rb = _rank(a), _rank(b)
    ra -= ra.mean()
    rb -= rb.mean()
    denom = float(np.sqrt((ra * ra).sum() * (rb * rb).sum()))
    return float((ra * rb).sum() / denom) if denom else 0.0


def rank_candidates(list_of_smiles: Iterable[str]) -> pd.DataFrame:
    """Rank valid candidate SMILES by composite score, descending."""

    rows: list[dict[str, object]] = []
    for idx, raw_smiles in enumerate(list_of_smiles, start=1):
        smiles = raw_smiles.strip()
        if not smiles:
            continue
        name = ""
        candidate_smiles = smiles
        if "\t" in smiles:
            parts = [part.strip() for part in smiles.split("\t") if part.strip()]
            if len(parts) >= 2:
                name, candidate_smiles = parts[0], parts[1]

        try:
            mol = parse_smiles(candidate_smiles)
            desc = descriptors(mol)
            scores = score_molecule(mol)
            rows.append(
                {
                    "rank_input": idx,
                    "name": name or f"Candidate {idx}",
                    "smiles": candidate_smiles,
                    "canonical_smiles": canonical_smiles(mol),
                    "MW": round(float(desc["MW"]), 2),
                    "MolLogP": round(float(desc["MolLogP"]), 2),
                    "TPSA": round(float(desc["TPSA"]), 2),
                    "HBD": desc["NumHDonors"],
                    "HBA": desc["NumHAcceptors"],
                    "RotB": desc["NumRotatableBonds"],
                    "QED": round(float(desc["QED"]), 4),
                    "Lipinski": bool(desc["lipinski_pass"]),
                    "Veber": bool(desc["veber_pass"]),
                    "PredPic50": round(predict_pic50(mol), 2),
                    "MproSimilarity": scores.mpro_similarity,
                    "MproFitScore": scores.mpro_fit,
                    "NasalDeliveryScore": scores.nasal_delivery,
                    "QEDScore": scores.qed_score,
                    "CompositeScore": scores.composite,
                    "error": "",
                }
            )
        except Exception as exc:
            rows.append(
                {
                    "rank_input": idx,
                    "name": name or f"Candidate {idx}",
                    "smiles": candidate_smiles,
                    "canonical_smiles": "",
                    "MW": None,
                    "MolLogP": None,
                    "TPSA": None,
                    "HBD": None,
                    "HBA": None,
                    "RotB": None,
                    "QED": None,
                    "Lipinski": None,
                    "Veber": None,
                    "PredPic50": None,
                    "MproSimilarity": None,
                    "MproFitScore": None,
                    "NasalDeliveryScore": None,
                    "QEDScore": None,
                    "CompositeScore": None,
                    "error": str(exc),
                }
            )

    df = pd.DataFrame(rows)
    if df.empty:
        return df
    return df.sort_values(
        by=["CompositeScore", "MproSimilarity"],
        ascending=[False, False],
        na_position="last",
    ).reset_index(drop=True)
