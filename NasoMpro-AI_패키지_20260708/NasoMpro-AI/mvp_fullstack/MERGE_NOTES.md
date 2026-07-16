# 통합 노트 — ChatGPT 설계안 × 실제 과학 엔진 이식

작성 2026-07-08. ChatGPT가 설계·스캐폴딩한 풀스택 MVP(`ai_drug_discovery_mvp`)에,
별도로 구축·검증한 실제 과학 엔진(RDKit + QSAR + 자율 에이전트 + 6,368종 실측 데이터)을 이식한 기록.

## 1. 왜 통합인가 — 두 결과물의 진단

| 항목 | ChatGPT MVP(원본 스캐폴드) | 이식한 과학 엔진 |
|---|---|---|
| 아키텍처 | FastAPI+SQLAlchemy+Postgres+Next.js+Docker, CRUD·감사로그·대시보드 (**우수**) | 없음(정적 PWA/로컬 Streamlit) |
| 활성 예측 | SMILES에서 계산 안 함 — docking/affinity/ADMET **수동 입력** 요구, RDKit 없음 (**공백**) | SMILES→RDKit 물성 + **QSAR pIC50**(6,368종 학습) |
| 검증 | 시드 10건 랜덤 K-fold(active/moderate/inactive) 장난감 (**공백**) | **scaffold-CV RF ρ=0.81 / Ridge ρ=0.76** vs 유사도 0.34 |
| 에이전틱 AI(대회 핵심) | **아예 없음** | 4에이전트 리드 최적화 루프 |

ChatGPT **기획설계서 §10**이 명시한 MVP 활성 예측기 = "Morgan fingerprint + GBM pIC50 회귀",
**§6** 에이전트 레이어, **§7** 다성분 Total Candidate Score, **§8** scaffold split 검증 —
그런데 실제 배포된 스캐폴드는 이 과학을 전부 **빈 껍데기(placeholder)**로 남겼다.
→ 이식은 **ChatGPT 자신의 기획서를 실제로 완성**하는 작업이다.

## 2. 이식·변경 내역 (backend only, 프론트 무변경)

- **신규** `app/ml/predictor.py` — RDKit descriptor + Ridge QSAR pIC50 예측(포터블 `qsar_model.json` 33KB, sklearn 불필요) + 비강전달성 + 강활성 유사도 + 구조알림. `app/ml/`에 `qsar_model.json`·`agent_library.json`·`qsar_metrics.json` 동봉.
- **재작성** `app/services/scoring.py` — SMILES가 있으면 **기획서 §7 다성분 점수**(0.30·Mpro결합 + 0.15·핵심상호작용 + 0.15·ADMET + 0.15·비강 + 0.10·화학안정성 + 0.10·일치도 + 0.05·합성/신규성)를 구조에서 계산. 없으면 기존 휴리스틱 폴백. `predicted_pic50`·`nasal_delivery_score`·`mpro_binding_score` 추가.
- **신규** `app/services/agent.py` — 자율 에이전트(가설→QSAR평가→도구기반 아날로그 hill-climb→규제/제형). `POST /api/agent/optimize`.
- **보강** `app/services/validation.py` — `qsar_scaffold_cv_report()`: 6,368종 실측 scaffold-CV 정직 지표. 기존 complex 기반 K-fold는 유지.
- **모델/스키마** `ScoringResult`에 3개 컬럼 추가, `ScoringResultRead`/`AgentOptimizeRequest`/`QsarSummary` 스키마 추가.
- **라우트** `POST /agent/optimize`, `GET /validation/qsar-summary`, `POST /validation/qsar-report` 추가. 점수 저장 시 신규 필드 반영.
- **시드** 가짜 후보 10건 → **실제 Mpro 저해제 3종(Nirmatrelvir·Ensitrelvir·GC376)** + 실측 scaffold-CV 검증리포트 시딩.
- **무설치 실행** `config.py` 기본 DB를 SQLite(aiosqlite)로 — Docker/Postgres 없이도 `uvicorn`으로 로컬 구동. 운영/Docker는 `DATABASE_URL`로 Postgres 주입(원본대로).
- **requirements** rdkit·aiosqlite·pytest-asyncio 추가.

## 3. 검증 (실행함, 위조 아님)

- `pytest` **4/4 통과**(구조기반 스코어·에이전트·QSAR검증 포함).
- 라이브 API 스모크(uvicorn+SQLite):
  - `POST /candidates/1/score`(Nirmatrelvir) → **예측 pIC50 7.02**, Mpro결합 43, 비강 72, 우선순위 70.6.
  - `GET /validation/qsar-summary` → n=6368, RF ρ=0.81 / Ridge ρ=0.76 / 유사도 0.34.
  - `POST /agent/optimize`(GC376) → **6.94 → 7.94**, 2라운드, 4에이전트.
  - `GET /dashboard` → 후보 3 + 실측 검증리포트 1.

## 4. 실행 방법

무설치 로컬(권장, 빠름):
```
cd mvp_fullstack/backend
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt   # (또는 기존 rdkit 포함 venv 재사용)
uvicorn app.main:app --reload --port 8000        # SQLite 자동 생성·시딩
# http://localhost:8000/docs
```
풀스택(Docker, 원본):
```
cd mvp_fullstack && cp .env.example .env && docker compose up --build
# frontend 3000 / backend 8000 / postgres
```

## 5. 남은 로드맵(기획서 §10 고도화 tier — 아직 미구현)

- 실제 3D 도킹(AutoDock Vina/GNINA)·pose·상호작용맵(핵심상호작용 점수의 대리지표를 실측으로 대체)
- 단백질-리간드 GNN, ensemble uncertainty, applicability domain
- ADMET 전용 예측기(CYP/hERG/Ames), 생성모델 기반 de novo 최적화
- 프론트엔드에 예측 pIC50 컬럼·에이전트 페이지·3D viewer 노출(백엔드 API는 이미 제공)
- RBAC/SSO, ChEMBL/BindingDB 커넥터, CSV/SDF 업로드, MLflow

> 고지: 모든 점수·예측은 공개 실측 데이터로 학습·검증한 **비임상 연구지원 지표**이며, 임상·투여·합성·치료 판단을 대체하지 않는다.
