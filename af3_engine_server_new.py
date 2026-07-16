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

# 16종 억제제 SMILES 매핑 (CCD 코드 완전 대체)
INHIBITOR_SMILES = {
    # 공유결합 (Covalent)
    'nirmatrelvir':     'CC1([C@@H]2[C@H]1[C@H](N(C2)C(=O)[C@H](C(C)(C)C)NC(=O)C(F)(F)F)C(=O)N[C@@H](C[C@@H]3CCNC3=O)C#N)C',
    'ibuzatrelvir':     'CC(C)(C)[C@@H](C(=O)N1C[C@@H](C[C@H]1C(=O)N[C@@H](C[C@@H]2CCNC2=O)C#N)C(F)(F)F)NC(=O)OC',
    'simnotrelvir':     'CC(C)(C)[C@@H](C(=O)N1CC2(C[C@H]1C(=O)N[C@@H](C[C@@H]3CCNC3=O)C#N)SCCS2)NC(=O)C(F)(F)F',
    'leritrelvir':      'C1CCC(CC1)[C@@H](C(=O)N2C[C@@H]3CCC[C@@H]3[C@H]2C(=O)N[C@@H](C[C@@H]4CCNC4=O)C(=O)C(=O)NC5CCCC5)NC(=O)C(F)(F)F',
    'pomotrelvir':      'C1C[C@H](C(=O)NC1)C[C@@H](C#N)NC(=O)[C@H](CC2CC2)NC(=O)C3=CC4=C(N3)C(=CC=C4)Cl',
    'gc376':            'CC(C)C[C@@H](C(=O)N[C@@H](C[C@@H]1CCNC1=O)[C@@H](O)S(=O)(=O)O)NC(=O)OCc2ccccc2',
    'pf00835231':       'CC(C)C[C@@H](C(=O)N[C@@H](C[C@@H]1CCNC1=O)C(=O)CO)NC(=O)C2=CC3=C(N2)C=CC=C3OC',
    'boceprevir':       'CC1([C@@H]2[C@H]1[C@H](N(C2)C(=O)[C@H](C(C)(C)C)NC(=O)NC(C)(C)C)C(=O)N[C@@H](CC3CCC3)[C@H](C(=O)N)O)C',
    'bofutrelvir':      'C1CCC(CC1)C[C@@H](C(=O)N[C@@H](C[C@@H]2CCNC2=O)C=O)NC(=O)C3=CC4=CC=CC=C4N3',
    # 비공유결합 (Non-covalent)
    'ensitrelvir':      'CN1C=C2C=C(C(=CC2=N1)Cl)NC3=NC(=O)N(C(=O)N3CC4=CC(=C(C=C4F)F)F)CC5=NN(C=N5)C',
    'x77':              'CC(C)(C)C1=CC=C(C=C1)N([C@H](C2=CN=CC=C2)C(=O)NC3CCCCC3)C(=O)C4=CN=CN4',
    'ml188':            'CC(C)(C)C1=CC=C(C=C1)N([C@H](C2=CN=CC=C2)C(=O)NC(C)(C)C)C(=O)C3=CC=CO3',
    'mat_pos_e194df51': 'C1CC1(CS(=O)(=O)N2C[C@H](C3=C(C2)C=CC(=C3)Cl)C(=O)NC4=CN=CC5=CC=CC=C54)C#N',
    'mat_pos_b3e365b9': 'C1COC2=C([C@@H]1C(=O)NC3=CN=CC4=CC=CC=C43)C=C(C=C2)Cl',
    'secutrelvir':      'C1C2(CC1(F)F)CN(C2)C3=C(C(=O)N(C(=O)N3CC#N)C4=CC(=CN=C4)Cl)C5=CC(=C(C=C5)F)Cl',
    'olgotrelvir':      'CC(C)C[C@@H](C(=O)N[C@@H](C[C@@H]1CCNC1=O)CO)NC(=O)c2cc3ccccc3[nH]2',
}

active_jobs = {}


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
                'message': 'Ubuntu Local AlphaFold3 Engine — 16 SMILES-based inhibitors',
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
                            except Exception:
                                pass
                        jobs.append({
                            'jobId': job_dir,
                            'completed': len(cif_files) > 0,
                            'cifFile': os.path.basename(cif_files[0]) if cif_files else None,
                            'metrics': metrics,
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
                smiles = INHIBITOR_SMILES.get(inh_id)
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
