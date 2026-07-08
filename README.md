# 🧬 SARS-CoV-2 Mpro-Variant Binder Research Platform

**로컬 Ubuntu AlphaFold3 기반 SARS-CoV-2 메인 프로테아제(Mpro, 3CLpro) 변이체 구조 분석 및 5개 핵심 억제제 복합체 모델링 웹 애플리케이션 프론트엔드/백엔드 뼈대**

---

## 🌟 프로젝트 개요 및 핵심 원칙

본 프로젝트는 최신 React 19 + TypeScript + Vite + Tailwind CSS v4 기반의 프리미엄 Dark Navy UI 프론트엔드와 Node.js/Express 기반의 로컬 AlphaFold3 API 중개 Proxy 서버로 구성된 연구용 풀스택 웹 애플리케이션입니다.

> [!IMPORTANT]
> **엄격한 설계 및 데이터 무결성 원칙 준수**
> 1. **임의 약효 수치 및 더미 데이터 생성 절대 금지**: 생체 외/임상 효능을 나타내는 임의의 IC50, Ki 수치나 임의의 결합 친화도 점수, 임의의 거리값 등을 절대 자동 생성하거나 주입하지 않습니다. 실제 AlphaFold3 연산 결과가 없을 경우 빈 상태(`EmptyState`), 로딩 상태(`LoadingState`), 또는 에러 상태(`ErrorState`)만을 명확하게 표기합니다.
> 2. **Mpro Homodimer Mode 고정**: SARS-CoV-2 Mpro는 2량체(Homodimer) 상태에서 촉매 활성을 나타내므로, 본 플랫폼의 모든 AlphaFold3 모델링 요청은 `dimerMode: true`로 고정 실행됩니다.
> 3. **논문 흐름에 맞춘 5개 핵심 억제제 구성**: Nirmatrelvir, Ensitrelvir, Leritrelvir, GC376, Compound 4 등 Mpro 활성 포켓을 타겟하는 표준 리가нд로만 구성됩니다.
> 4. **Research Use Only 강조**: 본 플랫폼은 인실리코(In-silico) 기초 구조 연구 및 후보물질 탐색 전용 도구이며, 임상 진단이나 치료 의사결정에 절대 사용할 수 없습니다.

---

## 📂 시스템 아키텍처 및 디렉토리 구조

```text
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

### 1단계. 전체 의존성 설치
터미널에서 프론트엔드와 백엔드 Proxy 서버의 의존성을 모두 설치합니다:
```bash
# 1. 루트 프론트엔드 패키지 설치
npm install

# 2. 백엔드 Proxy 서버 패키지 설치
npm run install:server
```

### 2단계. 백엔드 Proxy 서버 실행 (Port 8000)
터미널 창을 하나 열고 아래 명령어로 Proxy 서버를 실행합니다:
```bash
npm run server
```
*정상 실행 메시지 예시:*
```text
========================================================
🚀 [AF3 Proxy Server] Running on http://localhost:8000
🔗 [Target Ubuntu Engine] Configured to: http://localhost:8080
🛡️  [Mode] Research Use Only (No Dummy Biological Metrics)
========================================================
```

### 3단계. 프론트엔드 개발 서버 실행 (Port 5173)
새로운 터미널 창을 열고 Vite 프론트엔드 서버를 실행합니다:
```bash
npm run dev
```
브라우저에서 `http://localhost:5173`으로 접속하면 Dark Navy 테마의 웹 애플리케이션을 즉시 테스트할 수 있습니다.

---

## 🐧 깃(Git)으로 Ubuntu 데스크탑 이전 및 연동 가이드

현재 ноутбу에서 작성된 소스 코드는 OS 독립적이며 환경변수로 통신 주소가 분리되어 있으므로, 깃(Git)으로 Push 후 실제 AlphaFold3가 구동되는 Ubuntu 데스크탑에서 Pull 받아 즉시 사용할 수 있습니다.

### 1. Git Push (노트북에서 수행)
```bash
git add .
git commit -m "feat: complete Mpro-Variant Binder frontend and proxy scaffolding"
git push origin main
```

### 2. Git Pull 및 환경변수 설정 (Ubuntu 데스크탑에서 수행)
Ubuntu 데스크탑에서 프로젝트를 Clone 또는 Pull 받은 후, `.env` 파일을 생성하여 실제 AF3 엔진 주소를 연결합니다.

#### ① 프론트엔드 환경변수 설정 (`.env`)
루트 디렉토리의 `.env.example`을 복사하여 `.env` 파일을 만듭니다:
```bash
cp .env.example .env
```
`.env` 파일 내용 확인:
```env
VITE_API_BASE_URL=http://localhost:8000
VITE_AF3_SERVER_URL=http://localhost:8000
```

#### ② 백엔드 Proxy 서버 환경변수 설정 (`server/.env`)
`server/` 디렉토리 내의 `.env.example`을 복사하여 `server/.env` 파일을 만듭니다:
```bash
cp server/.env.example server/.env
```
**[중요]** 실제 Ubuntu 데스크탑 내에서 돌고 있는 AlphaFold3 도커 컨테이너 또는 API 파이프라인 엔진의 포트(예: `8080` 또는 `5000`)에 맞추어 `AF3_ENGINE_URL`을 수정합니다:
```env
PORT=8000
# 실제 Ubuntu 로컬 AF3 엔진 파이프라인 주소로 변경
AF3_ENGINE_URL=http://localhost:8080
```

### 3. 서버 구동 및 서비스 연동
Ubuntu 데스크탑 터미널에서 서버와 프로덕션 빌드를 실행합니다:
```bash
# 의존성 설치
npm install && npm run install:server

# 프론트엔드 프로덕션 번들 빌드 (검증)
npm run build

# Proxy 서버 실행 (실제 AF3 엔진과 실시간 통신 시작)
npm run server
```

---

## 🔬 주요 화면 워크플로우 요약

1. **대시보드 (`/`)**: 플랫폼 설명, 5개 억제제 메타 요약, 최근 분석 내역 (`EmptyState` 기반 기본 빈 상태)
2. **시퀀스 입력 (`/sequence`)**: Wuhan-Hu-1 Wild-Type 선택, 변이 표기(`L50F/E166A` 등) / FASTA 서열 입력 탭, 서열 유효성 검사 후 `createAnalysisJob` 호출
3. **변이 분석 (`/mutation?jobId=...`)**: 기준 서열 대비 치환 잔기 테이블 출력, H41/C145 등 활성 부위 잔기 하이라이트
4. **결합 예측 설정 (`/prediction?jobId=...`)**: 5개 억제제 체크박스 선택, Mpro Dimer Mode 고정 확인, 시드 설정 및 실시간 폴링(`getPredictionStatus`) 애니메이션 뷰
5. **억제제 비교 (`/comparison?jobId=...`)**: Cys145 근접도, H-bond, RMSD 등 기하학적 매개변수 차트 및 테이블 비교 (임의 IC50 없음)
6. **3D 구조 뷰어 (`/viewer?jobId=...`)**: 상단 6대 시각화 토글 툴바(Protein, Ligand, Active Site 등), 우측 잔기 패널, 하단 5대 리가нд 전환 탭 (Mol* 마운트 대기 영역)
7. **연구 보고서 (`/report?jobId=...`)**: 3대 내보내기 버튼(PDF/CSV/ChimeraX, 준비중 표시) 및 하단 Research Use Only 경고문 알림창

---
*Developed by Antigravity under Strict Academic & Structural Integrity Best Practices.*
