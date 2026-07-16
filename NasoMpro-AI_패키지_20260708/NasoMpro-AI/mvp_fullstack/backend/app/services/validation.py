from dataclasses import dataclass

import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, cross_val_predict

from app.ml.predictor import qsar_metrics
from app.models.entities import LigandComplexRecord


def qsar_scaffold_cv_report() -> "ValidationMetrics":
    """6,368종 실측 pIC50 학습 QSAR의 정직한 scaffold-CV 성능(사전 계산).

    데모용 소수 시드가 아니라 통합 실측 데이터셋 전체에 대한 골격 분할 교차검증 결과.
    Spearman은 요약 문자열에 포함(ValidationReport 스키마엔 RMSE/R²만 저장).
    """
    m = qsar_metrics()
    rf = m["random_forest"]
    ridge = m["ridge_linear_js"]
    sim = m["similarity_baseline"]
    return ValidationMetrics(
        model_name="QSAR RandomForest (Morgan r2 2048 + 7 desc, scaffold-CV)",
        dataset_size=int(m["n_compounds"]),
        folds=5,
        mae=None,
        rmse=rf["rmse"],
        r2=rf["r2"],
        summary=(
            f"Scaffold-based 5-fold GroupKFold on {m['n_compounds']} measured compounds "
            f"({m['n_scaffolds']} generic scaffolds). RandomForest Spearman rho={rf['spearman']} "
            f"(R2={rf['r2']}, RMSE={rf['rmse']}); Ridge(browser) rho={ridge['spearman']}; "
            f"similarity baseline rho={sim['spearman']}. Honest generalization — no scaffold leakage. "
            "Research indicator only; external validation and domain review still required."
        ),
    )


@dataclass(frozen=True)
class ValidationMetrics:
    model_name: str
    dataset_size: int
    folds: int
    mae: float | None
    rmse: float | None
    r2: float | None
    summary: str


_LABEL_MAP = {
    "active": 1.0,
    "moderate": 0.5,
    "inactive": 0.0,
}


def _feature_value(value: float | int | None, default: float = 0.0) -> float:
    return float(value) if value is not None else default


def build_cross_validation_report(records: list[LigandComplexRecord], folds: int = 5) -> ValidationMetrics:
    """Build a simple K-fold validation report from internal complex records.

    The label mapping is intentionally simple for MVP demonstration. Replace with
    validated assay endpoints before using in a regulated or scientific workflow.
    """

    usable_records: list[LigandComplexRecord] = []
    y_values: list[float] = []

    for record in records:
        label = (record.observed_activity_label or "").strip().lower()
        if label in _LABEL_MAP:
            usable_records.append(record)
            y_values.append(_LABEL_MAP[label])

    dataset_size = len(usable_records)
    safe_folds = max(2, min(folds, dataset_size)) if dataset_size >= 2 else 0

    if dataset_size < 5:
        return ValidationMetrics(
            model_name="RandomForestRegressor-MVP",
            dataset_size=dataset_size,
            folds=safe_folds,
            mae=None,
            rmse=None,
            r2=None,
            summary=(
                "Insufficient labeled complex data for reliable K-fold validation. "
                "Add at least five labeled records. Use this message as a data-readiness signal, not as a model-quality result."
            ),
        )

    x_matrix = np.array(
        [
            [
                _feature_value(r.molecular_weight, 350),
                _feature_value(r.logp, 2),
                _feature_value(r.docking_score, -6),
                _feature_value(r.binding_affinity_nm, 1000),
                _feature_value(r.hbond_donors, 0),
                _feature_value(r.hbond_acceptors, 0),
                _feature_value(r.tpsa, 75),
            ]
            for r in usable_records
        ],
        dtype=float,
    )
    y = np.array(y_values, dtype=float)

    cv = KFold(n_splits=safe_folds, shuffle=True, random_state=42)
    model = RandomForestRegressor(n_estimators=80, random_state=42, min_samples_leaf=1)
    predictions = cross_val_predict(model, x_matrix, y, cv=cv)

    mae = round(float(mean_absolute_error(y, predictions)), 4)
    rmse = round(float(np.sqrt(mean_squared_error(y, predictions))), 4)
    r2 = round(float(r2_score(y, predictions)), 4)

    return ValidationMetrics(
        model_name="RandomForestRegressor-MVP",
        dataset_size=dataset_size,
        folds=safe_folds,
        mae=mae,
        rmse=rmse,
        r2=r2,
        summary=(
            "K-fold validation completed on internal labeled complex records. "
            "Metrics are MVP indicators only; external validation, uncertainty estimation, and domain review are required."
        ),
    )
