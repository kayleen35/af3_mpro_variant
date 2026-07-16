# -*- coding: utf-8 -*-
r"""SARS-CoV-2 Mpro pIC50 QSAR 모델 학습.

- 입력: data/mpro_library_full.json (6,368종, 실측 pIC50 + RDKit descriptor)
- 특징: Morgan fingerprint(r=2, 2048bit) + 7개 연속 descriptor(표준화)
- 검증: Murcko scaffold 기반 5-fold GroupKFold out-of-fold 예측 (정직한 일반화 성능)
- 모델:
    (1) RandomForest  -> 헤드라인 지표(pkl, Streamlit 서버측)
    (2) Ridge(선형)   -> 브라우저(JS)에서 임의 SMILES 실시간 예측용 가중치 export
- 비교: 기존 similarity 휴리스틱(ρ≈0.31) 대비 개선폭

산출물:
    ml/qsar_metrics.json         : 정직한 검증 지표
    ml/qsar_rf.pkl               : RandomForest 모델(+표준화 파라미터)  -> app/ 로 복사
    web/qsar_model.json          : Ridge 선형 가중치(JS 실시간 예측)
    data/mpro_predictions.json   : 화합물별 OOF 예측 pIC50(검증 산점도용)
"""
from __future__ import annotations

import json
import pickle
from pathlib import Path

import numpy as np
from rdkit import Chem, RDLogger
from rdkit.Chem import rdFingerprintGenerator
from rdkit.Chem.Scaffolds import MurckoScaffold
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import Ridge
from sklearn.model_selection import GroupKFold

RDLogger.DisableLog("rdApp.*")

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DATA = ROOT / "data" / "mpro_library_full.json"
DESC_ORDER = ["MW", "logP", "TPSA", "HBD", "HBA", "RotB", "QED"]
N_BITS = 2048
RADIUS = 2
_GEN = rdFingerprintGenerator.GetMorganGenerator(radius=RADIUS, fpSize=N_BITS)


def spearman(a: np.ndarray, b: np.ndarray) -> float:
    """순수 numpy Spearman rho (동점 평균순위)."""
    def rank(x):
        order = np.argsort(x, kind="mergesort")
        r = np.empty(len(x), dtype=float)
        r[order] = np.arange(len(x), dtype=float)
        # 동점 평균 처리
        _, inv, cnt = np.unique(x, return_inverse=True, return_counts=True)
        sums = np.zeros(len(cnt)); np.add.at(sums, inv, r)
        means = sums / cnt
        return means[inv]
    ra, rb = rank(a), rank(b)
    ra -= ra.mean(); rb -= rb.mean()
    denom = np.sqrt((ra * ra).sum() * (rb * rb).sum())
    return float((ra * rb).sum() / denom) if denom else 0.0


def morgan_bits(smiles: str):
    m = Chem.MolFromSmiles(smiles)
    if m is None:
        return None
    fp = _GEN.GetFingerprint(m)
    return np.frombuffer(fp.ToBitString().encode("ascii"), dtype=np.uint8) - ord("0")


def generic_scaffold(smiles: str) -> str:
    try:
        m = Chem.MolFromSmiles(smiles)
        if m is None:
            return smiles
        core = MurckoScaffold.GetScaffoldForMol(m)
        gen = MurckoScaffold.MakeScaffoldGeneric(core)
        s = Chem.MolToSmiles(gen)
        return s or smiles
    except Exception:
        return smiles


def main() -> None:
    rows = json.loads(DATA.read_text(encoding="utf-8"))
    X_fp, X_desc, y, ids, sims, scaffolds, kept = [], [], [], [], [], [], []
    for r in rows:
        bits = morgan_bits(r["smiles"])
        if bits is None or r.get("pIC50") is None:
            continue
        X_fp.append(bits)
        X_desc.append([float(r.get(k, 0.0) or 0.0) for k in DESC_ORDER])
        y.append(float(r["pIC50"]))
        ids.append(r.get("id", ""))
        sims.append(float(r.get("similarity", 0.0) or 0.0))
        scaffolds.append(generic_scaffold(r["smiles"]))
        kept.append(r)
    X_fp = np.asarray(X_fp, dtype=np.float32)
    X_desc = np.asarray(X_desc, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    sims = np.asarray(sims, dtype=np.float64)
    print(f"학습 대상 {len(y)}종 · 고유 scaffold {len(set(scaffolds))}개")

    # 연속 descriptor 표준화(브라우저 export를 위해 파라미터 저장)
    desc_mean = X_desc.mean(axis=0)
    desc_std = X_desc.std(axis=0)
    desc_std[desc_std == 0] = 1.0
    X_desc_std = (X_desc - desc_mean) / desc_std
    X_full = np.hstack([X_fp, X_desc_std])  # [2048 morgan | 7 std-desc]

    # scaffold 그룹 → 정수 인덱스
    scaf_to_g = {s: i for i, s in enumerate(sorted(set(scaffolds)))}
    groups = np.asarray([scaf_to_g[s] for s in scaffolds])
    n_splits = min(5, len(scaf_to_g))
    gkf = GroupKFold(n_splits=n_splits)

    oof_rf = np.full(len(y), np.nan)
    oof_ridge = np.full(len(y), np.nan)
    for fold, (tr, te) in enumerate(gkf.split(X_full, y, groups), 1):
        rf = RandomForestRegressor(
            n_estimators=300, max_depth=None, min_samples_leaf=2,
            n_jobs=-1, random_state=42,
        )
        rf.fit(X_full[tr], y[tr])
        oof_rf[te] = rf.predict(X_full[te])

        rg = Ridge(alpha=5.0, random_state=42)
        rg.fit(X_full[tr], y[tr])
        oof_ridge[te] = rg.predict(X_full[te])
        print(f"  fold {fold}: train {len(tr)} / test {len(te)}")

    def block(name, pred):
        rho = spearman(pred, y)
        rmse = float(np.sqrt(np.mean((pred - y) ** 2)))
        ss = 1 - np.sum((y - pred) ** 2) / np.sum((y - y.mean()) ** 2)
        pear = float(np.corrcoef(pred, y)[0, 1])
        print(f"[{name}] scaffold-CV: Spearman ρ={rho:.3f}  Pearson={pear:.3f}  R²={ss:.3f}  RMSE={rmse:.3f}")
        return {"spearman": round(rho, 4), "pearson": round(pear, 4),
                "r2": round(float(ss), 4), "rmse": round(rmse, 4)}

    m_rf = block("RandomForest", oof_rf)
    m_ridge = block("Ridge(선형·JS)", oof_ridge)
    rho_sim = spearman(sims, y)
    print(f"[유사도 베이스라인] Spearman ρ={rho_sim:.3f}  (기존 웹 표기 0.31)")

    # 최종 전체 데이터 재학습 → 배포 모델
    rf_final = RandomForestRegressor(
        n_estimators=400, min_samples_leaf=2, n_jobs=-1, random_state=42,
    ).fit(X_full, y)
    ridge_final = Ridge(alpha=5.0, random_state=42).fit(X_full, y)

    # 1) RF pkl (Streamlit)
    (HERE / "qsar_rf.pkl").write_bytes(pickle.dumps({
        "model": rf_final, "desc_order": DESC_ORDER,
        "desc_mean": desc_mean.tolist(), "desc_std": desc_std.tolist(),
        "n_bits": N_BITS, "radius": RADIUS,
    }))

    # 2) Ridge 선형 가중치 (JS 브라우저)
    coef = ridge_final.coef_
    morgan_w = coef[:N_BITS]
    # 희소 저장: 0이 아닌 morgan 가중치만 (파일 크기 축소)
    nz = np.nonzero(np.abs(morgan_w) > 1e-9)[0]
    (ROOT / "web" / "qsar_model.json").write_text(json.dumps({
        "kind": "ridge_morgan_desc",
        "radius": RADIUS, "n_bits": N_BITS,
        "intercept": float(ridge_final.intercept_),
        "morgan_index": nz.tolist(),
        "morgan_weight": [round(float(w), 6) for w in morgan_w[nz]],
        "desc_order": DESC_ORDER,
        "desc_weight": [round(float(w), 6) for w in coef[N_BITS:]],
        "desc_mean": [round(float(v), 6) for v in desc_mean],
        "desc_std": [round(float(v), 6) for v in desc_std],
        "metrics": m_ridge,
        "note": "pIC50 예측(scaffold-CV). JS: intercept + Σ(on-bit weight) + Σ desc_w*(d-mean)/std",
    }, ensure_ascii=False), encoding="utf-8")

    # 3) OOF 예측 (검증 산점도)
    preds = [{"id": ids[i], "pIC50": round(float(y[i]), 3),
              "pred_rf": round(float(oof_rf[i]), 3),
              "pred_ridge": round(float(oof_ridge[i]), 3),
              "similarity": round(float(sims[i]), 4),
              "is_ref": bool(kept[i].get("is_ref"))} for i in range(len(y))]
    (ROOT / "data" / "mpro_predictions.json").write_text(
        json.dumps(preds, ensure_ascii=False), encoding="utf-8")

    metrics = {
        "n_compounds": len(y), "n_scaffolds": len(scaf_to_g), "cv": f"{n_splits}-fold GroupKFold(scaffold)",
        "random_forest": m_rf, "ridge_linear_js": m_ridge,
        "similarity_baseline": {"spearman": round(rho_sim, 4)},
        "target": "pIC50", "features": f"Morgan(r={RADIUS},{N_BITS}bit) + {len(DESC_ORDER)} desc(std)",
    }
    (HERE / "qsar_metrics.json").write_text(json.dumps(metrics, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\n산출물 저장 완료:")
    print("  ml/qsar_metrics.json / ml/qsar_rf.pkl")
    print("  web/qsar_model.json  (희소 morgan 가중치", len(nz), "개)")
    print("  data/mpro_predictions.json")


if __name__ == "__main__":
    main()
