# 🧬 AF3-MutanX — SARS-CoV-2 Mpro Variant Resistance Platform

> **AF3-MutanX** — AlphaFold3 + Mutant + X. AF3 구조 예측으로 변이체(Mutant)의 결합 붕괴 원인이라는 미지수(X)를 찾아내고, 그 지점을 겨냥한 유도체를 설계해 재결합을 검증하는 전 과정을 담았습니다.

**로컬 WSL2 AlphaFold3 GPU 엔진 기반 SARS-CoV-2 메인 프로테아제(Mpro, 3CLpro) 변이체 구조 분석 → 결합 취약부 진단 → 유도체 설계 → 실측 재검증까지 이어지는 풀스택 연구용 파이프라인**

---

## 🌟 프로젝트 개요

- WT(야생형) Mpro와 사용자 지정 변이체(Mutant) Mpro에 대해 실제 억제제 결합을 AlphaFold3로 예측·비교
- 결합력이 약해진 부위를 구조적으로 진단하고, 해당 부위를 보완하는 유도체(derivative)를 직접 설계
- RDKit 물성 계산 · QuickVina2 재도킹 · AF3 재추론 3가지 실측 방법으로 유도체 개선 여부 검증
- 위 전 과정을 하나의 흐름으로 연결한 연구용 웹 애플리케이션

> [!IMPORTANT]
> **데이터 무결성 원칙**
> 1. **임의 수치 생성 금지** — IC50/Ki/결합 친화도 등 임의의 생체 지표를 하드코딩하거나 난수 생성하지 않음. 계산 미완료 시 `EmptyState`/`LoadingState`/`ErrorState`로 정직하게 표시
> 2. **Mpro Homodimer Mode 고정** — Mpro는 2량체 상태에서만 촉매 활성을 가지므로 모든 AF3 요청을 `dimerMode: true`로 고정
> 3. **Research Use Only** — 임상 진단·치료 의사결정에 사용 불가한 인실리코 연구 전용 도구
> 4. **포트폴리오/학습 목적** — 배포를 전제하지 않아 보안 하드닝(인증, 인메모리 저장소 영속화 등)은 의도적으로 최소화

---

## 🔬 전체 파이프라인 (8단계)

- 사이드바 순서 그대로, 각 단계가 이전 단계의 **실측 결과**를 그대로 이어받아 사용
- 일반적인 SAR 지식이 아니라 "이번 변이/이번 후보에서 실제로 계산된 값" 기반으로 다음 단계 진행

| 단계 | 라우트 | 화면 | 하는 일 |
|---|---|---|---|
| 0 | `/sequence` | 서열 및 변이 입력 | Wuhan-Hu-1 WT 서열 또는 FASTA 직접 입력, 변이 표기(`E166A/L167F` 등) 지정 |
| 1 | `/screening` | 도킹 내성 지도 | RDKit 규칙 기반 스크리닝으로 억제제 후보군 1차 필터링 |
| — | `/prediction` | AF3 결합 예측 (실행) | 선택 억제제에 대해 WT/Mutant 각각 AlphaFold3 GPU 추론 실행 (WSL2, dimer 고정) |
| 2 | `/interaction` | 결합 붕괴 분석 | WT vs Mutant의 잔기별 접촉수·H-bond·pLDDT·매몰 면적 실측 비교 |
| — | `/molecule` | 결합 취약부 2D 시각화 | WT 대비 Mutant에서 **실제로 약해지거나 소실된** 파마코포어 영역만 2D 구조에 하이라이트 |
| 3 | `/optimization` | 유도체 설계 | Step 7에서 넘어온 실측 손실 부위 참고해 SMILES 직접 수정, RDKit 즉시 재분석 |
| 4 | `/reevaluation` | 결합 재검증 | parent 대비 물성 변화 + **QuickVina2 재도킹** + **AF3 GPU 재추론** 3중 검증 |
| 5 | `/final-ranking` | ADMET 평가 | 전 후보를 구조 복원력·독성·비강 전달 적합성 3축 다차원 순위표로 정리 |

---

## 🏗️ 시스템 아키텍처

```
┌─────────────────────────────┐        ┌──────────────────────────────┐        ┌───────────────────────────┐
│  React 19 + TS + Vite        │  HTTP  │  Node/Express Proxy (:8000)   │  HTTP  │  WSL2 Ubuntu (:8080)        │
│  Tailwind v4, Dark Navy UI   │ ─────► │  server/index.js              │ ─────► │  af3_engine_server.py       │
│  (Windows, :5173)             │        │  - jobStore (in-memory Map)   │        │  - AlphaFold3 GPU 추론       │
└─────────────────────────────┘        │  - Python 스크립트 spawn       │        │  - run_alphafold.py         │
                                        │    (conda env: af3-rdkit)      │        │  - RTX 4070, 모델 가중치     │
                                        └───────────┬────────────────────┘        └──────────────────────────┘
                                                    │ spawn(conda run -n af3-rdkit python ...)
                                        ┌───────────▼────────────────────┐
                                        │  RDKit 기반 Python 스크립트들     │
                                        │  structure_analysis.py          │  CIF 파싱 → 접촉/H-bond/pLDDT
                                        │  molecule_highlight.py          │  2D SVG + WT-vs-Mutant diff 하이라이트
                                        │  derivative_analysis.py         │  후보 SMILES 물성/ADMET 계산
                                        │  docking_service.py             │  QuickVina2 (AutoDock Vina 대체)
                                        │  screening_service.py           │  RDKit 규칙 기반 1차 스크리닝
                                        └──────────────────────────────────┘
```

- Windows 노트북에서 프론트/백엔드 구동
- 실제 GPU 연산(AlphaFold3, RTX 4070)은 **WSL2 Ubuntu 내 별도 HTTP 서버**가 담당
- Node 서버는 WSL 엔진과 RDKit Python 스크립트(별도 conda 환경 `af3-rdkit`) 사이를 중개하는 얇은 Proxy 역할

> Windows용 `vina` PyPI 사전 빌드 wheel 부재(Boost 빌드 필요)로 AutoDock Vina 대신 conda-forge의 **QuickVina2**(`qvina2.exe`) 사용. 포지티브 컨트롤 결합에너지 값 재현으로 검증 완료.

---

## 🛠️ 기술 스택

- 각 계층은 **완전히 분리된 런타임**에서 동작
- AlphaFold3는 Linux 전용 → WSL2에 별도 venv(Python 3.12)
- 화학 연산은 Windows conda(Python 3.10)에 분리 배치 → 두 환경의 RDKit 버전 상이

### 프론트엔드 (Windows · 브라우저)

| 구분 | 기술 | 버전 |
|---|---|---|
| 프레임워크 | React | 19.2.7 |
| 언어 | TypeScript | ~6.0.2 |
| 빌드 도구 | Vite | 8.1.1 (`@vitejs/plugin-react` 6.0.3) |
| 스타일링 | Tailwind CSS | 4.3.2 (`@tailwindcss/vite`, `@theme` 토큰 방식) |
| 라우팅 | React Router | 7.18.1 (SPA · 13개 화면) |
| HTTP 클라이언트 | axios | 1.18.1 |
| 아이콘 | lucide-react | 1.23.0 |
| 린터 | oxlint | 1.71.0 |
| 3D 뷰어 | 3Dmol.js | CDN 동적 로드 (WebGL) |

### 백엔드 (Windows · Node.js 프록시 `:8000`)

| 구분 | 기술 | 버전 |
|---|---|---|
| 웹 프레임워크 | Express | 4.21.2 |
| HTTP 클라이언트 | axios | 1.7.9 (WSL 엔진 프록시·폴링) |
| CORS | cors | 2.8.5 |
| 환경변수 | dotenv | 16.4.7 |
| Job 저장소 | 인메모리 `Map` | 영속화 없음 — 재시작 시 초기화 |

**역할 2가지**

- WSL AF3 엔진에 대한 **프록시 · 상태 폴링**
- `child_process.spawn`으로 Python 스크립트 실행, **stdin/stdout JSON 통신** 오케스트레이션

### 화학 연산 계층 (Windows · conda `af3-rdkit`)

| 구분 | 기술 | 버전 |
|---|---|---|
| Python | | 3.10.20 |
| 화학정보학 | RDKit | 2026.03.4 |
| 구조 파일 처리 | gemmi | 0.7.5 |
| 도킹 전처리 | Meeko | 0.7.1 (`mk_prepare_receptor` / `mk_prepare_ligand` → PDBQT) |
| 도킹 엔진 | QuickVina2 | 2.1.0 (AutoDock Vina 스코어링 함수) |
| 수치 연산 | numpy / scipy | 1.26.4 / 1.15.3 |

**RDKit 사용 모듈**

- `Descriptors` — MW · cLogP · TPSA · HBD/HBA
- `rdMolDescriptors`
- `FilterCatalog` — PAINS A/B/C · BRENK
- `rdMolDraw2D` — 2D SVG 렌더링
- `AllChem` — SMARTS 매칭

> `structure_analysis.py`는 **외부 구조 라이브러리 없이 mmCIF 파서 자체 구현**(BioPython·MDAnalysis 미사용). 접촉 4.0 Å, 수소결합 3.5 Å 도너/억셉터 규칙 판정.

### GPU 추론 서버 (WSL2 Ubuntu `:8080`)

| 구분 | 기술 | 버전/사양 |
|---|---|---|
| OS | Ubuntu | 24.04.1 LTS (WSL2, 커널 6.18.33.2) |
| GPU | NVIDIA GeForce RTX 4070 | 12,282 MiB · 드라이버 591.86 |
| 구조 예측 모델 | AlphaFold 3 | 3.0.4.dev5 |
| ML 프레임워크 | JAX / jaxlib | 0.9.1 |
| GPU 백엔드 | jax-cuda12-plugin / pjrt | 0.9.1 |
| 신경망 라이브러리 | Flax · Haiku · Optax · Chex | 0.12.2 · — · 0.2.6 · 0.1.91 |
| 수치 연산 | numpy / scipy / RDKit | 2.4.1 / 1.17.0 / 2025.9.4 |
| MSA 도구 | HMMER (`jackhmmer`, `hmmsearch`, `nhmmer`) | |
| 유전체 DB | `public_databases` | 627 GB |
| 모델 가중치 | `models/af3.bin` | |
| Python | | 3.12 (venv) |

- 엔진 서버 `af3_engine_server.py` — **Python 표준 라이브러리 `http.server.HTTPServer`만으로 구현**(외부 웹 프레임워크 없음)
- `subprocess.Popen`으로 `run_alphafold.py` 비동기 실행 후 로그 파일 폴링 방식

### 데이터 흐름

```
브라우저 (React 19 + 3Dmol.js)
    │ axios
    ▼
Node.js / Express :8000  (Windows)
    ├─ axios ──────────────▶ HTTPServer :8080  (WSL2 Ubuntu)
    │                            └─ subprocess ─▶ run_alphafold.py
    │                                   └─ AlphaFold3 + JAX + CUDA12 ─▶ RTX 4070
    │
    └─ spawn ──────────────▶ conda af3-rdkit  (Windows · Python 3.10)
                                 ├─ RDKit    물성 · SMARTS · 2D · PAINS/BRENK
                                 ├─ gemmi    구조 파싱
                                 └─ Meeko ─▶ QuickVina2  도킹
```

---

## 🧩 핵심 기술 메커니즘

### 1. 파마코포어 영역 모델 (Warhead / P1 / P2)

- Nirmatrelvir 계열 억제제 결합 관여 3개 영역을 SMARTS 패턴 + 고정 "핵심 잔기 번호"로 정의 (`server/molecule_highlight.py`)
  - **Warhead** — Cys145와의 공유결합 지점 (nitrile, ketoamide 등)
  - **P1 pocket** — γ-lactam 고리, Glu166/His163과 H-bond
  - **P2 pocket** — 소수성 포켓, His41/Met49/Met165
- 잔기 번호(41, 49, 145, 163, 165, 166)는 **Mpro의 알려진 결합 포켓 구조 자체**를 지시 → 어떤 아미노산으로 변이가 오든(E166A/E166V 등) 별도 설정 없이 자동 추적
- **한계** — 고정 포켓 잔기 목록 밖의 변이(예: 표면/루프의 H172Y)는 2D 하이라이트 추적 대상 아님. 접촉수·pLDDT 등 다른 실측 지표로 별도 확인 필요

### 2. WT vs Mutant Diff 하이라이트

- `structure_analysis.py` — CIF에서 잔기별 접촉수·H-bond 직접 파싱 (외부 구조 라이브러리 없이 순수 Python)
- `molecule_highlight.py` — WT/Mutant 동일 잔기를 `TIER_RANK`(hbond > contact > weak > poor) 기준 비교
- 등급 하락 영역만 2D SVG에 색상 표기 — 빨강(소실) / 주황(약화) / 파랑(개선)
- 변이체별 잔기명 자동 변환 표시 (`get_residue_name` / `format_residue_label`) — 예: E166A 변이체 → "Ala166"

### 3. Stage 3 → Stage 4: 실측 데이터 이어받기

- `MoleculeHighlightPage`의 diff 결과(소실/약화 영역, 해당 SMILES 토큰)를 `sessionStorage`에 저장
- `OptimizationPage`로 그대로 전달
- 사용자 SMILES 수정 시 `checkRegionPresence`(narrow SMARTS 패턴)로 "손실 부위 실제 수정 여부" 실시간 체크

### 4. Stage 4의 세 가지 실측 재검증

1. **RDKit 물성 재계산** — MW/TPSA/cLogP, Lipinski 기반 ADMET 플래그, parent 대비 Δ
2. **QuickVina2 재도킹** (`docking_service.py`) — parent와 candidate를 AF3 예측 mutant 포켓 좌표에 동일 조건 재도킹, 결합에너지(kcal/mol) 비교
3. **AF3 GPU 재추론** — candidate SMILES로 mutant 서열에 대해 **AlphaFold3 전체 추론 재실행**
   - WSL 엔진의 `customInhibitors` 파라미터로 카탈로그 외 임의 SMILES 주입
   - 결과 구조에 `structure_analysis.py` 재실행 → parent의 원본 mutant 결합과 실측 비교
   - `structuralInteractionRecovery`(`improved`/`similar`/`worsened`) 실제 값 산출
   - GPU 추론 특성상 분 단위 이상 소요 → 202 즉시 응답 후 프론트 폴링

- Stage 5(최종 순위표)는 위 3개 실측값(특히 `structuralInteractionRecovery`, `bindingAffinityDelta`)을 그대로 읽어 "Top Structural / Top Nasal Feasibility / Balanced / High Risk"로 자동 분류 — 별도 재계산 로직 없이 Stage 4 결과 직결

### 5. Job 저장소

- `server/index.js`의 `jobStore` — **인메모리 `Map`**
- 서버 재시작 시 도킹/AF3 재검증 결과 초기화
- WT/Mutant 구조 파일 목록은 `/api/sync-wsl-jobs`로 WSL 출력 폴더에서 재동기화 가능
- 별도 DB/파일 영속화 없음 — 포트폴리오 목적의 의도적 단순화

---

## 📂 디렉토리 구조

```text
af3/
├── server/
│   ├── index.js                # Express Proxy — WSL AF3 엔진 중계 + Python 스크립트 spawn + Job 상태 관리
│   ├── structure_analysis.py   # CIF 파싱 → 접촉/H-bond/pLDDT/매몰면적 계산 (외부 구조 라이브러리 불필요)
│   ├── molecule_highlight.py   # RDKit 2D SVG 생성 + WT-vs-Mutant diff 하이라이트 + SMARTS 존재 체크
│   ├── derivative_analysis.py  # 후보 SMILES 물성(MW/TPSA/cLogP) + ADMET 플래그 계산
│   ├── docking_service.py      # QuickVina2 래퍼 (meeko로 리간드/리셉터 PDBQT 준비)
│   ├── screening_service.py    # RDKit 규칙 기반 1차 스크리닝
│   └── optimization_service.py # RDKit 기반 구조 변경 후보 자동 제안 (보조 엔드포인트)
├── af3_engine_server_new.py    # WSL 배포용 AF3 엔진 스테이징 사본 — 수정 후 /home/af3/af3/af3_engine_server.py로 수동 복사 필요
├── src/
│   ├── api/analysisApi.ts      # 전체 REST API 클라이언트 (Stage 0~5 전 구간)
│   ├── pages/                  # 13개 워크플로우 페이지 (Dashboard ~ FinalRanking)
│   ├── components/
│   │   ├── common/             # EmptyState/LoadingState/ErrorState, RiskBadge, MetricCard 등
│   │   ├── layout/              # AppLayout, Sidebar(단계 번호/뱃지), Topbar
│   │   ├── inhibitor/           # InhibitorCard
│   │   └── structure/           # StructureViewerPlaceholder, ResiduePanel
│   ├── types/                  # analysis/inhibitor/optimization/screening/interaction 타입 정의
│   └── routes/AppRoutes.tsx    # 라우트 정의
├── package.json                 # 프론트엔드 (vite dev 기본 :5173, 점유 시 자동 할당)
└── vite.config.ts
```

---

## ⚙️ 실행 방법 (Windows + WSL2)

### 사전 조건

- Windows — Node.js, Miniconda (`af3-rdkit` 환경에 RDKit, meeko, gemmi 설치)
- WSL2 Ubuntu — AlphaFold3 GPU 환경 (`/home/af3/af3/`), NVIDIA GPU 드라이버

### 1. 프론트엔드

```bash
npm install
npm run dev        # Vite dev server (기본 5173, 점유 시 자동으로 다음 포트)
```

### 2. 백엔드 Proxy 서버

```bash
cd server && npm install   # 최초 1회
node server/index.js       # http://localhost:8000
```

### 3. WSL AlphaFold3 엔진

- WSL 내 `af3_engine_server.py` 기동 상태 필수 (`http://localhost:8080`)
- 로컬에서 엔진 코드 수정 시 배포 절차:

```bash
# Windows → WSL로 배포
cp af3_engine_server_new.py //wsl.localhost/Ubuntu/home/af3/af3/af3_engine_server.py

# WSL 안에서 재시작
wsl -d Ubuntu -- bash -c "pkill -f af3_engine_server.py; nohup python3 /home/af3/af3/af3_engine_server.py > /home/af3/af3/engine.log 2>&1 &"
```

### 4. 확인

```text
🚀 [AF3 Proxy Server] Running on http://localhost:8000
🔗 [Target Ubuntu Engine] Configured to: http://localhost:8080
```

- 브라우저에서 Vite 기동 주소로 접속

---

## 📡 주요 API 요약

| 메서드 | 경로 | 설명 |
|---|---|---|
| `POST` | `/api/analysis` | 신규 분석 Job 생성 (`AF3-MPRO-{변이라벨}-{타임스탬프}` 형식) |
| `POST` | `/api/analysis/:jobId/predict` | 선택 억제제에 대해 AF3 GPU 추론 시작 (WSL 중계) |
| `POST` | `/api/structure/analyze` | CIF → 접촉/H-bond/pLDDT 실측 분석 |
| `POST` | `/api/molecule/highlight` | 2D SVG 생성 — `mode: plain / diff / check_regions` 또는 기본(절대 품질) |
| `POST` | `/api/derivative/analyze` | 후보 SMILES RDKit 물성 계산 |
| `POST` | `/api/analysis/:jobId/optimize` | 유도체 후보 저장 (Stage 3 → Stage 4) |
| `POST` | `/api/analysis/:jobId/reevaluate` | parent 대비 물성 재평가 |
| `POST` | `/api/analysis/:jobId/reevaluate/dock` | QuickVina2 재도킹 |
| `POST`/`GET` | `/api/analysis/:jobId/reevaluate/af3` | AF3 GPU 재추론 시작/상태 폴링 |
| `POST` | `/api/sync-wsl-jobs` | WSL 출력 폴더에서 Job 메타데이터 재동기화 (서버 재시작 후 복구용) |

---

## ⚠️ 알려진 한계

- **Job 인메모리 저장** — 서버 재시작 시 도킹/AF3 재검증 결과 소실 (구조 파일 목록만 재동기화 가능)
- **파마코포어 하이라이트 범위** — warhead/P1/P2 핵심 잔기(41, 49, 145, 163, 165, 166) 밖의 변이는 2D 하이라이트 미반영
- **억제제 카탈로그가 Nirmatrelvir 계열로 한정**
  - 2D 취약부 진단이 `nitrile/aldehyde/ketoamide warhead + 5원 γ-lactam P1` SMARTS에 의존 → 패턴 이탈 억제제는 warhead/P1 미인식 또는 오탐 발생
  - 이에 카탈로그를 해당 계열 5종(+플랫폼 설계 유도체 A-2)으로 축소
  - 비공유결합 계열(ensitrelvir, x77, ml188 …) 또는 bisulfite/hydroxymethyl-ketone warhead 계열(gc376, pf00835231, boceprevir …) 재지원 시 `server/molecule_highlight.py`의 `PHARMACOPHORE` 패턴 확장 선행 필요
- **6원 lactam P1 미인식** — A-2 유도체처럼 P1 고리를 6원환으로 확장한 구조는 `p1_gamma_lactam`(5원환) 패턴 미매칭 → 설계 의도인 확장 고리를 P1으로 인식하지 못함 (generic 패턴으로만 매칭)
- **`structuralInteractionRecovery` 판정 기준** — H-bond 개수 변화를 1차 신호로 삼는 단순 휴리스틱 (RMSD, 포즈 유사도 등 미포함)
- **인증/권한 없음** — 배포 대상 아닌 포트폴리오 프로젝트로 의도적 생략

---
*Developed under Strict Academic & Structural Integrity Best Practices — Research Use Only.*
