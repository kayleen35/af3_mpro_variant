import sys
import json
import uuid

try:
    from rdkit import Chem
    from rdkit.Chem import AllChem
except Exception as e:
    print(json.dumps({"error": f"RDKit load failed: {str(e)}"}))
    sys.exit(1)

def apply_transform(mol, rxn_smarts, max_products=2):
    rxn = AllChem.ReactionFromSmarts(rxn_smarts)
    products = rxn.RunReactants((mol,))
    unique_smiles = set()
    results = []
    
    for prod in products:
        m = prod[0]
        try:
            Chem.SanitizeMol(m)
            smi = Chem.MolToSmiles(m)
            if smi not in unique_smiles:
                unique_smiles.add(smi)
                results.append(m)
                if len(results) >= max_products:
                    break
        except:
            pass
    return results

def generate_candidates(smiles, max_candidates=10):
    mol = Chem.MolFromSmiles(smiles)
    if not mol:
        return {"error": "Invalid SMILES"}

    candidates = []
    seen_smiles = {Chem.MolToSmiles(mol)}

    # Simple transformation rules (MVP)
    # [Reactant]>>[Product]
    rules = [
        # Halogen exchange
        ('[F:1]', '[Cl:1]', 'Fluorine to Chlorine (Halogen Swap)', 'May improve binding affinity or steric fit in S2/S4 pocket'),
        ('[Cl:1]', '[F:1]', 'Chlorine to Fluorine (Halogen Swap)', 'May improve metabolic stability and reduce steric clash'),
        
        # Methyl to CF3
        ('[CH3:1]', '[C:1](F)(F)F', 'Methyl to Trifluoromethyl', 'Increases lipophilicity and metabolic stability'),
        
        # Add Fluorine to aromatic ring
        ('[c:1][H:2]', '[c:1]F', 'Aromatic Fluorination', 'Modulates pKa and lipophilicity; blocks CYP metabolism'),
        
        # Bioisosteres: OH to NH2
        ('[OH:1]', '[NH2:1]', 'Hydroxyl to Amino', 'Modifies H-bond donor/acceptor profile'),
    ]

    for reactant_smarts, product_smarts, rationale, effect in rules:
        if len(candidates) >= max_candidates:
            break
            
        rxn_smarts = f"{reactant_smarts}>>{product_smarts}"
        try:
            prods = apply_transform(mol, rxn_smarts, 2)
            for p in prods:
                smi = Chem.MolToSmiles(p)
                if smi not in seen_smiles:
                    seen_smiles.add(smi)
                    candidates.append({
                        "candidateId": str(uuid.uuid4())[:8],
                        "smiles": smi,
                        "modificationType": rationale,
                        "rationale": effect
                    })
                if len(candidates) >= max_candidates:
                    break
        except Exception as e:
            pass

    return {"status": "success", "candidates": candidates}

if __name__ == "__main__":
    try:
        input_data = sys.stdin.read()
        req = json.loads(input_data)
        smiles = req.get("smiles", "")
        max_c = req.get("max_candidates", 10)
        
        if not smiles:
            print(json.dumps({"error": "SMILES is required"}))
            sys.exit(1)
            
        res = generate_candidates(smiles, max_c)
        print(json.dumps(res))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
