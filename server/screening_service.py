import sys
import json
import traceback

try:
    from rdkit import Chem
    from rdkit.Chem import Descriptors
    from rdkit.Chem import FilterCatalog
except Exception as e:
    print(json.dumps({"error": f"RDKit load failed: {str(e)}"}))
    sys.exit(1)

# Initialize RDKit FilterCatalog for PAINS and BRENK
try:
    params = FilterCatalog.FilterCatalogParams()
    params.AddCatalog(FilterCatalog.FilterCatalogParams.FilterCatalogs.PAINS_A)
    params.AddCatalog(FilterCatalog.FilterCatalogParams.FilterCatalogs.PAINS_B)
    params.AddCatalog(FilterCatalog.FilterCatalogParams.FilterCatalogs.PAINS_C)
    params.AddCatalog(FilterCatalog.FilterCatalogParams.FilterCatalogs.BRENK)
    catalog = FilterCatalog.FilterCatalog(params)
except Exception:
    catalog = None

def get_toxicity_predictions(mol, mw, clogp, tpsa):
    """
    RDKit 기반 규칙 기반 + 결정론적 경험적 평가 (Simulated ML)
    """
    alerts = []
    if catalog:
        for entry in catalog.GetMatches(mol):
            alerts.append(entry.GetDescription())
    
    # 중복 제거
    alerts = list(set(alerts))
    
    # 결정론적 위험도 맵핑 (Ames, hERG, DILI 등)
    # ML 모델이 없으므로 물성 및 알림 기반으로 유추
    has_pains = any("PAINS" in a for a in alerts)
    has_brenk = any("BRENK" in a for a in alerts)
    
    # hERG: 지용성이 높고 분자량이 크면 위험 (cLogP > 3.5, MW > 450)
    herg_risk = "high" if (clogp > 3.5 and mw > 450) else ("moderate" if clogp > 3.0 else "low")
    herg_prob = min(0.9, max(0.1, (clogp * 0.1) + (mw * 0.001)))
    
    # Ames: 특정 반응성 작용기나 알러트 존재 시 위험 증가
    ames_risk = "high" if has_pains else ("moderate" if has_brenk else "low")
    ames_prob = 0.85 if ames_risk == "high" else (0.4 if ames_risk == "moderate" else 0.15)
    
    # DILI: 간독성은 cLogP, MW 높은 약물에서 흔함 (Rule of 2: MW>400, cLogP>3)
    dili_risk = "high" if (mw > 400 and clogp > 3.0) else ("moderate" if (mw > 300 and clogp > 2.0) else "low")
    dili_prob = min(0.95, max(0.1, (mw/1000.0) + (clogp/10.0)))
    
    # CYP 억제: 질소 헤테로고리 및 지용성 
    n_rings = Descriptors.RingCount(mol)
    cyp3a4_prob = min(0.9, max(0.1, (n_rings * 0.1) + (clogp * 0.1)))
    cyp2d6_prob = min(0.9, max(0.1, (n_rings * 0.1) + (clogp * 0.05)))
    cyp2c9_prob = min(0.9, max(0.1, (n_rings * 0.05) + (clogp * 0.1)))
    
    # ClinTox: 임상 독성 위험
    clintox_risk = "high" if (ames_risk == "high" and herg_risk == "high") else ("moderate" if ames_risk == "high" or herg_risk == "high" else "low")
    clintox_prob = 0.8 if clintox_risk == "high" else (0.5 if clintox_risk == "moderate" else 0.2)
    
    return {
        "ames": {"risk": ames_risk, "probability": ames_prob},
        "herg": {"risk": herg_risk, "probability": herg_prob},
        "dili": {"risk": dili_risk, "probability": dili_prob},
        "clintox": {"risk": clintox_risk, "probability": clintox_prob},
        "cyp3a4_inhibition": cyp3a4_prob > 0.6,
        "cyp2d6_inhibition": cyp2d6_prob > 0.6,
        "cyp2c9_inhibition": cyp2c9_prob > 0.6,
        "structural_alerts": alerts
    }

def compute_properties(smiles: str):
    mol = Chem.MolFromSmiles(smiles)
    if not mol:
        return {"error": "Invalid SMILES"}
    
    # Calculate basic properties
    mw = Descriptors.MolWt(mol)
    tpsa = Descriptors.TPSA(mol)
    clogp = Descriptors.MolLogP(mol)
    hbd = Descriptors.NumHDonors(mol)
    hba = Descriptors.NumHAcceptors(mol)
    rotatable_bonds = Descriptors.NumRotatableBonds(mol)
    ring_count = Descriptors.RingCount(mol)
    formal_charge = Chem.GetFormalCharge(mol)
    
    # Calculate simulated ML toxicity based on RDKit rules
    tox = get_toxicity_predictions(mol, mw, clogp, tpsa)
    
    return {
        "mw": float(mw),
        "tpsa": float(tpsa),
        "clogp": float(clogp),
        "hbd": int(hbd),
        "hba": int(hba),
        "rotatableBonds": int(rotatable_bonds),
        "ringCount": int(ring_count),
        "formalCharge": int(formal_charge),
        "source": "RDKit + SimML",
        "toxicity": tox
    }

def process_batch(data):
    results = {}
    for item in data.get('inhibitors', []):
        inh_id = item.get('id')
        smiles = item.get('smiles')
        if not inh_id or not smiles:
            continue
            
        try:
            props = compute_properties(smiles)
            results[inh_id] = props
        except Exception as e:
            results[inh_id] = {"error": str(e)}
            
    return results

if __name__ == "__main__":
    try:
        input_data = sys.stdin.read()
        if not input_data.strip():
            print(json.dumps({"error": "No input provided"}))
            sys.exit(1)
            
        data = json.loads(input_data)
        results = process_batch(data)
        
        print(json.dumps({"status": "success", "data": results}))
    except Exception as e:
        error_info = {
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc()
        }
        print(json.dumps(error_info))
        sys.exit(1)
