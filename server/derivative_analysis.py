import sys
import json
import argparse
from rdkit import Chem
from rdkit.Chem import Descriptors
from rdkit.Chem import rdMolDescriptors
from rdkit.Chem import Draw
from rdkit.Chem.Draw import rdMolDraw2D
import base64

def analyze_derivative(smiles):
    mol = Chem.MolFromSmiles(smiles)
    if not mol:
        return {"error": "Invalid SMILES string"}

    # SVG 생성용
    try:
        Chem.rdDepictor.Compute2DCoords(mol)
    except:
        pass

    # 물리화학적 특성 계산
    mw = Descriptors.MolWt(mol)
    clogp = Descriptors.MolLogP(mol)
    tpsa = rdMolDescriptors.CalcTPSA(mol)

    # 비강(nasal) 전달 적합성 판단에 필요한 추가 디스크립터
    hbd = Descriptors.NumHDonors(mol)
    hba = Descriptors.NumHAcceptors(mol)
    rot_bonds = Descriptors.NumRotatableBonds(mol)

    # 수용해도 추정 — ESOL (Delaney 2004, J Chem Inf Comput Sci 44:1000)
    # 비강은 1회 투여량이 25~200 µL로 제한되어 용해도가 실질적 제약이 된다.
    # 추가 의존성 없이 위에서 구한 RDKit 디스크립터만으로 계산된다.
    heavy = mol.GetNumHeavyAtoms()
    aromatic_fraction = (
        sum(1 for a in mol.GetAtoms() if a.GetIsAromatic()) / heavy if heavy else 0.0
    )
    log_s = (
        0.16
        - 0.63 * clogp
        - 0.0062 * mw
        + 0.066 * rot_bonds
        - 0.74 * aromatic_fraction
    )
    solubility_mg_per_ml = (10 ** log_s) * mw

    # SMARTS 매칭
    # Warhead (Nitrile)
    warhead_smarts = "[C]#N"
    warhead_pattern = Chem.MolFromSmarts(warhead_smarts)
    warhead_matches = mol.GetSubstructMatches(warhead_pattern)
    
    warhead_atoms = set()
    for match in warhead_matches:
        warhead_atoms.update(match)

    # P1 (gamma-lactam or similar cyclic amide)
    # Nirmatrelvir P1: C1CCNC1=O (5-membered lactam)
    p1_smarts = "N1C(=O)CCC1"  # 5-membered lactam (pyrrolidin-2-one)
    p1_pattern = Chem.MolFromSmarts(p1_smarts)
    p1_matches = mol.GetSubstructMatches(p1_pattern)
    
    p1_atoms = set()
    for match in p1_matches:
        p1_atoms.update(match)

    # 6-membered lactam (piperidin-2-one) for extended P1 (like A-2)
    p1_ext_smarts = "N1C(=O)CCCC1" 
    p1_ext_pattern = Chem.MolFromSmarts(p1_ext_smarts)
    p1_ext_matches = mol.GetSubstructMatches(p1_ext_pattern)
    for match in p1_ext_matches:
        p1_atoms.update(match)

    # Lipinski's Rule of 5 (간단한 ADMET Flag 판단)
    admet_flags = []
    if mw > 500: admet_flags.append("MW > 500")
    if clogp > 5: admet_flags.append("cLogP > 5")
    
    admet_status = "Good" if len(admet_flags) == 0 else "Warning"

    # SVG 생성
    highlight_atoms = list(warhead_atoms) + list(p1_atoms)
    highlight_colors = {}
    for a in warhead_atoms:
        highlight_colors[a] = (0.9, 0.4, 0.4) # Red for Warhead
    for a in p1_atoms:
        highlight_colors[a] = (0.2, 0.8, 0.4) # Green for P1

    d2d = rdMolDraw2D.MolDraw2DSVG(400, 300)
    
    opts = d2d.drawOptions()
    opts.setHighlightColour((0.8, 0.8, 0.8))
    opts.useBWAtomPalette()
    opts.clearBackground = False
    
    d2d.DrawMolecule(mol, highlightAtoms=highlight_atoms, highlightAtomColors=highlight_colors)
    d2d.FinishDrawing()
    svg = d2d.GetDrawingText()

    return {
        "success": True,
        "properties": {
            "mw": round(mw, 2),
            "clogp": round(clogp, 2),
            "tpsa": round(tpsa, 2),
            # 비강 적합성 판정용 (기존 3개 키는 하위 호환 위해 그대로 유지)
            "hbd": hbd,
            "hba": hba,
            "rotatableBonds": rot_bonds,
            "solubility": {
                "logS": round(log_s, 2),
                "mgPerMl": round(solubility_mg_per_ml, 4),
                "method": "ESOL (Delaney 2004) 추정치"
            }
        },
        "admet": {
            "status": admet_status,
            "flags": admet_flags
        },
        "highlights": {
            "warhead": list(warhead_atoms),
            "p1": list(p1_atoms)
        },
        "svg": svg
    }

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--smiles", type=str, required=True)
    args = parser.parse_args()

    result = analyze_derivative(args.smiles)
    print(json.dumps(result))
