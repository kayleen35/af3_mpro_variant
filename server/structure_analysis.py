"""
structure_analysis.py
AF3 출력 CIF/PDB 파일을 파싱하여 ChimeraX 동등 구조 분석을 수행합니다.

분석 항목:
  1. pLDDT (B-factor 기반)
  2. 리간드-단백질 총 접촉수 (distance < 4.0 Å)
  3. 주요 잔기별 접촉수 (Cys145, Glu166 등 – 서열에서 자동 탐색)
  4. 수소결합 (H-bond) 수 및 목록
  5. 매몰 면적 (buried area, 근사값)
"""

import sys
import json
import math
import os

# ──────────────────────────────────────────────
# 거리 계산 유틸
# ──────────────────────────────────────────────
def dist(a, b):
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))

# ──────────────────────────────────────────────
# CIF / PDB 파서 (의존성 없는 순수 파이썬)
# ──────────────────────────────────────────────
def parse_structure(filepath: str):
    """
    반환: { 'protein': [...], 'ligand': [...] }
    각 원자: { 'chain', 'resname', 'resseq', 'name', 'element', 'xyz': [x,y,z], 'bfactor' }
    """
    ext = os.path.splitext(filepath)[1].lower()
    if ext in ('.cif', '.mmcif'):
        return parse_cif(filepath)
    else:
        return parse_pdb(filepath)


def parse_cif(filepath: str):
    protein, ligand = [], []
    with open(filepath, encoding='utf-8', errors='replace') as f:
        lines = f.readlines()

    # _atom_site 컬럼 헤더 찾기
    in_atom_site = False
    columns = []
    records = []

    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if line.startswith('_atom_site.'):
            in_atom_site = True
            columns.append(line.split('.')[1])
            i += 1
            continue
        if in_atom_site and line and not line.startswith('_') and not line.startswith('#'):
            if line == 'loop_':
                i += 1
                continue
            # 레코드 파싱
            tokens = line.split()
            if len(tokens) >= len(columns) and columns:
                rec = dict(zip(columns, tokens))
                records.append(rec)
        elif in_atom_site and (line.startswith('_') and not line.startswith('_atom_site')):
            in_atom_site = False
        i += 1

    def safe_float(v, default=0.0):
        try:
            return float(v)
        except Exception:
            return default

    def safe_int(v, default=0):
        try:
            return int(v)
        except Exception:
            return default

    for rec in records:
        grp = rec.get('group_PDB', 'ATOM')
        chain = rec.get('auth_asym_id') or rec.get('label_asym_id', 'A')
        resname = rec.get('label_comp_id', 'UNK')
        resseq = safe_int(rec.get('auth_seq_id') or rec.get('label_seq_id') or 0)
        aname = rec.get('label_atom_id', '')
        element = rec.get('type_symbol', '')
        x = safe_float(rec.get('Cartn_x', 0))
        y = safe_float(rec.get('Cartn_y', 0))
        z = safe_float(rec.get('Cartn_z', 0))
        bfactor = safe_float(rec.get('B_iso_or_equiv', 0))

        atom = {'chain': chain, 'resname': resname, 'resseq': resseq,
                'name': aname, 'element': element, 'xyz': [x, y, z], 'bfactor': bfactor}

        if grp == 'HETATM' or chain not in ('A', 'B'):
            ligand.append(atom)
        else:
            protein.append(atom)

    return {'protein': protein, 'ligand': ligand}


def parse_pdb(filepath: str):
    protein, ligand = [], []
    with open(filepath, encoding='utf-8', errors='replace') as f:
        for line in f:
            rec = line[:6].strip()
            if rec not in ('ATOM', 'HETATM'):
                continue
            chain = line[21].strip()
            resname = line[17:20].strip()
            resseq = int(line[22:26].strip() or 0)
            aname = line[12:16].strip()
            element = line[76:78].strip()
            try:
                x, y, z = float(line[30:38]), float(line[38:46]), float(line[46:54])
                bfactor = float(line[60:66]) if line[60:66].strip() else 0.0
            except Exception:
                continue
            atom = {'chain': chain, 'resname': resname, 'resseq': resseq,
                    'name': aname, 'element': element, 'xyz': [x, y, z], 'bfactor': bfactor}
            if rec == 'HETATM':
                ligand.append(atom)
            else:
                protein.append(atom)
    return {'protein': protein, 'ligand': ligand}


# ──────────────────────────────────────────────
# 분석 함수들
# ──────────────────────────────────────────────
CONTACT_CUTOFF = 4.0      # Å – ChimeraX contacts 기본값과 동일
HBOND_CUTOFF   = 3.5      # Å – D-A 거리
HBOND_ANGLE    = 120.0    # °  – 최소 D-H-A 각도 (수소 없을 때 완화)

DONOR_ELEMENTS    = {'N', 'O', 'S'}
ACCEPTOR_ELEMENTS = {'N', 'O', 'S', 'F'}

# Mpro 주요 잔기 위치와 포켓 내 역할 (표준 번호 체계, PDB 7VH8/WT 기준 포지션).
# 잔기 이름(Glu/Cys/His 등)은 하드코딩하지 않고 실제 구조에서 읽어와 동적으로 라벨을
# 만든다 — 변이 구조(예: E166V)를 분석하면 라벨도 자동으로 "Val166"으로 표시된다.
ANCHOR_ROLES = {
    145: 'warhead',
    143: 'oxyanion hole',
    144: 'oxyanion hole',
    166: 'S1 anchor',
    163: 'S1',
    41:  'S2 catalytic',
    49:  'S2 hydrophobic',
    165: 'S2 hydrophobic',
    164: None,
    187: None,
}


def get_residue_name(protein, resseq):
    """해당 위치(resseq)의 실제 잔기명(3-letter code)을 구조에서 조회한다."""
    for a in protein:
        if a['resseq'] == resseq:
            return a['resname']
    return None


def format_residue_label(resname, resseq, role):
    display = resname.strip().capitalize() if resname else 'Unk'
    base = f'{display}{resseq}'
    return f'{base} ({role})' if role else base


def compute_plddt(protein):
    bfactors = [a['bfactor'] for a in protein if a['bfactor'] > 0]
    if not bfactors:
        return {'mean': None, 'min': None, 'max': None, 'note': 'No pLDDT data'}
    mean_b = sum(bfactors) / len(bfactors)
    return {
        'mean': round(mean_b, 2),
        'min':  round(min(bfactors), 2),
        'max':  round(max(bfactors), 2),
        'classification': classify_plddt(mean_b),
    }


def classify_plddt(v):
    if v >= 90: return 'Very High (dark blue)'
    if v >= 70: return 'Confident (light blue)'
    if v >= 50: return 'Low (yellow)'
    return 'Very Low (orange)'


def compute_contacts(protein, ligand, cutoff=CONTACT_CUTOFF):
    """리간드-단백질 원자 쌍 중 거리 < cutoff인 것"""
    contacts = []
    for la in ligand:
        for pa in protein:
            d = dist(la['xyz'], pa['xyz'])
            if d <= cutoff:
                contacts.append({
                    'lig_atom': la['name'],
                    'prot_chain': pa['chain'],
                    'prot_resname': pa['resname'],
                    'prot_resseq': pa['resseq'],
                    'prot_atom': pa['name'],
                    'distance': round(d, 3),
                })
    return contacts


def group_contacts_by_residue(contacts):
    from collections import Counter
    c = Counter()
    for ct in contacts:
        c[(ct['prot_resseq'], ct['prot_resname'])] += 1
    return [{'resseq': k[0], 'resname': k[1], 'count': v} for k, v in sorted(c.items())]


def contacts_with_residue(contacts, resseq):
    return [c for c in contacts if c['prot_resseq'] == resseq]


def compute_hbonds(protein, ligand, d_cutoff=HBOND_CUTOFF):
    """
    단순 거리 기반 H-bond 근사:
    리간드 Donor/Acceptor 원자 ↔ 단백질 Acceptor/Donor 원자, 거리 < cutoff
    """
    hbonds = []
    for la in ligand:
        el_l = la['element'].upper()
        if el_l not in DONOR_ELEMENTS and el_l not in ACCEPTOR_ELEMENTS:
            continue
        for pa in protein:
            el_p = pa['element'].upper()
            if el_p not in DONOR_ELEMENTS and el_p not in ACCEPTOR_ELEMENTS:
                continue
            d = dist(la['xyz'], pa['xyz'])
            if d <= d_cutoff:
                hbonds.append({
                    'lig_atom': la['name'],
                    'lig_element': el_l,
                    'prot_resname': pa['resname'],
                    'prot_resseq': pa['resseq'],
                    'prot_atom': pa['name'],
                    'prot_element': el_p,
                    'distance': round(d, 3),
                })
    # 중복 제거 (같은 원자쌍)
    seen = set()
    unique = []
    for h in hbonds:
        key = (h['lig_atom'], h['prot_resseq'], h['prot_atom'])
        if key not in seen:
            seen.add(key)
            unique.append(h)
    return unique


def compute_covalent_contact(protein, ligand, cys_resseq=145, cutoff=3.0):
    """
    Cys145 SG 원자와 리간드 원자 사이 거리 cutoff 이내인 쌍을 탐지합니다.
    PDB 7VH8 기준: nirmatrelvir nitrile C — Cys145 SG ~1.8 Å (thioimidate 공유결합).
    AlphaFold3는 pre-reaction pose 예측이므로 2.0~3.0 Å 범위를 '공유결합 가능 포즈'로 판단합니다.
    반환: (is_covalent: bool, min_dist: float)
    """
    sg_atoms = [a for a in protein
                if a['resseq'] == cys_resseq
                and a['name'].upper() in ('SG', 'S')]
    if not sg_atoms or not ligand:
        return False, None
    min_dist = None
    for sg in sg_atoms:
        for la in ligand:
            d = dist(sg['xyz'], la['xyz'])
            if min_dist is None or d < min_dist:
                min_dist = d
    is_covalent = min_dist is not None and min_dist <= cutoff
    return is_covalent, round(min_dist, 3) if min_dist is not None else None


def compute_buried_area(protein, ligand, probe=1.4):
    """
    매몰 면적 근사 (Solvent Accessible Surface Area 차분):
    실제 SASA 계산은 freesasa가 필요하나, 여기서는
    리간드 원자와 접촉하는 단백질 원자 수 × 평균 원자 표면적으로 근사합니다.
    단위: Å²
    """
    ATOM_RADII = {'C': 1.7, 'N': 1.55, 'O': 1.52, 'S': 1.8,
                  'F': 1.47, 'CL': 1.75, 'BR': 1.85, 'P': 1.8}
    DEFAULT_R = 1.7
    buried = 0.0
    for la in ligand:
        r_l = ATOM_RADII.get(la['element'].upper(), DEFAULT_R)
        for pa in protein:
            r_p = ATOM_RADII.get(pa['element'].upper(), DEFAULT_R)
            contact_d = r_l + r_p + 2 * probe
            d = dist(la['xyz'], pa['xyz'])
            if d < contact_d:
                # 겹치는 구형 캡 면적 근사
                overlap = (contact_d - d) / (2 * probe)
                buried += math.pi * r_p ** 2 * min(overlap, 1.0)
    return round(buried, 1)


def compute_ligand_surface_area(ligand, probe=1.4):
    """
    리간드 단독 표면적 근사.
    각 원자를 (vdW 반경 + probe) 구면으로 취급하여 합산합니다.
    (겹침 보정 없음 — 빠른 근사값, ChimeraX 기준과 비슷한 order)
    단위: Å²
    """
    ATOM_RADII = {'C': 1.7, 'N': 1.55, 'O': 1.52, 'S': 1.8,
                  'F': 1.47, 'CL': 1.75, 'BR': 1.85, 'P': 1.8}
    DEFAULT_R = 1.7
    total = 0.0
    for la in ligand:
        r = ATOM_RADII.get(la['element'].upper(), DEFAULT_R)
        total += 4 * math.pi * (r + probe) ** 2
    return round(total, 1)


# ──────────────────────────────────────────────
# 메인
# ──────────────────────────────────────────────
def main():
    raw = sys.stdin.read()
    req = json.loads(raw)

    filepath   = req.get('filepath', '')
    content    = req.get('content', '')
    inhibitor  = req.get('inhibitorId', 'unknown')
    variant    = req.get('variant', 'unknown')

    if content:
        import tempfile
        fd, temp_path = tempfile.mkstemp(suffix='.cif')
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            f.write(content)
        struct = parse_structure(temp_path)
        try:
            os.remove(temp_path)
        except Exception:
            pass
    elif filepath and os.path.isfile(filepath):
        struct = parse_structure(filepath)
    else:
        print(json.dumps({'error': f'File not found: {filepath} and no content provided'}))
        sys.exit(1)

    protein  = struct['protein']
    ligand   = struct['ligand']

    if not ligand:
        print(json.dumps({'error': 'No ligand atoms found in structure file'}))
        sys.exit(1)

    # 1. pLDDT
    plddt = compute_plddt(protein)

    # 2. 전체 접촉
    all_contacts = compute_contacts(protein, ligand)
    contacts_by_res = group_contacts_by_residue(all_contacts)

    # 3. 주요 잔기별 접촉
    # 4. 수소결합 먼저 계산
    hbonds = compute_hbonds(protein, ligand)

    # Cys145 공유결합 감지 (PDB 7VH8: SG-C ~1.8 Å thioimidate)
    cys145_covalent, cys145_covalent_dist = compute_covalent_contact(protein, ligand)

    anchor_contacts = {}

    # 잔기별 약리학적 H-bond에 관여하는 측쇄 원자 목록 (PDB 7VH8 기반)
    # 변이가 발생하면 이 원자들이 사라지므로 hbonds=0이 됨
    # 예: E166V → OE1/OE2 없어짐, H163A → ND1/NE2 없어짐
    SIDECHAIN_HBOND_ATOMS = {
        145: None,            # Cys145: 별도 처리 (SG)
        163: {'ND1', 'NE2'},  # His163: 이미다졸 N (P1 γ-lactam과 H-bond)
        166: {'OE1', 'OE2'},  # Glu166: 카복실 O (P1 γ-lactam과 H-bond, 핵심!)
        41:  {'ND1', 'NE2'},  # His41: 이미다졸 N (촉매 dyad)
        # Gly143, Ser144: backbone N-H가 주요 H-bond → 모든 원자 허용
        # Met49, Met165: 소수성 → H-bond 거의 없음, 전체 허용
    }

    for resseq, role in ANCHOR_ROLES.items():
        label = format_residue_label(get_residue_name(protein, resseq), resseq, role)
        cts = contacts_with_residue(all_contacts, resseq)
        if cts:
            if resseq == 145:
                # Cys145: SG 기반 H-bond만 (백본 N/O 제외)
                hbs = [h for h in hbonds if h['prot_resseq'] == resseq
                       and h['prot_atom'] not in ('N', 'O')]
            elif resseq in SIDECHAIN_HBOND_ATOMS and SIDECHAIN_HBOND_ATOMS[resseq]:
                # 측쇄 원자 지정된 잔기: 해당 측쇄 원자와의 H-bond만 카운트
                # E166V → Val에 OE1/OE2 없음 → hbonds=0 → P1 = VdW 접촉으로 정확히 표시
                sc_atoms = SIDECHAIN_HBOND_ATOMS[resseq]
                hbs = [h for h in hbonds if h['prot_resseq'] == resseq
                       and h['prot_atom'] in sc_atoms]
            else:
                # Gly143, Ser144, Met49, Met165, His164, Asp187 등:
                # backbone 포함 모든 원자 허용 (oxyanion hole은 backbone이 주역)
                hbs = [h for h in hbonds if h['prot_resseq'] == resseq]

            entry = {
                'label':   label,
                'count':   len(cts),
                'hbonds':  len(hbs),
                'details': cts[:10],  # 최대 10개만
            }
            if resseq == 145:
                entry['covalent'] = cys145_covalent
                entry['covalentDist'] = cys145_covalent_dist
            anchor_contacts[str(resseq)] = entry

    # 5. 매몰 면적
    buried = compute_buried_area(protein, ligand)
    lig_area = compute_ligand_surface_area(ligand)  # 리간드 단독 표면적 (원자 구면 합산)
    buried_pct = round(buried / max(lig_area, 1) * 100, 1)

    result = {
        'inhibitorId': inhibitor,
        'variant':     variant,
        'plddt': plddt,
        'contacts': {
            'total':         len(all_contacts),
            'byResidue':     contacts_by_res,
            'anchorResidues': anchor_contacts,
        },
        'hbonds': {
            'count':   len(hbonds),
            'details': hbonds[:20],
        },
        'buriedArea': {
            'buried_A2':  buried,
            'ligand_A2':  lig_area,
            'percent':    buried_pct,
        },
        'chimeraxCommands': {
            'plddt':    'color bfactor #1 palette alphafold',
            'contacts_total': f'contacts #1 & ligand restrict #1/A',
            'contacts_anchor': [
                f'contacts #1 & ligand restrict #1:{resseq}  ← {format_residue_label(get_residue_name(protein, resseq), resseq, role)}'
                for resseq, role in ANCHOR_ROLES.items()
            ],
            'buried':   'measure buriedarea #1 & ligand withAtoms2 #1/A',
            'hbonds':   'hbonds #1 & ligand restrict #1/A log true',
        },
    }

    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
