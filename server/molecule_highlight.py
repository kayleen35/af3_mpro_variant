# -*- coding: utf-8 -*-
"""
molecule_highlight.py
Generate 2D SVG with continuous region highlights + SMILES text segment analysis.
Supports both 'All Contacts' and 'Problematic Only' (non-binding/weak) highlight modes.
"""
import sys, json, re

try:
    from rdkit import Chem
    from rdkit.Chem import AllChem
    from rdkit.Chem.Draw import rdMolDraw2D
    RDKIT_OK = True
except ImportError:
    RDKIT_OK = False

PHARMACOPHORE = {
    "warhead_nitrile":   "C#N",
    "warhead_ketoamide": "C(=O)C(=O)N",
    "warhead_aldehyde":  "[CX3H1](=O)",
    "warhead_vinyl":     "C=CS(=O)(=O)",
    "warhead_cf3":       "C(F)(F)F",
    "p1_gamma_lactam":   "C1CCNC1=O",
    "p1_pyrrolidinone":  "C1CC(=O)NC1",
    "p1_glutamine":      "NCC(=O)",
    "p2_pyrrolidine":    "C1CCNC1",
}

REGIONS = {
    "warhead": ["warhead_nitrile","warhead_ketoamide","warhead_aldehyde","warhead_vinyl","warhead_cf3"],
    "p1":      ["p1_gamma_lactam","p1_pyrrolidinone","p1_glutamine"],
    "p2":      ["p2_pyrrolidine"],
}

# 다크 배경(#0A1121)에서 원자 기호가 보이도록 하는 팔레트. 원자번호 1(명시적 H)이
# 빠져있으면 RDKit 기본값(검정)으로 그려져 배경에 묻혀 안 보이므로 반드시 포함한다.
ATOM_PALETTE = {
    1:  (0.85, 0.85, 0.90),  # H
    6:  (0.7, 0.7, 0.75),    # C
    7:  (0.4, 0.6, 1.0),     # N
    8:  (1.0, 0.4, 0.4),     # O
    9:  (0.2, 0.8, 0.8),     # F
    16: (0.8, 0.8, 0.2),     # S
    17: (0.2, 0.8, 0.2),     # Cl
    -1: (0.7, 0.7, 0.7),
}

def get_indices(mol, smarts):
    try:
        pat = Chem.MolFromSmarts(smarts)
        if pat is None: return set()
        return set(idx for m in mol.GetSubstructMatches(pat) for idx in m)
    except: return set()

def cif_elem(name):
    if not name: return ""
    return ''.join(c for c in name.strip().upper() if c.isalpha())[:2]

def _tokenize_smiles(mol, atom_region_map, atom_quality_map, atom_color_hex, problem_qualities=("weak", "poor")):
    """RDKit atom-mapped SMILES를 파싱해 원자별 하이라이트 정보가 붙은 토큰 리스트를 만든다.
    generate()와 generate_diff() 양쪽에서 공유하는 로직 — 잔기/포켓 판정 방식만 다르고
    SMILES 문자열을 토큰으로 쪼개 인접한 원자를 병합하는 부분은 동일하다."""
    mw = Chem.RWMol(mol)
    for a in mw.GetAtoms():
        a.SetAtomMapNum(a.GetIdx() + 1000)
    mapped_smiles = Chem.MolToSmiles(mw)

    smiles_tokens = []
    clean_smiles = ""
    pos = 0
    while pos < len(mapped_smiles):
        m_bracket = re.match(r'\[([^\]:]+):(1\d{3})\]', mapped_smiles[pos:])
        m_simple = re.match(r'([a-zA-Z]):(1\d{3})', mapped_smiles[pos:])
        if m_bracket:
            atom_idx = int(m_bracket.group(2)) - 1000
            content = m_bracket.group(1)
            if content in ['CH3', 'CH2', 'CH', 'C']: txt = 'C'
            elif content in ['NH2', 'NH', 'N']: txt = 'N'
            elif content in ['OH', 'O']: txt = 'O'
            else: txt = "[" + content + "]"
            reg = atom_region_map.get(atom_idx)
            qual = atom_quality_map.get(atom_idx, "unknown" if reg else None)
            color = atom_color_hex.get(atom_idx)
            is_prob = qual in problem_qualities
            smiles_tokens.append({"text": txt, "region": reg, "quality": qual, "color": color, "isProblem": is_prob})
            clean_smiles += txt
            pos += len(m_bracket.group(0))
        elif m_simple:
            atom_idx = int(m_simple.group(2)) - 1000
            txt = m_simple.group(1)
            reg = atom_region_map.get(atom_idx)
            qual = atom_quality_map.get(atom_idx, "unknown" if reg else None)
            color = atom_color_hex.get(atom_idx)
            is_prob = qual in problem_qualities
            smiles_tokens.append({"text": txt, "region": reg, "quality": qual, "color": color, "isProblem": is_prob})
            clean_smiles += txt
            pos += len(m_simple.group(0))
        else:
            c = mapped_smiles[pos]
            smiles_tokens.append({"text": c, "region": None, "quality": None, "color": None, "isProblem": False})
            clean_smiles += c
            pos += 1

    for i in range(len(smiles_tokens)):
        if smiles_tokens[i]["region"] is None and not smiles_tokens[i]["isProblem"]:
            left_reg, left_col, left_qual, left_prob = None, None, None, False
            for j in range(i-1, -1, -1):
                if smiles_tokens[j]["color"] is not None:
                    left_reg, left_col, left_qual, left_prob = smiles_tokens[j]["region"], smiles_tokens[j]["color"], smiles_tokens[j]["quality"], smiles_tokens[j]["isProblem"]
                    break
            right_reg, right_col, right_qual, right_prob = None, None, None, False
            for j in range(i+1, len(smiles_tokens)):
                if smiles_tokens[j]["color"] is not None:
                    right_reg, right_col, right_qual, right_prob = smiles_tokens[j]["region"], smiles_tokens[j]["color"], smiles_tokens[j]["quality"], smiles_tokens[j]["isProblem"]
                    break
            if left_col and left_col == right_col and left_prob == right_prob:
                smiles_tokens[i]["region"] = left_reg
                smiles_tokens[i]["color"] = left_col
                smiles_tokens[i]["quality"] = left_qual
                smiles_tokens[i]["isProblem"] = left_prob

    merged_tokens = []
    for tok in smiles_tokens:
        if merged_tokens and merged_tokens[-1]["color"] == tok["color"] and merged_tokens[-1]["region"] == tok["region"] and merged_tokens[-1]["isProblem"] == tok["isProblem"]:
            merged_tokens[-1]["text"] += tok["text"]
        else:
            merged_tokens.append(dict(tok))

    return merged_tokens, clean_smiles


def generate_plain(smiles, width=580, height=440):
    """하이라이트 없이 깨끗한 2D 구조만 그린다 (WT 기준 참고용 — 하이라이트는
    변이 구조와 비교할 게 있을 때만 의미가 있으므로 WT 자체엔 표시하지 않는다)."""
    if not RDKIT_OK:
        return None, "RDKit not available"
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None, "Invalid SMILES: " + smiles[:50]
    AllChem.Compute2DCoords(mol)
    try:
        drawer = rdMolDraw2D.MolDraw2DSVG(width, height)
        opts = drawer.drawOptions()
        opts.clearBackground = True
        opts.backgroundColour = (0.04, 0.07, 0.13, 1.0)
        if hasattr(opts, 'updateAtomPalette'):
            opts.updateAtomPalette(ATOM_PALETTE)
        opts.bondLineWidth = 2.0
        opts.padding = 0.10
        drawer.DrawMolecule(mol)
        drawer.FinishDrawing()
        svg = drawer.GetDrawingText()
    except Exception as e:
        return None, "Render failed: " + str(e)
    return svg, None


def generate(smiles, contacts, hbonds, buried_area, width=580, height=440):
    if not RDKIT_OK:
        return None, None, "RDKit not available"
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None, None, "Invalid SMILES: " + smiles[:50]
    AllChem.Compute2DCoords(mol)

    anchor_residues = contacts.get("anchorResidues", {})
    total_contacts  = contacts.get("total", 0)
    hbond_details   = hbonds.get("details", [])
    buried_pct      = buried_area.get("percent", 0)
    hbond_count     = hbonds.get("count", 0)

    # 원소 기호 집합 (fallback용 — 잔기별 hbond 추적으로 대부분 대체됨)
    hbond_elems   = {cif_elem(h.get("lig_element") or h.get("lig_atom","")) for h in hbond_details if h.get("lig_atom")}
    contact_elems = set()
    for info in anchor_residues.values():
        for d in info.get("details", []):
            e = cif_elem(d.get("lig_atom",""))
            if e: contact_elems.add(e)

    # ── 잔기별 접촉수 및 H-bond 수 (PDB 7VH8 기반 S1/S2 포켓 잔기) ──
    def _ct(resseq): return anchor_residues.get(str(resseq), {}).get("count", 0)
    def _hb(resseq): return anchor_residues.get(str(resseq), {}).get("hbonds", 0)

    # S1' warhead site
    cys145_ct       = _ct(145)
    cys145_hb       = _hb(145)
    cys145_covalent = anchor_residues.get("145", {}).get("covalent", False)
    # S1 oxyanion hole (Gly143, Ser144) — backbone NH가 nitrile N에 H-bond
    gly143_ct = _ct(143);  gly143_hb = _hb(143)
    ser144_ct = _ct(144);  ser144_hb = _hb(144)
    # S1 anchor
    glu166_ct = _ct(166);  glu166_hb = _hb(166)
    his163_ct = _ct(163);  his163_hb = _hb(163)
    # S2 catalytic/hydrophobic
    his41_ct  = _ct(41);   his41_hb  = _hb(41)
    met49_ct  = _ct(49)
    met165_ct = _ct(165)

    poor = total_contacts < 8 or hbond_count == 0 or buried_pct < 10

    region_atoms = {}
    for region, keys in REGIONS.items():
        s = set()
        for k in keys:
            s |= get_indices(mol, PHARMACOPHORE[k])
        region_atoms[region] = s

    C_HBOND   = (0.18, 0.82, 0.42)
    C_CONTACT = (1.00, 0.82, 0.12)
    C_WEAK    = (1.00, 0.55, 0.10)
    C_NONE    = (0.92, 0.22, 0.22)

    hl_atoms_all, hl_colors_all, hl_radii_all = [], {}, {}
    hl_atoms_prob, hl_colors_prob, hl_radii_prob = [], {}, {}

    atom_region_map = {}
    atom_quality_map = {}
    atom_color_hex = {}

    COLOR_HEX = {"hbond":"#2ed26a","contact":"#ffd020","weak":"#ff8c1a","poor":"#eb3838","unknown":"#6b7280"}

    for atom in mol.GetAtoms():
        idx = atom.GetIdx()
        sym = atom.GetSymbol().upper()
        if sym == 'H': continue
        has_hb = sym in hbond_elems
        has_ct = sym in contact_elems
        in_wh  = idx in region_atoms["warhead"]
        in_p1  = idx in region_atoms["p1"]
        in_p2  = idx in region_atoms["p2"]

        color = None
        r = 0.35
        qual = "unknown"

        if in_wh:
            # Warhead (nitrile): Cys145 공유결합 또는 접촉 1개 이상이면 hbond 등급
            # + S1 oxyanion hole (Gly143/Ser144)까지 감지하면 더 강한 결합 신호
            # 근거: PDB 7VH8 — SG-C ~1.8 Å, Gly143 NH···nitrile N ~2.9 Å
            oxyanion_ok = (gly143_ct >= 1 or ser144_ct >= 1 or
                           gly143_hb >= 1 or ser144_hb >= 1)
            wh_strong = cys145_covalent or cys145_ct >= 1 or oxyanion_ok
            wh_contact = cys145_ct >= 1
            color = C_HBOND if wh_strong else (C_CONTACT if wh_contact else C_WEAK)
            qual  = "hbond" if wh_strong else ("contact" if wh_contact else "weak")
            r = 0.40
        elif in_p1:
            # P1 포켓: Glu166 + His163 모두 체크 (7VH8: Glu166 2.8 Å, His163 2.7 Å)
            p1_hbond   = glu166_hb >= 1 or his163_hb >= 1
            p1_contact = glu166_ct >= 2 or his163_ct >= 2
            color = C_HBOND if p1_hbond else (C_CONTACT if p1_contact else C_WEAK)
            qual  = "hbond" if p1_hbond else ("contact" if p1_contact else "weak")
            r = 0.40
        elif in_p2:
            # P2 포켓: His41 촉매 + Met49/Met165 소수성 포켓
            # 근거: Met49/Met165 VdW contact이 있으면 S2 포켓 점유 확인
            p2_hbond   = his41_hb >= 1
            p2_contact = his41_ct >= 2 or met49_ct >= 2 or met165_ct >= 2
            color = C_HBOND if p2_hbond else (C_CONTACT if p2_contact else C_WEAK)
            qual  = "hbond" if p2_hbond else ("contact" if p2_contact else "weak")
        elif has_hb:
            color, r = C_HBOND, 0.40
            qual = "hbond"
        elif has_ct:
            color = C_CONTACT
            qual = "contact"
        else:
            # Atoms without H-bonds and without anchor contacts (e.g. exposed linker or terminal ring)
            color = C_WEAK if not poor else C_NONE
            qual = "weak" if not poor else "poor"

        if color:
            hl_atoms_all.append(idx)
            hl_colors_all[idx] = color
            hl_radii_all[idx]  = r
            atom_quality_map[idx] = qual
            atom_color_hex[idx] = COLOR_HEX.get(qual, "#6b7280")

            # Only add to problem list if quality is poor or weak (non-binding/problematic)
            if qual in ("poor", "weak"):
                hl_atoms_prob.append(idx)
                hl_colors_prob[idx] = color
                hl_radii_prob[idx]  = r

        if in_wh: atom_region_map[idx] = "warhead"
        elif in_p1: atom_region_map[idx] = "p1"
        elif in_p2: atom_region_map[idx] = "p2"

    hl_bonds_all, hl_bond_colors_all = [], {}
    for b in mol.GetBonds():
        u = b.GetBeginAtomIdx()
        v = b.GetEndAtomIdx()
        if u in hl_colors_all and v in hl_colors_all:
            hl_bonds_all.append(b.GetIdx())
            hl_bond_colors_all[b.GetIdx()] = hl_colors_all[u]

    hl_bonds_prob, hl_bond_colors_prob = [], {}
    for b in mol.GetBonds():
        u = b.GetBeginAtomIdx()
        v = b.GetEndAtomIdx()
        if u in hl_colors_prob and v in hl_colors_prob:
            hl_bonds_prob.append(b.GetIdx())
            hl_bond_colors_prob[b.GetIdx()] = hl_colors_prob[u]

    # Generate svg_all
    try:
        drawer = rdMolDraw2D.MolDraw2DSVG(width, height)
        opts = drawer.drawOptions()
        if hasattr(opts, 'continuousHighlight'): opts.continuousHighlight = True
        if hasattr(opts, 'fillHighlights'): opts.fillHighlights = True
        opts.clearBackground = True
        opts.backgroundColour = (0.04, 0.07, 0.13, 1.0)
        
        # 선과 기본 원자를 밝게 (다크 모드용 가시성 개선)
        if hasattr(opts, 'updateAtomPalette'):
            opts.updateAtomPalette(ATOM_PALETTE)
        
        opts.bondLineWidth = 2.0
        opts.padding = 0.10
        drawer.DrawMolecule(mol,
            highlightAtoms=hl_atoms_all, highlightAtomColors=hl_colors_all, highlightAtomRadii=hl_radii_all,
            highlightBonds=hl_bonds_all, highlightBondColors=hl_bond_colors_all)
        drawer.FinishDrawing()
        svg_all = drawer.GetDrawingText()
    except Exception as e:
        return None, None, "Render failed: " + str(e)

    # Generate svg_problem (only poor/weak regions highlighted)
    try:
        drawer_p = rdMolDraw2D.MolDraw2DSVG(width, height)
        opts_p = drawer_p.drawOptions()
        if hasattr(opts_p, 'continuousHighlight'): opts_p.continuousHighlight = True
        if hasattr(opts_p, 'fillHighlights'): opts_p.fillHighlights = True
        opts_p.clearBackground = True
        opts_p.backgroundColour = (0.04, 0.07, 0.13, 1.0)
        
        # 선과 기본 원자를 밝게 (다크 모드용 가시성 개선)
        if hasattr(opts_p, 'updateAtomPalette'):
            opts_p.updateAtomPalette(ATOM_PALETTE)
            
        opts_p.bondLineWidth = 2.0
        opts_p.padding = 0.10
        drawer_p.DrawMolecule(mol,
            highlightAtoms=hl_atoms_prob, highlightAtomColors=hl_colors_prob, highlightAtomRadii=hl_radii_prob,
            highlightBonds=hl_bonds_prob, highlightBondColors=hl_bond_colors_prob)
        drawer_p.FinishDrawing()
        svg_problem = drawer_p.GetDrawingText()
    except Exception as e:
        svg_problem = svg_all

    merged_tokens, clean_smiles = _tokenize_smiles(mol, atom_region_map, atom_quality_map, atom_color_hex)

    COLOR_MAP = {"hbond":"#2ed26a","contact":"#ffd020","weak":"#ff8c1a","poor":"#eb3838","unknown":"#6b7280"}

    # 잔기 이름을 하드코딩하지 않고 structure_analysis.py가 실제 구조에서 읽어 보낸
    # anchorResidues[*].label(예: "Val166 (S1 anchor)")에서 가져온다 — 변이 구조를
    # 분석할 때도 실제 잔기명(Val166 등)이 그대로 표시된다.
    def _res_display(resseq, fallback):
        entry = anchor_residues.get(str(resseq), {})
        label = entry.get("label")
        return label.split(" (")[0] if label else fallback

    LABEL_MAP = {
        "warhead": f"Warhead ({_res_display(145, 'Cys145')} 공유결합)",
        "p1":      f"P1 pocket ({_res_display(166, 'Glu166')} / {_res_display(163, 'His163')})",
        "p2":      f"P2 pocket ({_res_display(41, 'His41')} / {_res_display(49, 'Met49')} / {_res_display(165, 'Met165')})",
    }
    region_quality_map = {}
    for region, atoms in region_atoms.items():
        if not atoms:
            qual = "unknown"
        else:
            if region == "warhead":
                oxyanion_ok = (gly143_ct >= 1 or ser144_ct >= 1 or
                               gly143_hb >= 1 or ser144_hb >= 1)
                wh_strong = cys145_covalent or cys145_ct >= 1 or oxyanion_ok
                qual = "hbond" if wh_strong else ("contact" if cys145_ct >= 1 else "poor")
            elif region == "p1":
                p1_hbond   = glu166_hb >= 1 or his163_hb >= 1
                p1_contact = glu166_ct >= 2 or his163_ct >= 2
                qual = "hbond" if p1_hbond else ("contact" if p1_contact else "weak")
            elif region == "p2":
                p2_hbond   = his41_hb >= 1
                p2_contact = his41_ct >= 2 or met49_ct >= 2 or met165_ct >= 2
                qual = "hbond" if p2_hbond else ("contact" if p2_contact else "weak")
            else:
                qual = "weak" if not poor else "poor"
        region_quality_map[region] = {
            "atomCount": len(atoms),
            "quality": qual,
            "color": COLOR_MAP.get(qual,"#6b7280"),
            "label": LABEL_MAP.get(region, region)
        }

    meta = {
        "atomGroups": {
            "warheadAtoms": sorted(region_atoms["warhead"]),
            "p1Atoms":      sorted(region_atoms["p1"]),
            "p2Atoms":      sorted(region_atoms["p2"]),
            "highlightedCount": len(hl_atoms_all)
        },
        "regionQuality": region_quality_map,
        "smilesTokens": merged_tokens,
        "canonicalSmiles": clean_smiles,
        "legend": [
            {"color": "#2ed26a", "label": "H-bond (strong binding)"},
            {"color": "#ffd020", "label": "VdW contact"},
            {"color": "#ff8c1a", "label": "Weak contact / Exposed"},
            {"color": "#eb3838", "label": "No contact / poor binding"},
        ]
    }
    return svg_all, svg_problem, meta, None


# ──────────────────────────────────────────────────────────────
# WT vs Mutant 차이만 하이라이트 (잔기 단위 등급 비교)
# ──────────────────────────────────────────────────────────────
# 포켓 하나에 잔기가 여러 개 걸쳐 있을 때(P1 = Glu166 + His163), 기존 generate()의
# "OR" 판정(둘 중 하나만 살아있어도 초록)은 개별 잔기의 손실을 가려버린다.
# 여기서는 잔기 단위로 hbond > contact > weak > poor 등급을 매겨 WT/Mutant를
# 비교하고, 그중 가장 많이 떨어진 잔기 하나를 기준으로 포켓 색을 정한다 —
# 다른 잔기가 보상해도 손실 자체는 화면에서 사라지지 않는다.
REGION_KEY_RESIDUES = {
    "warhead": [145],
    "p1": [166, 163],
    "p2": [41, 49, 165],
}
TIER_RANK = {"poor": 0, "weak": 1, "contact": 2, "hbond": 3}


def _residue_tier(anchor_residues, resseq):
    info = anchor_residues.get(str(resseq), {})
    hb = info.get("hbonds", 0)
    ct = info.get("count", 0)
    if hb >= 1: return "hbond"
    if ct >= 2: return "contact"
    if ct >= 1: return "weak"
    return "poor"


def _residue_label(anchor_residues, resseq):
    return anchor_residues.get(str(resseq), {}).get("label", f"Res{resseq}")


def generate_diff(smiles, wt_contacts, wt_hbonds, mut_contacts, mut_hbonds, width=580, height=440):
    if not RDKIT_OK:
        return None, None, "RDKit not available"
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None, None, "Invalid SMILES: " + smiles[:50]
    AllChem.Compute2DCoords(mol)

    wt_anchor = wt_contacts.get("anchorResidues", {})
    mut_anchor = mut_contacts.get("anchorResidues", {})

    region_atoms = {}
    for region, keys in REGIONS.items():
        s = set()
        for k in keys:
            s |= get_indices(mol, PHARMACOPHORE[k])
        region_atoms[region] = s

    C_LOST     = (0.92, 0.22, 0.22)  # 빨강 — H-bond 손실 등 심각한 저하
    C_WEAKENED = (1.00, 0.55, 0.10)  # 주황 — 등급 1단계 저하 (H-bond 아닌 범위)
    C_IMPROVED = (0.29, 0.56, 0.89)  # 파랑 — 오히려 개선된 경우

    region_diff = {}
    for region, residues in REGION_KEY_RESIDUES.items():
        worst_drop, worst_resseq = 0, None
        best_gain, best_resseq = 0, None
        for resseq in residues:
            wt_tier = _residue_tier(wt_anchor, resseq)
            mut_tier = _residue_tier(mut_anchor, resseq)
            delta = TIER_RANK[wt_tier] - TIER_RANK[mut_tier]  # 양수 = 저하
            if delta > worst_drop:
                worst_drop, worst_resseq = delta, resseq
            if -delta > best_gain:
                best_gain, best_resseq = -delta, resseq

        if worst_drop > 0:
            wt_tier = _residue_tier(wt_anchor, worst_resseq)
            mut_tier = _residue_tier(mut_anchor, worst_resseq)
            color = C_LOST if (worst_drop >= 2 or wt_tier == "hbond") else C_WEAKENED
            quality = "lost" if color == C_LOST else "weakened"
            reason = (f"{_residue_label(wt_anchor, worst_resseq)} → {_residue_label(mut_anchor, worst_resseq)}: "
                      f"{wt_tier} → {mut_tier}")
        elif best_gain > 0:
            wt_tier = _residue_tier(wt_anchor, best_resseq)
            mut_tier = _residue_tier(mut_anchor, best_resseq)
            color, quality = C_IMPROVED, "improved"
            reason = (f"{_residue_label(wt_anchor, best_resseq)} → {_residue_label(mut_anchor, best_resseq)}: "
                      f"{wt_tier} → {mut_tier}")
        else:
            color, quality, reason = None, "unchanged", "WT 대비 변화 없음"

        region_diff[region] = {"quality": quality, "color": color, "reason": reason}

    # warhead > p1 > p2 우선순위로 원자를 배정한다 — P1 γ-lactam(C1CCNC1=O)과
    # P2 pyrrolidine(C1CCNC1) SMARTS가 같은 고리 원자에 겹쳐 매치될 수 있어서,
    # 먼저 배정된 영역을 나중 영역이 덮어쓰지 않게 막아야 한다(generate()와 동일 규칙).
    hl_atoms, hl_colors, hl_radii = [], {}, {}
    atom_region_map, atom_quality_map, atom_color_hex = {}, {}, {}
    for region in ("warhead", "p1", "p2"):
        atoms = region_atoms.get(region, set())
        color = region_diff[region]["color"]
        quality = region_diff[region]["quality"]
        hex_color = ('#%02x%02x%02x' % tuple(int(c * 255) for c in color)) if color else None
        for idx in atoms:
            if idx in atom_region_map:
                continue
            atom_region_map[idx] = region
            atom_quality_map[idx] = quality
            if color is None:
                continue
            hl_atoms.append(idx)
            hl_colors[idx] = color
            hl_radii[idx] = 0.40
            atom_color_hex[idx] = hex_color

    hl_bonds, hl_bond_colors = [], {}
    for b in mol.GetBonds():
        u, v = b.GetBeginAtomIdx(), b.GetEndAtomIdx()
        if u in hl_colors and v in hl_colors:
            hl_bonds.append(b.GetIdx())
            hl_bond_colors[b.GetIdx()] = hl_colors[u]

    try:
        drawer = rdMolDraw2D.MolDraw2DSVG(width, height)
        opts = drawer.drawOptions()
        if hasattr(opts, 'continuousHighlight'): opts.continuousHighlight = True
        if hasattr(opts, 'fillHighlights'): opts.fillHighlights = True
        opts.clearBackground = True
        opts.backgroundColour = (0.04, 0.07, 0.13, 1.0)
        if hasattr(opts, 'updateAtomPalette'):
            opts.updateAtomPalette(ATOM_PALETTE)
        opts.bondLineWidth = 2.0
        opts.padding = 0.10
        drawer.DrawMolecule(mol,
            highlightAtoms=hl_atoms, highlightAtomColors=hl_colors, highlightAtomRadii=hl_radii,
            highlightBonds=hl_bonds, highlightBondColors=hl_bond_colors)
        drawer.FinishDrawing()
        svg = drawer.GetDrawingText()
    except Exception as e:
        return None, None, "Render failed: " + str(e)

    region_diff_out = {}
    for region, info in region_diff.items():
        color = info["color"]
        region_diff_out[region] = {
            "quality": info["quality"],
            "color": ('#%02x%02x%02x' % tuple(int(c * 255) for c in color)) if color else None,
            "reason": info["reason"],
        }

    merged_tokens, clean_smiles = _tokenize_smiles(
        mol, atom_region_map, atom_quality_map, atom_color_hex,
        problem_qualities=("lost", "weakened"),
    )

    meta = {
        "regionDiff": region_diff_out,
        "smilesTokens": merged_tokens,
        "canonicalSmiles": clean_smiles,
        "legend": [
            {"color": "#eb3838", "label": "결합 소실 (Lost)"},
            {"color": "#ff8c1a", "label": "결합 약화 (Weakened)"},
            {"color": "#4a90e2", "label": "결합 개선 (Improved)"},
        ],
    }
    return svg, meta, None


# 존재 여부 체크 전용: REGIONS의 "p1_glutamine": "NCC(=O)" 같은 사슬형 일반 아마이드
# 패턴은 펩타이드 백본 어디에나 걸려서 "고리를 실제로 바꿨는지" 판정에는 너무
# 광범위하다 — 여기서는 실제 고리/특징 구조 패턴만 남긴다.
STRUCTURAL_REGIONS_FOR_CHECK = {
    "warhead": ["warhead_nitrile", "warhead_ketoamide", "warhead_aldehyde", "warhead_vinyl", "warhead_cf3"],
    "p1":      ["p1_gamma_lactam", "p1_pyrrolidinone"],
    "p2":      ["p2_pyrrolidine"],
}


def check_region_match(smiles, region_keys):
    """편집 중인(후보) SMILES에 지정한 pharmacophore 영역(warhead/p1/p2)의 특징적인
    구조(고리/warhead)가 아직 남아있는지 확인한다. Stage 3(유도체 설계)에서 사용자가
    실제로 손실 부위를 건드렸는지 실시간으로 알려주는 데 쓰인다."""
    if not RDKIT_OK:
        return None, "RDKit not available"
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        return None, "Invalid SMILES: " + smiles[:50]

    presence = {}
    for region in region_keys:
        keys = STRUCTURAL_REGIONS_FOR_CHECK.get(region, [])
        atoms = set()
        for k in keys:
            atoms |= get_indices(mol, PHARMACOPHORE[k])
        presence[region] = len(atoms) > 0
    return presence, None


if __name__ == "__main__":
    try:
        data = json.loads(sys.stdin.read())
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        sys.exit(1)

    if data.get("mode") == "plain":
        svg, err = generate_plain(data.get("smiles", ""))
        if err:
            print(json.dumps({"success": False, "error": err}))
        else:
            print(json.dumps({"success": True, "svg": svg}, ensure_ascii=False))
        sys.exit(0)

    if data.get("mode") == "check_regions":
        presence, err = check_region_match(data.get("smiles", ""), data.get("regions", []))
        if err:
            print(json.dumps({"success": False, "error": err}))
        else:
            print(json.dumps({"success": True, "regionPresence": presence}, ensure_ascii=False))
        sys.exit(0)

    if data.get("mode") == "diff":
        svg, meta, err = generate_diff(
            data.get("smiles", ""),
            data.get("wtContacts", {}), data.get("wtHbonds", {}),
            data.get("mutContacts", {}), data.get("mutHbonds", {}),
        )
        if err:
            print(json.dumps({"success": False, "error": err}))
        else:
            print(json.dumps({
                "success": True, "svg": svg,
                "regionDiff": meta["regionDiff"],
                "smilesTokens": meta["smilesTokens"],
                "canonicalSmiles": meta["canonicalSmiles"],
                "legend": meta["legend"],
            }, ensure_ascii=False))
        sys.exit(0)

    svg_all, svg_prob, meta, err = generate(
        data.get("smiles",""),
        data.get("contacts",{}),
        data.get("hbonds",{}),
        data.get("buriedArea",{})
    )
    if err:
        print(json.dumps({"success": False, "error": err}))
    else:
        print(json.dumps({"success": True,
            "svg": svg_all,
            "svgProblemOnly": svg_prob,
            "atomGroups": meta["atomGroups"],
            "regionQuality": meta["regionQuality"],
            "smilesTokens": meta["smilesTokens"],
            "canonicalSmiles": meta["canonicalSmiles"],
            "legend": meta["legend"]}, ensure_ascii=False))