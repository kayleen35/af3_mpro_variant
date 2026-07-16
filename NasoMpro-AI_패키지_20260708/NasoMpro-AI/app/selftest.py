from __future__ import annotations

from math import isfinite

import pandas as pd

from core import PRESET_INHIBITORS, descriptors, mpro_similarity, parse_smiles, score_molecule


def main() -> None:
    rows = []
    for name, smiles in PRESET_INHIBITORS.items():
        mol = parse_smiles(smiles)
        desc = descriptors(mol)
        sim = mpro_similarity(mol)
        scores = score_molecule(mol)

        numeric_values = [
            desc["MW"],
            desc["MolLogP"],
            desc["TPSA"],
            desc["QED"],
            sim,
            scores.nasal_delivery,
            scores.mpro_fit,
            scores.qed_score,
            scores.composite,
        ]
        assert all(isfinite(float(value)) for value in numeric_values), name
        assert 0.0 <= sim <= 1.0, name
        assert 0.0 <= scores.nasal_delivery <= 100.0, name
        assert 0.0 <= scores.mpro_fit <= 100.0, name
        assert 0.0 <= scores.composite <= 100.0, name

        rows.append(
            {
                "name": name,
                "MW": round(float(desc["MW"]), 2),
                "MolLogP": round(float(desc["MolLogP"]), 2),
                "TPSA": round(float(desc["TPSA"]), 2),
                "HBD": desc["NumHDonors"],
                "HBA": desc["NumHAcceptors"],
                "RotB": desc["NumRotatableBonds"],
                "QED": round(float(desc["QED"]), 4),
                "Similarity": round(sim, 4),
                "MproFit": scores.mpro_fit,
                "Nasal": scores.nasal_delivery,
                "Composite": scores.composite,
            }
        )

    df = pd.DataFrame(rows)
    print("RDKit Mpro 후보 평가 self-test 통과")
    print(df.to_string(index=False))


if __name__ == "__main__":
    main()
