#!/usr/bin/env python3
"""
AF3 Engine Server — WSL Ubuntu에서 AlphaFold 3 추론을 관리하는 HTTP 서버

공식 GitHub (https://github.com/google-deepmind/alphafold3) 기준:
- 입력 JSON: dialect=alphafold3, version=1
- run_alphafold.py 플래그:
    --json_path: 입력 JSON 경로
    --model_dir: 모델 파라미터 디렉토리
    --db_dir: 유전체 데이터베이스 디렉토리 (MSA 검색용)
    --output_dir: 결과 출력 디렉토리
    --run_data_pipeline (기본 True): MSA/템플릿 검색 (CPU)
    --run_inference (기본 True): GPU 추론
"""

import json
import os
import glob
import shutil
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

# Mpro WT 서열 (프론트엔드에서 서열을 전달하지 않을 경우의 폴백)
WT_SEQUENCE = (
    'SGFRKMAFPSGKVEGCMVQVTCGTTTLNGLWLDDVVYCPRHVICTSEDMLNPNYEDLLIR'
    'KSNHNFLVQAGNVQLRVIGHSMQNCVLKLKVDTANPKTPKYKFVRIQPGQTFSVLACYNG'
    'SPSGVYQCAMRPNFTIKGSFLNGSCGSVGFNIDYDCVSFCYMHHMELPTGVHAGTDLEGN'
    'FYGPFVDRQTAQAAGTDTTITVNVLAWLYAAVINGDRWFLNRFTTTLNDFNLVAMKYNYEP'
    'LTQDHVDILGPLSAQTGIAVLDMCASLKELLQNGMNGRTILGSALLEDEFTPFDVVRQCSG'
    'VTFQ'
)

# 억제제별 CCD 코드 (Chemical Component Dictionary)
INHIBITOR_CCD = {
    'nirmatrelvir': ['4WI'],
    'ensitrelvir': ['PYY'],
    'leritrelvir': ['4WI'],
    'gc376': ['6W6'],
    'compound4': ['PYY'],
}

active_jobs = {}


def check_gpu():
    """GPU 사용 가능 여부 확인"""
    try:
        out = subprocess.check_output(
            ['nvidia-smi', '--query-gpu=name', '--format=csv,noheader'],
            text=True,
        )
        return True, out.strip()
    except Exception:
        return False, 'No GPU Detected'


def check_hmmer():
    """HMMER (jackhmmer) 설치 여부 확인 — 데이터 파이프라인에 필수"""
    try:
        subprocess.check_output(['which', 'jackhmmer'], text=True)
        return True
    except Exception:
        return False


def get_sequence(post_data):
    """요청에서 서열 추출. sequence 필드가 없으면 WT_SEQUENCE에 mutation 적용"""
    seq = post_data.get('sequence')
    if seq and len(seq) > 10:
        return seq.strip().upper()

    # 폴백: WT 서열에 mutation 적용
    mutations = post_data.get('mutations', [])
    seq_list = list(WT_SEQUENCE)
    for m in mutations:
        pos = m.get('position', 0) - 1
        mut_res = m.get('mutantResidue', '')
        if 0 <= pos < len(seq_list) and mut_res:
            seq_list[pos] = mut_res[0]  # 단일 아미노산 코드
    return ''.join(seq_list)


def build_af3_input_json(job_name, sequence, inhibitor_ccd_codes):
    """
    공식 AF3 입력 JSON 형식 생성 (dialect: alphafold3, version: 1)

    공식 예시:
    {
      "name": "2PV7",
      "sequences": [
        {"protein": {"id": ["A", "B"], "sequence": "GMRES..."}},
        {"ligand": {"id": ["C"], "ccdCodes": ["ATP"]}}
      ],
      "modelSeeds": [1],
      "dialect": "alphafold3",
      "version": 1
    }
    """
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
                    'ccdCodes': inhibitor_ccd_codes,
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

        # Health check
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
                'message': 'Ubuntu Local AlphaFold3 Engine Connected',
            })
            return

        # Job listing (output 디렉토리 스캔)
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

        # Static file serving (output 파일 제공)
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

            # ★ 핵심: 프론트엔드에서 전달받은 서열 직접 사용
            sequence = get_sequence(post_data)
            print(f'[AF3 Engine] Received sequence (len={len(sequence)}): {sequence[:50]}...')

            # HMMER 및 DB 존재 여부에 따라 data pipeline 활성화 결정
            hmmer_ok = check_hmmer()
            db_ok = os.path.isdir(DB_DIR) and len(os.listdir(DB_DIR)) > 3
            use_data_pipeline = hmmer_ok and db_ok

            if use_data_pipeline:
                print(f'[AF3 Engine] ✅ Data pipeline ENABLED (HMMER + databases found)')
            else:
                print(f'[AF3 Engine] ⚠️ Data pipeline DISABLED (HMMER={hmmer_ok}, DB={db_ok})')

            # 각 억제제별 입력 JSON 생성
            input_files = []
            for inh_id in inhibitor_ids:
                ccd = INHIBITOR_CCD.get(inh_id, ['4WI'])
                job_name = f'{job_id}_{inh_id}'
                af3_input = build_af3_input_json(job_name, sequence, ccd)

                in_path = os.path.join(INPUT_DIR, f'{job_name}.json')
                with open(in_path, 'w', encoding='utf-8') as f:
                    json.dump(af3_input, f, indent=2, ensure_ascii=False)
                input_files.append(in_path)
                print(f'[AF3 Engine] Created input: {in_path}')

            # GPU 추론 실행
            if run_gpu:
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
                print(f'[AF3 Engine] 🚀 Starting GPU inference: {full_cmd[:200]}...')

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
                'gpuExecutionTriggered': run_gpu,
                'dataPipelineEnabled': use_data_pipeline if run_gpu else None,
                'message': 'AlphaFold 3 input JSON generated successfully',
            })
            return

        self.send_json(404, {'error': 'Endpoint Not Found'})


if __name__ == '__main__':
    print(f'======================================================')
    print(f'🚀 [AF3 WSL Engine Server] Listening on http://0.0.0.0:{PORT}')
    print(f'📁 AF3 Root: {AF3_ROOT}')
    print(f'📁 Models:   {MODELS_DIR}')
    print(f'📁 DB:       {DB_DIR} (exists={os.path.isdir(DB_DIR)})')
    print(f'📁 Input:    {INPUT_DIR}')
    print(f'📁 Output:   {OUTPUT_DIR}')
    gpu_ok, gpu_name = check_gpu()
    hmmer_ok = check_hmmer()
    print(f'🖥️  GPU:      {gpu_name} (available={gpu_ok})')
    print(f'🔬 HMMER:    installed={hmmer_ok}')
    print(f'======================================================')
    server = HTTPServer(('0.0.0.0', PORT), AF3EngineHandler)
    server.serve_forever()
