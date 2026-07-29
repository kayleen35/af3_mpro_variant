#!/usr/bin/env python3
"""
AF3 Engine Server — SMILES 기반 16종 억제제 지원
공식 AF3 입력 형식: dialect=alphafold3, version=1
리간드: smiles 필드 사용 (ccdCodes 대신)
"""

import json
import os
import glob
import subprocess
import math
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, unquote

PORT = 8080
AF3_ROOT = '/home/af3/af3'
INPUT_DIR = os.path.join(AF3_ROOT, 'input')
OUTPUT_DIR = os.path.join(AF3_ROOT, 'output')
MODELS_DIR = os.path.join(AF3_ROOT, 'models')
DB_DIR = os.path.join(AF3_ROOT, 'public_databases')
RUN_ALPHAFOLD = os.path.join(AF3_ROOT, 'run_alphafold.py')
PYTHON_BIN = os.path.join(AF3_ROOT, '.venv', 'bin', 'python')

os.makedirs(INPUT_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

WT_SEQUENCE = (
    'SGFRKMAFPSGKVEGCMVQVTCGTTTLNGLWLDDVVYCPRHVICTSEDMLNPNYEDLLIR'
    'KSNHNFLVQAGNVQLRVIGHSMQNCVLKLKVDTANPKTPKYKFVRIQPGQTFSVLACYNG'
    'SPSGVYQCAMRPNFTIKGSFLNGSCGSVGFNIDYDCVSFCYMHHMELPTGVHAGTDLEGN'
    'FYGPFVDRQTAQAAGTDTTITVNVLAWLYAAVINGDRWFLNRFTTTLNDFNLVAMKYNYEP'
    'LTQDHVDILGPLSAQTGIAVLDMCASLKELLQNGMNGRTILGSALLEDEFTPFDVVRQCSG'
    'VTFQ'
)

# 억제제 SMILES 매핑 (CCD 코드 완전 대체)
# 플랫폼 2D 취약부 진단이 인식 가능한 계열(nitrile/aldehyde/ketoamide warhead +
# 5원 γ-lactam P1)만 유지 — 상세 배경은 src/types/inhibitor.ts 주석 참고
INHIBITOR_SMILES = {
    # 공유결합 (Covalent)
    'nirmatrelvir':     'CC1([C@@H]2[C@H]1[C@H](N(C2)C(=O)[C@H](C(C)(C)C)NC(=O)C(F)(F)F)C(=O)N[C@@H](C[C@@H]3CCNC3=O)C#N)C',
    'ibuzatrelvir':     'CC(C)(C)[C@@H](C(=O)N1C[C@@H](C[C@H]1C(=O)N[C@@H](C[C@@H]2CCNC2=O)C#N)C(F)(F)F)NC(=O)OC',
    'simnotrelvir':     'CC(C)(C)[C@@H](C(=O)N1CC2(C[C@H]1C(=O)N[C@@H](C[C@@H]3CCNC3=O)C#N)SCCS2)NC(=O)C(F)(F)F',
    'leritrelvir':      'C1CCC(CC1)[C@@H](C(=O)N2C[C@@H]3CCC[C@@H]3[C@H]2C(=O)N[C@@H](C[C@@H]4CCNC4=O)C(=O)C(=O)NC5CCCC5)NC(=O)C(F)(F)F',
    'bofutrelvir':      'C1CCC(CC1)C[C@@H](C(=O)N[C@@H](C[C@@H]2CCNC2=O)C=O)NC(=O)C3=CC4=CC=CC=C4N3',
    # 플랫폼 자체 설계 유도체 (실제 발표 화합물 아님, src/types/inhibitor.ts와 동일 SMILES 유지)
    # P1 γ-lactam 5원환 → 6원환(valerolactam) 확장으로 E166V S1 포켓 Gap 보상 시도
    'a2_derivative':    'CC1([C@@H]2[C@H]1[C@H](N(C2)C(=O)[C@H](C(C)(C)C)NC(=O)C(F)(F)F)C(=O)N[C@@H](C[C@@H]3CCCCNC3=O)C#N)C',
}

active_jobs = {}

def calculate_interactions_from_cif(cif_path):
    try:
        atoms = []
        with open(cif_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        in_atom_site = False
        headers = []
        for line in lines:
            if line.startswith('_atom_site.'):
                in_atom_site = True
                headers.append(line.strip().split('.')[1])
            elif in_atom_site and (line.startswith('ATOM') or line.startswith('HETATM')):
                parts = line.split()
                try:
                    idx_type = headers.index('type_symbol')
                    idx_comp = headers.index('label_comp_id')
                    idx_asym = headers.index('label_asym_id')
                    idx_seq = headers.index('label_seq_id')
                    idx_x = headers.index('Cartn_x')
                    idx_y = headers.index('Cartn_y')
                    idx_z = headers.index('Cartn_z')
                    idx_atom = headers.index('label_atom_id')
                except ValueError:
                    idx_type, idx_atom, idx_comp, idx_asym, idx_seq = 2, 3, 5, 6, 8
                    idx_x, idx_y, idx_z = 10, 11, 12
                    
                atom = {
                    'type': parts[idx_type],
                    'atom_name': parts[idx_atom],
                    'res_name': parts[idx_comp],
                    'chain': parts[idx_asym],
                    'res_seq': parts[idx_seq],
                    'x': float(parts[idx_x]),
                    'y': float(parts[idx_y]),
                    'z': float(parts[idx_z])
                }
                atoms.append(atom)
                
        protein_atoms = [a for a in atoms if a['chain'] in ['A', 'B']]
        ligand_atoms = [a for a in atoms if a['chain'] == 'C']
        
        if not ligand_atoms:
            return None
            
        cys145_sg = [a for a in protein_atoms if a['chain'] == 'A' and str(a['res_seq']) == '145' and a['res_name'] == 'CYS' and a['atom_name'] == 'SG']
        
        cys_dist = 999.0
        if cys145_sg:
            sg = cys145_sg[0]
            for la in ligand_atoms:
                if la['type'] != 'H':
                    dist = math.sqrt((sg['x'] - la['x'])**2 + (sg['y'] - la['y'])**2 + (sg['z'] - la['z'])**2)
                    if dist < cys_dist:
                        cys_dist = dist
                        
        h_bond_count = 0
        prot_donors = [a for a in protein_atoms if a['type'] in ['N', 'O', 'S']]
        lig_donors = [a for a in ligand_atoms if a['type'] in ['N', 'O', 'S']]
        for pa in prot_donors:
            for la in lig_donors:
                dist = math.sqrt((pa['x'] - la['x'])**2 + (pa['y'] - la['y'])**2 + (pa['z'] - la['z'])**2)
                if dist < 3.5:
                    h_bond_count += 1
                    
        has_clash = False
        clash_count = 0
        prot_heavy = [a for a in protein_atoms if a['type'] != 'H']
        lig_heavy = [a for a in ligand_atoms if a['type'] != 'H']
        for pa in prot_heavy:
            for la in lig_heavy:
                dist = math.sqrt((pa['x'] - la['x'])**2 + (pa['y'] - la['y'])**2 + (pa['z'] - la['z'])**2)
                if dist < 2.0:
                    clash_count += 1
                    if clash_count > 2:
                        has_clash = True
                        break
            if has_clash:
                break
                
        a166_f167 = [a for a in protein_atoms if a['chain'] == 'A' and str(a['res_seq']) in ['166', '167'] and a['type'] != 'H']
        a166_dist = 999.0
        for pa in a166_f167:
            for la in lig_heavy:
                dist = math.sqrt((pa['x'] - la['x'])**2 + (pa['y'] - la['y'])**2 + (pa['z'] - la['z'])**2)
                if dist < a166_dist:
                    a166_dist = dist
        
        a166_interaction = 'Yes' if a166_dist < 4.0 else 'No'
        
        return {
            'cys145Distance': round(cys_dist, 2),
            'hBondCount': h_bond_count,
            'stericClash': 'Yes' if has_clash else 'No',
            'a166f167Interaction': a166_interaction
        }
    except Exception as e:
        print("Error parsing CIF:", e)
        return None


def check_gpu():
    try:
        out = subprocess.check_output(
            ['nvidia-smi', '--query-gpu=name', '--format=csv,noheader'], text=True)
        return True, out.strip()
    except Exception:
        return False, 'No GPU Detected'


def check_hmmer():
    try:
        subprocess.check_output(['which', 'jackhmmer'], text=True)
        return True
    except Exception:
        return False


def get_sequence(post_data):
    seq = post_data.get('sequence')
    if seq and len(seq) > 10:
        return seq.strip().upper()
    mutations = post_data.get('mutations', [])
    seq_list = list(WT_SEQUENCE)
    for m in mutations:
        pos = m.get('position', 0) - 1
        mut_res = m.get('mutantResidue', '')
        if 0 <= pos < len(seq_list) and mut_res:
            seq_list[pos] = mut_res[0]
    return ''.join(seq_list)


def build_af3_input_json(job_name, sequence, inhibitor_smiles):
    """공식 AF3 입력 JSON (dialect: alphafold3, version: 1), 리간드 smiles 방식"""
    return {
        'name': job_name,
        'modelSeeds': [1],
        'sequences': [
            {
                'protein': {
                    'id': ['A', 'B'],
                    'sequence': sequence,
                }
            },
            {
                'ligand': {
                    'id': ['C'],
                    'smiles': inhibitor_smiles,
                }
            },
        ],
        'dialect': 'alphafold3',
        'version': 1,
    }


class AF3EngineHandler(BaseHTTPRequestHandler):
    def send_cors_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_cors_headers()
        self.end_headers()

    def send_json(self, status_code, data):
        self.send_response(status_code)
        self.send_cors_headers()
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def do_GET(self):
        parsed_path = urlparse(self.path).path

        if parsed_path == '/health':
            gpu_ok, gpu_name = check_gpu()
            hmmer_ok = check_hmmer()
            self.send_json(200, {
                'status': 'ok',
                'af3Version': 'AlphaFold 3 (Ubuntu WSL Engine)',
                'gpuAvailable': gpu_ok,
                'gpuName': gpu_name,
                'hmmerInstalled': hmmer_ok,
                'dbDir': DB_DIR,
                'dbExists': os.path.isdir(DB_DIR),
                'supportedInhibitors': list(INHIBITOR_SMILES.keys()),
                'message': f'Ubuntu Local AlphaFold3 Engine — {len(INHIBITOR_SMILES)} SMILES-based inhibitors',
            })
            return

        if parsed_path == '/inhibitors':
            self.send_json(200, {
                'inhibitors': [{'id': k, 'smiles': v} for k, v in INHIBITOR_SMILES.items()]
            })
            return

        if parsed_path == '/jobs':
            jobs = []
            if os.path.exists(OUTPUT_DIR):
                for job_dir in sorted(os.listdir(OUTPUT_DIR)):
                    full_path = os.path.join(OUTPUT_DIR, job_dir)
                    if os.path.isdir(full_path):
                        cif_files = glob.glob(os.path.join(full_path, '*_model.cif'))
                        summary_files = glob.glob(os.path.join(full_path, '*_summary_confidences.json'))
                        metrics = None
                        if summary_files:
                            try:
                                with open(summary_files[0], 'r', encoding='utf-8') as sf:
                                    metrics = json.load(sf)
                                
                                # Process CIF for structural interactions and cache it.
                                # 캐시 파일 읽기/쓰기 실패(예: root 소유 output 폴더에 대한
                                # PermissionError)가 방금 계산에 성공한 struct_metrics까지
                                # 버리지 않도록 I/O는 별도 try/except로 감싼다.
                                struct_metrics_file = os.path.join(full_path, 'structural_metrics_cache.json')
                                struct_metrics = None
                                if os.path.exists(struct_metrics_file):
                                    try:
                                        with open(struct_metrics_file, 'r', encoding='utf-8') as smf:
                                            struct_metrics = json.load(smf)
                                    except Exception as e:
                                        print(f"Structural metrics cache read error (non-fatal): {e}")
                                elif cif_files:
                                    struct_metrics = calculate_interactions_from_cif(cif_files[0])
                                    if struct_metrics:
                                        try:
                                            with open(struct_metrics_file, 'w', encoding='utf-8') as smf:
                                                json.dump(struct_metrics, smf)
                                        except Exception as e:
                                            print(f"Structural metrics cache write error (non-fatal): {e}")

                                if struct_metrics:
                                    metrics.update(struct_metrics)

                            except Exception as e:
                                print(f"Metrics processing error: {e}")
                        jobs.append({
                            'jobId': job_dir,
                            'completed': len(cif_files) > 0,
                            'cifFile': os.path.basename(cif_files[0]) if cif_files else None,
                            'metrics': metrics,
                            'createdAt': __import__('datetime').datetime.utcfromtimestamp(
                                os.path.getmtime(full_path)
                            ).strftime('%Y-%m-%dT%H:%M:%SZ'),
                        })
            self.send_json(200, {'jobs': jobs})
            return

        if parsed_path.startswith('/output/'):
            parts = [unquote(p) for p in parsed_path.split('/') if p]
            if len(parts) >= 3:
                file_path = os.path.join(OUTPUT_DIR, *parts[1:])
                if os.path.exists(file_path) and os.path.isfile(file_path):
                    self.send_response(200)
                    self.send_cors_headers()
                    if file_path.endswith('.cif') or file_path.endswith('.mmcif'):
                        self.send_header('Content-Type', 'chemical/x-cif; charset=utf-8')
                    elif file_path.endswith('.json'):
                        self.send_header('Content-Type', 'application/json; charset=utf-8')
                    else:
                        self.send_header('Content-Type', 'text/plain; charset=utf-8')
                    self.end_headers()
                    with open(file_path, 'rb') as f:
                        self.wfile.write(f.read())
                    return
            self.send_json(404, {'error': 'File Not Found'})
            return

        self.send_json(404, {'error': 'Endpoint Not Found'})

    def do_POST(self):
        parsed_path = urlparse(self.path).path

        if parsed_path == '/predict':
            content_len = int(self.headers.get('Content-Length', 0))
            raw_body = self.rfile.read(content_len).decode('utf-8', errors='ignore')
            try:
                post_data = json.loads(raw_body)
            except Exception:
                post_data = {}

            job_id = post_data.get('jobId', 'AF3-JOB-NEW')
            inhibitor_ids = post_data.get('inhibitorIds', ['nirmatrelvir'])
            # Stage 3 유도체 후보처럼 16종 카탈로그에 없는 임의 SMILES를 재결합 검증할 때 사용
            # ({inhibitorId: smiles} 형태 — 카탈로그에 없는 id에 한해 여기서 조회)
            custom_inhibitors = post_data.get('customInhibitors', {})
            run_gpu = post_data.get('fullInference', False)

            sequence = get_sequence(post_data)
            print(f'[AF3 Engine] Sequence len={len(sequence)}: {sequence[:40]}...')

            hmmer_ok = check_hmmer()
            db_ok = os.path.isdir(DB_DIR) and len(os.listdir(DB_DIR)) > 3
            use_data_pipeline = hmmer_ok and db_ok
            print(f'[AF3 Engine] Data pipeline: {use_data_pipeline} (HMMER={hmmer_ok}, DB={db_ok})')

            input_files = []
            skipped = []
            for inh_id in inhibitor_ids:
                smiles = INHIBITOR_SMILES.get(inh_id) or custom_inhibitors.get(inh_id)
                if not smiles:
                    print(f'[AF3 Engine] WARNING: Unknown inhibitor: {inh_id}, skipping')
                    skipped.append(inh_id)
                    continue
                job_name = f'{job_id}_{inh_id}'
                af3_input = build_af3_input_json(job_name, sequence, smiles)
                in_path = os.path.join(INPUT_DIR, f'{job_name}.json')
                with open(in_path, 'w', encoding='utf-8') as f:
                    json.dump(af3_input, f, indent=2, ensure_ascii=False)
                input_files.append(in_path)
                print(f'[AF3 Engine] Created: {in_path}')

            if run_gpu and input_files:
                log_file = os.path.join(OUTPUT_DIR, f'{job_id}_gpu.log')
                run_cmds = []
                for inp_file in input_files:
                    cmd_parts = [
                        PYTHON_BIN, RUN_ALPHAFOLD,
                        f'--json_path={inp_file}',
                        f'--model_dir={MODELS_DIR}',
                        f'--output_dir={OUTPUT_DIR}',
                    ]
                    if use_data_pipeline:
                        cmd_parts.append(f'--db_dir={DB_DIR}')
                    else:
                        cmd_parts.append('--norun_data_pipeline')
                    run_cmds.append(' '.join(cmd_parts))

                full_cmd = ' && '.join(run_cmds)
                print(f'[AF3 Engine] Starting GPU inference...')
                proc = subprocess.Popen(
                    ['bash', '-c', full_cmd],
                    stdout=open(log_file, 'a'),
                    stderr=subprocess.STDOUT,
                )
                active_jobs[job_id] = {
                    'pid': proc.pid,
                    'status': 'running',
                    'logFile': log_file,
                    'totalJobs': len(input_files),
                    'dataPipeline': use_data_pipeline,
                }

            self.send_json(202, {
                'status': 'accepted',
                'jobId': job_id,
                'sequenceLength': len(sequence),
                'inputFilesCreated': input_files,
                'skippedInhibitors': skipped,
                'gpuExecutionTriggered': run_gpu,
                'dataPipelineEnabled': use_data_pipeline if run_gpu else None,
            })
            return

        self.send_json(404, {'error': 'Endpoint Not Found'})


if __name__ == '__main__':
    print('=' * 60)
    print(f'[AF3 WSL Engine] http://0.0.0.0:{PORT}')
    print(f'Inhibitors: {len(INHIBITOR_SMILES)} (SMILES-based)')
    gpu_ok, gpu_name = check_gpu()
    hmmer_ok = check_hmmer()
    print(f'GPU: {gpu_name} (available={gpu_ok})')
    print(f'HMMER: {hmmer_ok}')
    print('=' * 60)
    server = HTTPServer(('0.0.0.0', PORT), AF3EngineHandler)
    server.serve_forever()
