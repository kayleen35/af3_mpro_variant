"""
docking_service.py
AF3가 예측한 mutant Mpro 구조(CIF)의 리간드 포켓에 새 SMILES를 QuickVina2로 재도킹한다.

방법론: AutoDock Vina 파이썬 바인딩은 Windows용 사전빌드 wheel이 없고 소스 빌드에는
Boost가 필요해 이 환경에서 설치할 수 없었다. 대신 conda-forge에 Windows 네이티브
바이너리로 배포되는 QuickVina2(Vina 1.1.2의 gradient-heuristic 최적화 포크, 동일한
PDBQT 포맷과 스코어링 함수 사용)를 사용한다. positive control(WT Mpro + nirmatrelvir,
7VH8)로 검증한 결과 -8.7~-8.8 kcal/mol이 나와 발표자료 값(-8.58 kcal/mol)과 근접하게
재현됨을 확인했다.

입력(stdin JSON): { "receptorCifPath": "...", "ligandSmiles": "..." }
출력(stdout JSON): { "success": true, "bindingAffinity": -8.7, "engine": "..." }
"""

import sys
import json
import os
import tempfile
import subprocess

try:
    import gemmi
    from rdkit import Chem
    from rdkit.Chem import AllChem
except Exception as e:
    print(json.dumps({"success": False, "error": f"의존성 로드 실패: {str(e)}"}))
    sys.exit(1)

ENV_ROOT = os.path.dirname(sys.executable)
QVINA_EXE = os.path.join(ENV_ROOT, 'Library', 'bin', 'qvina2.exe')
MK_PREPARE_RECEPTOR = os.path.join(ENV_ROOT, 'Scripts', 'mk_prepare_receptor.exe')
MK_PREPARE_LIGAND = os.path.join(ENV_ROOT, 'Scripts', 'mk_prepare_ligand.exe')

BOX_SIZE = (20.0, 20.0, 20.0)  # positive control 스파이크에서 검증된 크기

# 결정구조에 흔한 결정화 첨가물/용매 — 리간드 포즈 중심 계산에서 제외
# (AF3 출력은 이런 잔기가 없어 보통 무관하지만, 실제 결정구조로 검증할 때 필요)
SOLVENT_RESIDUES = {'HOH', 'DMS', 'EDO', 'GOL', 'SO4', 'PO4', 'ACT', 'PEG', 'IPA', 'MPD', 'TRS'}


def extract_receptor_and_ligand_centroid(structure_path, work_dir):
    """AF3 출력 CIF(또는 PDB)에서 단백질만 남긴 receptor.pdb와, 원래 리간드(chain C,
    없으면 용매를 제외한 hetero 잔기) 포즈의 중심 좌표를 반환한다."""
    st = gemmi.read_structure(structure_path)
    st.setup_entities()

    coords = []
    for model in st:
        for chain in model:
            for res in chain:
                is_ligand_chain = chain.name == 'C'
                is_het_non_solvent = res.het_flag == 'H' and res.name not in SOLVENT_RESIDUES
                if is_ligand_chain or is_het_non_solvent:
                    for atom in res:
                        coords.append((atom.pos.x, atom.pos.y, atom.pos.z))
        break

    if not coords:
        raise ValueError('구조 파일에서 리간드(chain C) 좌표를 찾을 수 없습니다.')

    center = (
        sum(c[0] for c in coords) / len(coords),
        sum(c[1] for c in coords) / len(coords),
        sum(c[2] for c in coords) / len(coords),
    )

    st.remove_ligands_and_waters()
    st.remove_empty_chains()
    receptor_pdb_path = os.path.join(work_dir, 'receptor.pdb')
    st.write_pdb(receptor_pdb_path)

    return receptor_pdb_path, center


def prepare_receptor_pdbqt(receptor_pdb_path, work_dir):
    receptor_pdbqt_path = os.path.join(work_dir, 'receptor.pdbqt')
    result = subprocess.run(
        [MK_PREPARE_RECEPTOR,
         '--read_pdb', receptor_pdb_path,
         '-o', os.path.join(work_dir, 'receptor'),
         '--write_pdbqt', receptor_pdbqt_path,
         '--default_altloc', 'A',
         '--allow_bad_res'],
        capture_output=True, text=True, timeout=120,
    )
    if result.returncode != 0 or not os.path.exists(receptor_pdbqt_path):
        raise RuntimeError(f'mk_prepare_receptor 실패: {result.stderr or result.stdout}')
    return receptor_pdbqt_path


def prepare_ligand_pdbqt(smiles, work_dir):
    mol = Chem.MolFromSmiles(smiles)
    if not mol:
        raise ValueError(f'유효하지 않은 SMILES: {smiles}')
    mol = Chem.AddHs(mol)
    cid = AllChem.EmbedMolecule(mol, randomSeed=42)
    if cid < 0:
        raise ValueError('3D 좌표 생성 실패 (RDKit embedding)')
    AllChem.MMFFOptimizeMolecule(mol)

    sdf_path = os.path.join(work_dir, 'ligand.sdf')
    writer = Chem.SDWriter(sdf_path)
    writer.write(mol)
    writer.close()

    ligand_pdbqt_path = os.path.join(work_dir, 'ligand.pdbqt')
    result = subprocess.run(
        # --rigid_macrocycles: 유도체 설계 과정에서 고리를 확장/변경하는 경우가 많아
        # meeko의 매크로사이클 자동 절단(G-type pseudo atom)이 QuickVina2가 모르는
        # 원자 타입을 만들어낼 수 있다. 고리를 그대로 rigid하게 두어 이를 방지한다.
        [MK_PREPARE_LIGAND, '-i', sdf_path, '-o', ligand_pdbqt_path, '--rigid_macrocycles'],
        capture_output=True, text=True, timeout=60,
    )
    if result.returncode != 0 or not os.path.exists(ligand_pdbqt_path):
        raise RuntimeError(f'mk_prepare_ligand 실패: {result.stderr or result.stdout}')
    return ligand_pdbqt_path


def run_qvina(receptor_pdbqt_path, ligand_pdbqt_path, center, work_dir):
    out_path = os.path.join(work_dir, 'docked.pdbqt')
    log_path = os.path.join(work_dir, 'docked.log')
    result = subprocess.run(
        [QVINA_EXE,
         '--receptor', receptor_pdbqt_path,
         '--ligand', ligand_pdbqt_path,
         '--center_x', str(center[0]), '--center_y', str(center[1]), '--center_z', str(center[2]),
         '--size_x', str(BOX_SIZE[0]), '--size_y', str(BOX_SIZE[1]), '--size_z', str(BOX_SIZE[2]),
         '--exhaustiveness', '8',
         '--num_modes', '5',
         '--out', out_path,
         '--log', log_path],
        capture_output=True, text=True, timeout=300,
    )
    if result.returncode != 0:
        raise RuntimeError(f'QuickVina2 실행 실패: {result.stderr or result.stdout}')

    best_affinity = None
    with open(log_path, encoding='utf-8', errors='replace') as f:
        for line in f:
            parts = line.split()
            if len(parts) >= 2 and parts[0] == '1':
                try:
                    best_affinity = float(parts[1])
                except ValueError:
                    pass
                break

    if best_affinity is None:
        raise RuntimeError('QuickVina2 로그에서 결합에너지를 파싱하지 못했습니다.')
    return best_affinity


def dock(receptor_structure_path, ligand_smiles):
    with tempfile.TemporaryDirectory(prefix='af3_dock_') as work_dir:
        receptor_pdb_path, center = extract_receptor_and_ligand_centroid(receptor_structure_path, work_dir)
        receptor_pdbqt_path = prepare_receptor_pdbqt(receptor_pdb_path, work_dir)
        ligand_pdbqt_path = prepare_ligand_pdbqt(ligand_smiles, work_dir)
        return run_qvina(receptor_pdbqt_path, ligand_pdbqt_path, center, work_dir)


if __name__ == '__main__':
    try:
        input_data = json.loads(sys.stdin.read())
        receptor_path = input_data['receptorCifPath']
        ligand_smiles = input_data['ligandSmiles']

        affinity = dock(receptor_path, ligand_smiles)

        print(json.dumps({
            'success': True,
            'bindingAffinity': round(affinity, 2),
            'engine': 'QuickVina2 (AutoDock Vina scoring function)',
        }))
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}))
        sys.exit(1)
