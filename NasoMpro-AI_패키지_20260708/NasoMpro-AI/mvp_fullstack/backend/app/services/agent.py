"""자율 에이전트 리드 최적화 파이프라인.

ChatGPT 기획서 §6이 요구한 Agent 레이어 중 핵심(가설→QSAR평가→도구기반 최적화 루프→규제/제형)을
구현한다. 실측 라이브러리(agent_library.json)에서 아날로그를 검색하며 예측 pIC50·비강전달성을
다목적 효용으로 hill-climb 재앵커한다. 전 과정 결정적(deterministic)·오프라인 재현.
"""
from __future__ import annotations

from app.ml import predictor as P


def _utility(pred: float, nasal: float, sim_to_anchor: float) -> float:
    activity = max(0.0, min(1.0, (pred - 4.0) / 7.0))
    return 0.60 * activity + 0.25 * (nasal / 100.0) + 0.15 * sim_to_anchor


def optimize(smiles: str, rounds: int = 5) -> dict:
    base = P.analyze(smiles)
    library = P.agent_library()

    anchor = base["onbits"]
    picked: set[str] = set()
    seed_util = _utility(base["predicted_pic50"], base["nasal_delivery"], 1.0)
    trajectory = [{
        "round": 0, "id": "seed",
        "predicted_pic50": round(base["predicted_pic50"], 3),
        "nasal": round(base["nasal_delivery"], 1),
        "similarity_to_anchor": 1.0, "measured_pic50": None,
        "utility": round(seed_util, 4), "smiles": smiles,
    }]

    for k in range(1, max(1, rounds) + 1):
        best = None
        for compound in library:
            if compound["id"] in picked:
                continue
            sim = P.tanimoto(anchor, compound["_onset"])
            if sim < 0.15:
                continue
            util = _utility(compound["predPic50"], compound["nasal"], sim)
            if best is None or util > best["util"]:
                best = {"compound": compound, "sim": sim, "util": util}
        if best is None or best["util"] <= trajectory[-1]["utility"] + 1e-9:
            break
        c = best["compound"]
        picked.add(c["id"])
        anchor = c["_onset"]
        trajectory.append({
            "round": k, "id": c["id"],
            "predicted_pic50": c["predPic50"], "nasal": c["nasal"],
            "similarity_to_anchor": round(best["sim"], 3),
            "measured_pic50": c.get("pIC50"),
            "utility": round(best["util"], 4), "smiles": c["smiles"],
        })

    final = trajectory[-1]
    return {
        "agents": [
            {"name": "Hypothesis Agent", "role": "타겟(Mpro 3CLpro) 및 목적함수 정의"},
            {"name": "QSAR Evaluation Agent", "tool": "QSAR (Ridge, scaffold-CV rho=0.76)",
             "role": "시드 예측 pIC50·유사도·물성 평가"},
            {"name": "Optimization Agent", "tool": "analog retrieval + ML scoring",
             "role": f"아날로그 hill-climb {len(trajectory) - 1}회 재앵커"},
            {"name": "Regulatory/Formulation Agent", "role": "구조알림·비강 전달성 판정"},
        ],
        "seed": {
            "smiles": smiles,
            "predicted_pic50": round(base["predicted_pic50"], 3),
            "nasal_delivery": round(base["nasal_delivery"], 1),
            "similarity": round(base["similarity"], 3),
            "structural_alerts": base["structural_alerts"],
        },
        "trajectory": trajectory,
        "final_candidate": final,
        "predicted_pic50_gain": round(final["predicted_pic50"] - base["predicted_pic50"], 3),
        "disclaimer": (
            "Research decision-support only. Measured pIC50 shown for discovered analogs is a held-out "
            "validation value not used by the agent. Not clinical/dosing/synthesis/therapeutic guidance."
        ),
    }
