"""구조 기반 과학 엔진 — RDKit descriptor + QSAR pIC50 예측.

ChatGPT 기획서 §10이 명시한 MVP 활성 예측기("Morgan fingerprint + GBM pIC50 회귀")를
실제로 구현한 모듈. 6,368종 실측 pIC50으로 학습한 QSAR(Ridge 선형 가중치, scaffold-CV ρ=0.76)를
qsar_model.json 으로 이식했다. RDKit 로 SMILES에서 물성·지문을 직접 계산하므로,
사용자가 docking/ADMET를 손입력할 필요가 없다.
"""
from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path

import numpy as np
from rdkit import Chem, RDLogger
from rdkit.Chem import Crippen, Descriptors, Lipinski, QED, rdFingerprintGenerator

RDLogger.DisableLog("rdApp.*")

ML_DIR = Path(__file__).resolve().parent


@lru_cache(maxsize=1)
def _qsar() -> dict:
    model = json.loads((ML_DIR / "qsar_model.json").read_text(encoding="utf-8"))
    model["_wmap"] = {int(i): w for i, w in zip(model["morgan_index"], model["morgan_weight"])}
    return model


@lru_cache(maxsize=1)
def _generator():
    model = _qsar()
    return rdFingerprintGenerator.GetMorganGenerator(radius=model["radius"], fpSize=model["n_bits"])


@lru_cache(maxsize=1)
def agent_library() -> list[dict]:
    lib = json.loads((ML_DIR / "agent_library.json").read_text(encoding="utf-8"))
    for compound in lib:
        compound["_onset"] = set(int(b) for b in compound["onbits"])
    return lib


@lru_cache(maxsize=1)
def qsar_metrics() -> dict:
    return json.loads((ML_DIR / "qsar_metrics.json").read_text(encoding="utf-8"))


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def _low_better(v: float, full_at: float, zero_at: float) -> float:
    if v <= full_at:
        return 1.0
    if v >= zero_at:
        return 0.0
    return (zero_at - v) / (zero_at - full_at)


def _range(v: float, low: float, high: float, min_zero: float, max_zero: float) -> float:
    if low <= v <= high:
        return 1.0
    if v < low:
        return 0.0 if v <= min_zero else (v - min_zero) / (low - min_zero)
    return 0.0 if v >= max_zero else (max_zero - v) / (max_zero - high)


def tanimoto(a: set[int], b: set[int]) -> float:
    if not a and not b:
        return 0.0
    inter = len(a & b)
    return inter / (len(a) + len(b) - inter)


def descriptors(mol: Chem.Mol) -> dict:
    d = {
        "MW": float(Descriptors.MolWt(mol)),
        "logP": float(Crippen.MolLogP(mol)),
        "TPSA": float(Descriptors.TPSA(mol)),
        "HBD": int(Lipinski.NumHDonors(mol)),
        "HBA": int(Lipinski.NumHAcceptors(mol)),
        "RotB": int(Lipinski.NumRotatableBonds(mol)),
        "QED": float(QED.qed(mol)),
    }
    d["lipinski"] = d["MW"] <= 500 and d["logP"] <= 5 and d["HBD"] <= 5 and d["HBA"] <= 10
    d["veber"] = d["TPSA"] <= 140 and d["RotB"] <= 10
    return d


def onbits(mol: Chem.Mol) -> set[int]:
    return set(int(b) for b in _generator().GetFingerprint(mol).GetOnBits())


def predict_pic50(desc: dict, on: set[int]) -> float:
    """Ridge QSAR: intercept + Σ(on-bit weight) + Σ desc_w·(d-mean)/std."""
    model = _qsar()
    score = model["intercept"]
    for bit in on:
        score += model["_wmap"].get(bit, 0.0)
    for j, key in enumerate(model["desc_order"]):
        score += model["desc_weight"][j] * ((desc[key] - model["desc_mean"][j]) / model["desc_std"][j])
    return float(score)


def nasal_delivery_score(desc: dict) -> float:
    return _clamp(
        25 * _low_better(desc["MW"], 350, 650)
        + 25 * _range(desc["logP"], 1, 3, 0, 5)
        + 20 * _low_better(desc["TPSA"], 90, 180)
        + 15 * _low_better(desc["HBD"], 2, 6)
        + 10 * _low_better(desc["RotB"], 6, 14)
        + 5 * desc["QED"]
    )


def max_reference_similarity(on: set[int]) -> float:
    best = 0.0
    for compound in agent_library():
        sim = tanimoto(on, compound["_onset"])
        if sim > best:
            best = sim
    return best


def structural_alerts(smiles: str) -> list[str]:
    alerts: list[str] = []
    if re.search(r"\[N\+\]\(=O\)\[O-\]|N\(=O\)=O", smiles):
        alerts.append("nitro group (potential toxicity)")
    if re.search(r"C\(=O\)Cl|S\(=O\)\(=O\)Cl", smiles):
        alerts.append("acyl/sulfonyl chloride (reactive)")
    if re.search(r"\[N-\]=\[N\+\]=\[N-\]|N=N=N", smiles):
        alerts.append("azide (reactive/energetic)")
    return alerts


def analyze(smiles: str) -> dict:
    """SMILES 하나로 물성·지문·예측 pIC50·비강점수·유사도·구조알림을 계산."""
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"invalid SMILES: {smiles}")
    desc = descriptors(mol)
    on = onbits(mol)
    return {
        "mol": mol,
        "descriptors": desc,
        "onbits": on,
        "predicted_pic50": predict_pic50(desc, on),
        "nasal_delivery": nasal_delivery_score(desc),
        "similarity": max_reference_similarity(on),
        "structural_alerts": structural_alerts(smiles),
    }
