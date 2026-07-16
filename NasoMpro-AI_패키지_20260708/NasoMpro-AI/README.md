# NasoMpro-AI — SARS-CoV-2 Mpro 비강 항바이러스 후보 발굴 + 자율 에이전트 플랫폼

> 제4회 JUMP AI 신약개발 경진대회 · 아시아경제교육센터 알파폴드팀 · 멘토 홍성현((주)클리켐바이오)
> **비임상 연구지원 지표**입니다. 임상·투여·합성·치료 판단을 제공하지 않습니다.

6,368종 실측 pIC50으로 학습한 **QSAR 활성 예측(scaffold-CV ρ=0.81)**, **자율 에이전트 리드 최적화**,
비강 전달성 평가를 하나의 과학엔진으로 제공하고, 이를 **두 가지 방식**으로 전달합니다.

---

## 하나의 과학엔진, 두 가지 전달 방식 (역할 분담)

| 방식 | 위치 | 역할 | 언제 쓰나 |
|---|---|---|---|
| **① 배포형 PWA** | `web/` → 엣지 배포 | 오프라인·PC꺼져도 동작, QR 1장 시연 | **대회 데모·현장·발표** |
| **② 제품형 풀스택** | `mvp_fullstack/` | DB·다중사용자·감사로그·CRUD·API | **사내 운영·협업·확장** |
| **③ 로컬 분석 도구** | `app/` (Streamlit) | 실제 RandomForest·구조SVG, 더블클릭 | **개인 심층 분석** |

세 방식 모두 **동일한 학습·검증 산출물**(`ml/qsar_model.json` · `ml/agent_library.json` · `ml/qsar_metrics.json`)을
공유하므로 결과가 일관됩니다. → 자세한 통합 내역은 [`mvp_fullstack/MERGE_NOTES.md`](mvp_fullstack/MERGE_NOTES.md).

> **물리적 단일 배포:** 배포형 PWA는 풀스택 프론트에도 co-host되어 있습니다
> (`mvp_fullstack/frontend/public/pwa/`). 풀스택을 띄우면 제품 UI와 함께
> **`http://localhost:3000/pwa/index.html`** 에서 오프라인 PWA가 같은 서버로 제공되고,
> 상단 네비의 **"오프라인 PWA ↗"** 버튼으로 바로 열립니다. → 하나의 배포로 둘 다 서비스.

**라이브 데모(항상 접속 가능):** https://mpro.wnffn62.workers.dev  · QR: `QR_NasalMpro.png`

---

## 빠른 시작

가장 쉬운 방법: **`_시작하기.bat` 더블클릭** → 메뉴에서 선택.

수동 실행:

```powershell
# ① 배포형 PWA (이미 라이브) — 그냥 접속
start https://mpro.wnffn62.workers.dev
#   재배포:  app\.venv\Scripts\python.exe deploy_mpro.py

# ② 제품형 풀스택 — 로컬 무설치(SQLite)
cd mvp_fullstack\backend
..\..\app\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
#   → http://localhost:8000/docs   (프론트까지: mvp_fullstack 에서 docker compose up)

# ③ 로컬 Streamlit
cd app && 실행.bat
```

---

## 디렉터리 맵

```
클리켐바이오_신약개발플랫폼/
├─ README.md                 ← (이 파일) 통합 진입점
├─ _시작하기.bat             ← 비개발자용 실행 메뉴
├─ web/                      ① 배포형 PWA (index.html · albumin.html · qsar_model.json …)
├─ mvp_fullstack/            ② 풀스택 (FastAPI backend + Next.js frontend + Docker)
│  └─ MERGE_NOTES.md         · ChatGPT 설계안 × 과학엔진 통합 내역
├─ app/                      ③ 로컬 Streamlit + 실제 RDKit/RandomForest
├─ ml/                       ★ 공유 과학엔진 학습 (train_qsar.py → 모델·지표)
├─ data/                     실측 데이터셋 (6,368종) + OOF 예측
├─ deploy_mpro.py            web/ 전체를 Cloudflare 엣지로 배포
├─ index.html · albumin.html 루트 원본(=web/ 배포본의 소스)
└─ 제출패키지/               기술보고서(docx/pdf) · 기술브리핑(pptx) · 화면 캡처
```

## 핵심 산출물 (문서)

- **기술 보고서** — `제출패키지/NasalMpro_ALBOMB_기술보고서.docx` (+PDF): 방법론·검증·에이전트·한계·재현
- **기술 브리핑(PPT)** — `제출패키지/NasoMpro-AI_기술브리핑.pptx`: 사용설명서·기능정의서·검증·근거·정합성
- **통합 노트** — `mvp_fullstack/MERGE_NOTES.md`: 두 설계의 대조·이식·로드맵

## 재현·검증

```powershell
# 모델 재학습 → ml/qsar_metrics.json · web/qsar_model.json · data/mpro_predictions.json
app\.venv\Scripts\python.exe ml\train_qsar.py
# 풀스택 백엔드 테스트
cd mvp_fullstack\backend && ..\..\app\.venv\Scripts\python.exe -m pytest -q
```

검증 결과(scaffold-CV): RandomForest ρ=0.81 · Ridge ρ=0.76 · 유사도 베이스라인 ρ=0.34.

---
_모든 수치는 공개 실측 데이터로 학습·검증한 비임상 연구지원 지표이며, 실험·독성·임상 데이터 또는 허가 판단을 대체하지 않습니다._
