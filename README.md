# 🧬 SARS-CoV-2 Mpro-Variant Binder Research Platform

> This platform implements the SARS-CoV-2 Mpro-variant inhibitor research project **conceived, designed, and analyzed by Kyunghee Kook**. The web application scaffolding was implemented on top of that research foundation.

**Local Ubuntu AlphaFold3–based structural analysis and inhibitor-complex modeling platform for SARS-CoV-2 main protease (Mpro / 3CLpro) variants — frontend/backend for five core inhibitors.**

### Credits

| Role | Contributor |
| --- | --- |
| Concept, experimental design, data preprocessing & analysis | **Kyunghee Kook** |
| Platform implementation & server infrastructure | **Youngjae Cho** |

---

*(English first, 한국어 아래 / Korean version below.)*

---

## 🌟 Overview & Core Principles

This is a research-oriented full-stack web application composed of a premium Dark Navy UI frontend (React 19 + TypeScript + Vite + Tailwind CSS v4) and a Node.js/Express proxy server that mediates requests to a local AlphaFold3 API.

> **Strict design & data-integrity principles**
>
> 1. **No fabricated efficacy values or dummy data.** The platform never auto-generates or injects arbitrary IC50 / Ki values, binding-affinity scores, or distance values. When no real AlphaFold3 result is available, it displays only an `EmptyState`, `LoadingState`, or `ErrorState`.
> 2. **Fixed Mpro homodimer mode.** Because SARS-CoV-2 Mpro is catalytically active as a homodimer, all AlphaFold3 modeling requests run with `dimerMode: true`.
> 3. **Five core inhibitors, aligned to the study.** Configured only with standard ligands targeting the Mpro active pocket: Nirmatrelvir, Ensitrelvir, Leritrelvir, GC376, and Compound 4.
> 4. **Research Use Only.** This is an in-silico tool for basic structural research and candidate exploration; it must never be used for clinical diagnosis or treatment decisions.

---

## 📂 System Architecture & Directory Structure

```
c:\dev\healthcare\af3\
├── server/                     # Backend proxy server (Node.js/Express, Port 8000)
│   ├── index.js                # AF3 engine relay router and local simulation routine
│   ├── package.json            # Proxy server dependencies
│   └── .env.example            # Proxy server env template
├── src/                        # Frontend source (React + Vite + TS)
│   ├── api/                    # Axios custom client + 6 REST API communication layers
│   │   ├── client.ts
│   │   └── analysisApi.ts
│   ├── services/               # 7 core interfaces for the local Ubuntu AF3 connection
│   │   └── af3Service.ts       # prepareInputSequence, submitAf3Job, checkUbuntuServerHealth, ...
│   ├── components/             # Modular UI components
│   │   ├── common/             # ResearchBadge, EmptyState, LoadingState, ErrorState, StatusPill
│   │   ├── layout/             # Topbar, Sidebar, AppLayout (Dark Navy Glassmorphism)
│   │   ├── inhibitor/          # InhibitorCard (no dummy metrics)
│   │   └── structure/          # StructureViewerPlaceholder, ResiduePanel (H41, C145 mapping)
│   ├── pages/                  # 7 primary workflow pages
│   │   ├── DashboardPage.tsx
│   │   ├── SequenceInputPage.tsx
│   │   ├── MutationAnalysisPage.tsx
│   │   ├── BindingPredictionPage.tsx
│   │   ├── InhibitorComparisonPage.tsx
│   │   ├── StructureViewerPage.tsx
│   │   └── ResearchReportPage.tsx
│   ├── types/                  # AnalysisStatus, MutationInput, Inhibitor, ... (8 core types)
│   └── utils/                  # Wuhan-Hu-1 reference info, 9 core residue constants, sequence validation
├── .env.example                # Frontend env template
├── package.json                # Unified build & server run scripts
└── vite.config.ts              # Vite + Tailwind v4 plugin config
```

---

## 💻 Local Testing Guide (Windows)

On a Windows laptop the real Linux AlphaFold3 engine does not run, so when the proxy server (`server/index.js`) detects a failed engine connection, it does **not** fabricate efficacy numbers — it only simulates the geometric-substitution and status-polling workflow.

**1. Install all dependencies**

```bash
# 1. Root frontend packages
npm install

# 2. Backend proxy server packages
npm run install:server
```

**2. Run the backend proxy server (Port 8000)**

```bash
npm run server
```

Example healthy startup message:

```
========================================================
🚀 [AF3 Proxy Server] Running on http://localhost:8000
🔗 [Target Ubuntu Engine] Configured to: http://localhost:8080
🛡️  [Mode] Research Use Only (No Dummy Biological Metrics)
========================================================
```

**3. Run the frontend dev server (Port 5173)**

```bash
npm run dev
```

Open `http://localhost:5173` to test the Dark Navy web application.

---

## 🐧 Git Migration & Linking to an Ubuntu Desktop

The source code is OS-independent and separates communication addresses via environment variables, so it can be pushed via Git and pulled on the Ubuntu desktop where AlphaFold3 actually runs.

**1. Git push (from the laptop)**

```bash
git add .
git commit -m "feat: complete Mpro-Variant Binder frontend and proxy scaffolding"
git push origin main
```

**2. Pull & configure environment variables (on the Ubuntu desktop)**

Frontend env (`.env`):

```bash
cp .env.example .env
```

```
VITE_API_BASE_URL=http://localhost:8000
VITE_AF3_SERVER_URL=http://localhost:8000
```

Backend proxy env (`server/.env`):

```bash
cp server/.env.example server/.env
```

> **[Important]** Set `AF3_ENGINE_URL` to match the port of the local AlphaFold3 Docker container / API pipeline running on the Ubuntu desktop (e.g. `8080` or `5000`).

```
PORT=8000
# Change to the actual local AF3 engine pipeline address
AF3_ENGINE_URL=http://localhost:8080
```

**3. Run and connect**

```bash
npm install && npm run install:server
npm run build          # Verify the frontend production bundle
npm run server         # Start real-time communication with the AF3 engine
```

---

## 🔬 Screen Workflow Summary

1. **Dashboard (`/`)** — Platform description, meta summary of the five inhibitors, recent analyses (`EmptyState` by default).
2. **Sequence Input (`/sequence`)** — Wuhan-Hu-1 wild-type selection, mutation notation (e.g. `L50F/E166A`) / FASTA input tabs, then `createAnalysisJob` after validation.
3. **Mutation Analysis (`/mutation?jobId=...`)** — Substitution-residue table vs. reference sequence, with active-site residues (H41 / C145) highlighted.
4. **Binding Prediction (`/prediction?jobId=...`)** — Five-inhibitor checkbox selection, fixed Mpro dimer mode, seed configuration, and real-time polling (`getPredictionStatus`) animation.
5. **Inhibitor Comparison (`/comparison?jobId=...`)** — Charts/tables comparing geometric parameters such as Cys145 proximity, H-bonds, and RMSD (no arbitrary IC50).
6. **3D Structure Viewer (`/viewer?jobId=...`)** — Top toolbar with six visualization toggles (Protein, Ligand, Active Site, ...), right-side residue panel, bottom tabs to switch among five ligands (Mol* mount area).
7. **Research Report (`/report?jobId=...`)** — Three export buttons (PDF/CSV/ChimeraX, marked as pending) and a Research-Use-Only warning banner.

---

## 📜 License

The license for this repository is **to be finalized jointly** by the contributors listed above. Until a license file is added, all rights are reserved by the contributors, and the platform is provided strictly for **in-silico academic research (Research Use Only)** — not for clinical diagnosis or treatment decisions.

> If this project derives from or interfaces with AlphaFold3, any use is additionally subject to the applicable AlphaFold3 model/code terms.

---
---

# 🧬 SARS-CoV-2 Mpro-Variant Binder Research Platform (한국어)

> 본 플랫폼은 **국경희(Kyunghee Kook)가 기획·설계하고 데이터 전처리·분석을 수행한** SARS-CoV-2 Mpro 변이체 억제제 연구 프로젝트를 구현한 것입니다. 웹 애플리케이션 뼈대는 이 연구 기반 위에 구축되었습니다.

**로컬 Ubuntu AlphaFold3 기반 SARS-CoV-2 메인 프로테아제(Mpro, 3CLpro) 변이체 구조 분석 및 5개 핵심 억제제 복합체 모델링 웹 애플리케이션 프론트엔드/백엔드 뼈대**

### 기여 (Credits)

| 역할 | 기여자 |
| --- | --- |
| 기획, 실험 설계, 데이터 전처리 및 분석 (Concept, experimental design, data preprocessing & analysis) | **국경희 (Kyunghee Kook)** |
| 플랫폼 구현 및 서버 구축 (Platform implementation & server infrastructure) | **조영재 (Youngjae Cho)** |

---

## 🌟 프로젝트 개요 및 핵심 원칙

본 프로젝트는 최신 React 19 + TypeScript + Vite + Tailwind CSS v4 기반의 프리미엄 Dark Navy UI 프론트엔드와 Node.js/Express 기반의 로컬 AlphaFold3 API 중개 Proxy 서버로 구성된 연구용 풀스택 웹 애플리케이션입니다.

> **엄격한 설계 및 데이터 무결성 원칙 준수**
>
> 1. **임의 약효 수치 및 더미 데이터 생성 절대 금지**: 생체 외/임상 효능을 나타내는 임의의 IC50, Ki 수치나 임의의 결합 친화도 점수, 임의의 거리값 등을 절대 자동 생성하거나 주입하지 않습니다. 실제 AlphaFold3 연산 결과가 없을 경우 빈 상태(`EmptyState`), 로딩 상태(`LoadingState`), 또는 에러 상태(`ErrorState`)만을 명확하게 표기합니다.
> 2. **Mpro Homodimer Mode 고정**: SARS-CoV-2 Mpro는 2량체(Homodimer) 상태에서 촉매 활성을 나타내므로, 본 플랫폼의 모든 AlphaFold3 모델링 요청은 `dimerMode: true`로 고정 실행됩니다.
> 3. **논문 흐름에 맞춘 5개 핵심 억제제 구성**: Nirmatrelvir, Ensitrelvir, Leritrelvir, GC376, Compound 4 등 Mpro 활성 포켓을 타겟하는 표준 리간드로만 구성됩니다.
> 4. **Research Use Only 강조**: 본 플랫폼은 인실리코(In-silico) 기초 구조 연구 및 후보물질 탐색 전용 도구이며, 임상 진단이나 치료 의사결정에 절대 사용할 수 없습니다.

---

## 📂 시스템 아키텍처 및 디렉토리 구조

```
c:\dev\healthcare\af3\
├── server/                     # 백엔드 Proxy 서버 (Node.js/Express, Port 8000)
│   ├── index.js                # AF3 엔진 중계 라우터 및 로컬 시뮬레이션 루틴
│   ├── package.json            # Proxy 서버 의존성
│   └── .env.example            # Proxy 서버 환경변수 템플릿
├── src/                        # 프론트엔드 소스 코드 (React + Vite + TS)
│   ├── api/                    # Axios 커스텀 클라이언트 및 6개 REST API 통신 레이어
│   │   ├── client.ts
│   │   └── analysisApi.ts
│   ├── services/               # 로컬 Ubuntu AF3 연결을 위한 7개 핵심 인터페이스
│   │   └── af3Service.ts       # prepareInputSequence, submitAf3Job, checkUbuntuServerHealth 등
│   ├── components/             # 모듈화된 UI 컴포넌트
│   │   ├── common/             # ResearchBadge, EmptyState, LoadingState, ErrorState, StatusPill
│   │   ├── layout/             # Topbar, Sidebar, AppLayout (Dark Navy Glassmorphism)
│   │   ├── inhibitor/          # InhibitorCard (더미 메트릭 배제)
│   │   └── structure/          # StructureViewerPlaceholder, ResiduePanel (H41, C145 매핑)
│   ├── pages/                  # 7개 주요 워크플로우 페이지
│   │   ├── DashboardPage.tsx
│   │   ├── SequenceInputPage.tsx
│   │   ├── MutationAnalysisPage.tsx
│   │   ├── BindingPredictionPage.tsx
│   │   ├── InhibitorComparisonPage.tsx
│   │   ├── StructureViewerPage.tsx
│   │   └── ResearchReportPage.tsx
│   ├── types/                  # AnalysisStatus, MutationInput, Inhibitor 등 8대 핵심 타입
│   └── utils/                  # Wuhan-Hu-1 Reference 정보, 9개 핵심 잔기 상수 및 서열 검증 유틸
├── .env.example                # 프론트엔드 환경변수 템플릿
├── package.json                # 통합 빌드 및 서버 실행 스크립트
└── vite.config.ts              # Vite 및 Tailwind v4 플러그인 설정
```

---

## 💻 현재 환경(Windows 노트북)에서 테스트 및 실행 가이드

현재 노트북에서는 실제 Linux AlphaFold3 엔진이 구동되지 않으므로, Proxy 서버(`server/index.js`)가 실제 엔진 연결 실패를 감지하면 가공된 더미 약효 수치를 만들지 않고 오직 **기하학적 치환 및 상태 폴링 워크플로우를 시뮬레이션**하도록 구성되어 있습니다.

**1단계. 전체 의존성 설치**

```bash
# 1. 루트 프론트엔드 패키지 설치
npm install

# 2. 백엔드 Proxy 서버 패키지 설치
npm run install:server
```

**2단계. 백엔드 Proxy 서버 실행 (Port 8000)**

```bash
npm run server
```

정상 실행 메시지 예시:

```
========================================================
🚀 [AF3 Proxy Server] Running on http://localhost:8000
🔗 [Target Ubuntu Engine] Configured to: http://localhost:8080
🛡️  [Mode] Research Use Only (No Dummy Biological Metrics)
========================================================
```

**3단계. 프론트엔드 개발 서버 실행 (Port 5173)**

```bash
npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속하면 Dark Navy 테마의 웹 애플리케이션을 즉시 테스트할 수 있습니다.

---

## 🐧 깃(Git)으로 Ubuntu 데스크탑 이전 및 연동 가이드

현재 노트북에서 작성된 소스 코드는 OS 독립적이며 환경변수로 통신 주소가 분리되어 있으므로, 깃(Git)으로 Push 후 실제 AlphaFold3가 구동되는 Ubuntu 데스크탑에서 Pull 받아 즉시 사용할 수 있습니다.

**1. Git Push (노트북에서 수행)**

```bash
git add .
git commit -m "feat: complete Mpro-Variant Binder frontend and proxy scaffolding"
git push origin main
```

**2. Git Pull 및 환경변수 설정 (Ubuntu 데스크탑에서 수행)**

프론트엔드 환경변수(`.env`):

```bash
cp .env.example .env
```

```
VITE_API_BASE_URL=http://localhost:8000
VITE_AF3_SERVER_URL=http://localhost:8000
```

백엔드 Proxy 서버 환경변수(`server/.env`):

```bash
cp server/.env.example server/.env
```

> **[중요]** 실제 Ubuntu 데스크탑 내에서 돌고 있는 AlphaFold3 도커 컨테이너 또는 API 파이프라인 엔진의 포트(예: `8080` 또는 `5000`)에 맞추어 `AF3_ENGINE_URL`을 수정합니다.

```
PORT=8000
# 실제 Ubuntu 로컬 AF3 엔진 파이프라인 주소로 변경
AF3_ENGINE_URL=http://localhost:8080
```

**3. 서버 구동 및 서비스 연동**

```bash
npm install && npm run install:server
npm run build          # 프론트엔드 프로덕션 번들 빌드 (검증)
npm run server         # Proxy 서버 실행 (실제 AF3 엔진과 실시간 통신 시작)
```

---

## 🔬 주요 화면 워크플로우 요약

1. **대시보드 (`/`)**: 플랫폼 설명, 5개 억제제 메타 요약, 최근 분석 내역 (`EmptyState` 기반 기본 빈 상태)
2. **시퀀스 입력 (`/sequence`)**: Wuhan-Hu-1 Wild-Type 선택, 변이 표기(`L50F/E166A` 등) / FASTA 서열 입력 탭, 서열 유효성 검사 후 `createAnalysisJob` 호출
3. **변이 분석 (`/mutation?jobId=...`)**: 기준 서열 대비 치환 잔기 테이블 출력, H41/C145 등 활성 부위 잔기 하이라이트
4. **결합 예측 설정 (`/prediction?jobId=...`)**: 5개 억제제 체크박스 선택, Mpro Dimer Mode 고정 확인, 시드 설정 및 실시간 폴링(`getPredictionStatus`) 애니메이션 뷰
5. **억제제 비교 (`/comparison?jobId=...`)**: Cys145 근접도, H-bond, RMSD 등 기하학적 매개변수 차트 및 테이블 비교 (임의 IC50 없음)
6. **3D 구조 뷰어 (`/viewer?jobId=...`)**: 상단 6대 시각화 토글 툴바(Protein, Ligand, Active Site 등), 우측 잔기 패널, 하단 5대 리간드 전환 탭 (Mol* 마운트 대기 영역)
7. **연구 보고서 (`/report?jobId=...`)**: 3대 내보내기 버튼(PDF/CSV/ChimeraX, 준비중 표시) 및 하단 Research Use Only 경고문 알림창

---

## 📜 라이선스

본 저장소의 라이선스는 위에 명시된 기여자들이 **함께 확정**할 예정입니다. 라이선스 파일이 추가되기 전까지 모든 권리는 기여자에게 있으며, 본 플랫폼은 오직 **인실리코 학술 연구용(Research Use Only)**으로만 제공됩니다 — 임상 진단이나 치료 의사결정에는 사용할 수 없습니다.

> 본 프로젝트가 AlphaFold3에서 파생되었거나 이를 연동하는 경우, 사용은 해당 AlphaFold3 모델/코드 이용 약관을 추가로 따릅니다.
