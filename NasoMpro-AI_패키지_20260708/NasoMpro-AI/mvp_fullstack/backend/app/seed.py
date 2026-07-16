from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entities import (
    CandidateMolecule,
    LigandComplexRecord,
    ProteinTarget,
    ValidationReport,
)
from app.services.validation import qsar_scaffold_cv_report


async def seed_demo_data(session: AsyncSession) -> None:
    existing = await session.scalar(select(ProteinTarget).where(ProteinTarget.name == "SARS-CoV-2 Mpro"))
    if existing:
        return

    target = ProteinTarget(
        name="SARS-CoV-2 Mpro",
        organism="SARS-CoV-2",
        pdb_reference="Mpro reference set",
        description=(
            "Main protease target record for research decision-support MVP. "
            "This record is for data organization and scoring demonstration only."
        ),
    )
    session.add(target)
    await session.flush()

    complex_rows = [
        ("Mpro_Ligand_A", "CC1=CC=CC=C1", "6LU7", -8.7, 45, 312, 2.4, 1, 4, 72, "active"),
        ("Mpro_Ligand_B", "O=C(N)C1=CC=CC=C1", "7BQY", -7.4, 180, 286, 1.8, 2, 5, 84, "active"),
        ("Mpro_Ligand_C", "CCOC(=O)N1CCCC1", "7JQ2", -6.3, 950, 410, 3.1, 1, 6, 91, "moderate"),
        ("Mpro_Ligand_D", "CCN(CC)CCOC1=CC=CC=C1", "7K40", -5.4, 2200, 460, 4.9, 0, 3, 48, "moderate"),
        ("Mpro_Ligand_E", "C1CCCCC1", "7K3T", -3.8, 8500, 190, 3.5, 0, 0, 0, "inactive"),
        ("Mpro_Ligand_F", "NCC(O)CO", "7K3U", -4.2, 6000, 155, -0.5, 3, 3, 96, "inactive"),
        ("Mpro_Ligand_G", "CC(C)NC(=O)C1=CC=CC=C1", "7MGR", -8.1, 80, 350, 2.2, 2, 4, 68, "active"),
        ("Mpro_Ligand_H", "COC1=CC=C(C=C1)C(=O)N", "7MGS", -6.9, 620, 330, 2.0, 2, 5, 82, "moderate"),
        ("Mpro_Ligand_I", "CCCCCCCC", "7MGT", -3.2, 12000, 210, 5.6, 0, 0, 0, "inactive"),
        ("Mpro_Ligand_J", "CC1=NC=CC=C1C(=O)O", "7MGU", -7.8, 120, 305, 1.7, 1, 5, 77, "active"),
    ]

    for name, smiles, pdb_id, dock, affinity, mw, logp, donors, acceptors, tpsa, label in complex_rows:
        session.add(
            LigandComplexRecord(
                target_id=target.id,
                ligand_name=name,
                ligand_smiles=smiles,
                pdb_id=pdb_id,
                docking_score=dock,
                binding_affinity_nm=affinity,
                molecular_weight=mw,
                logp=logp,
                hbond_donors=donors,
                hbond_acceptors=acceptors,
                tpsa=tpsa,
                data_source="demo internal reference set",
                assay_type="labeled activity proxy",
                observed_activity_label=label,
                notes="Demo data for MVP validation flow; replace with curated research data.",
            )
        )

    # 실제 Mpro 저해제 3종 — SMILES만 주어도 구조 기반 QSAR로 예측 pIC50가 계산된다.
    candidate_rows = [
        ("Nirmatrelvir", "CC1([C@@H]2[C@H]1[C@H](N(C2)C(=O)[C@H](C(C)(C)C)NC(=O)C(F)(F)F)C(=O)N[C@@H](C[C@@H]3CCNC3=O)C#N)C", 0.4, 0.85),
        ("Ensitrelvir", r"Cn1cnc(CN2C(=O)N(Cc3cc(F)c(F)cc3F)C(=N\c3cc4cn(C)nc4cc3Cl)/NC2=O)n1", 0.7, 0.80),
        ("GC376", "CC(C)C[C@@H](C(=O)N[C@@H](CC1CCNC1=O)C(O)S(=O)(=O)[O-])NC(=O)OCC2=CC=CC=C2.[Na+]", 0.5, 0.75),
    ]

    for name, smiles, novelty, quality in candidate_rows:
        session.add(
            CandidateMolecule(
                target_id=target.id,
                name=name,
                smiles=smiles,
                novelty_score=novelty,
                data_quality_score=quality,
                notes="Reference Mpro inhibitor. Structure-based QSAR scoring from SMILES.",
            )
        )

    # 실측 6,368종 scaffold-CV 검증 리포트를 함께 시딩(대시보드가 실제 지표로 채워지도록).
    metrics = qsar_scaffold_cv_report()
    session.add(
        ValidationReport(
            model_name=metrics.model_name,
            dataset_size=metrics.dataset_size,
            folds=metrics.folds,
            mae=metrics.mae,
            rmse=metrics.rmse,
            r2=metrics.r2,
            summary=metrics.summary,
        )
    )

    await session.commit()
