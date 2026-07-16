# Codex 개발 프롬프트

아래 프롬프트를 Codex에 그대로 넣어 개발을 시작하세요.

---

AI 기반 신약개발 의사결정 지원 플랫폼 MVP를 개발해줘.

## 핵심 요구사항

프론트엔드는 Next.js App Router + TypeScript + Tailwind CSS, 백엔드는 FastAPI + SQLAlchemy Async + Pydantic, DB는 PostgreSQL로 구성한다. SARS-CoV-2 Mpro–ligand/inhibitor complex 관련 데이터 입력, 후보물질 점수화, 교차검증 리포트, 예측 결과 대시보드, 관리자 화면을 포함한다.

이 플랫폼은 연구지원/데이터분석용 의사결정 보조 시스템이다. 실제 임상, 투여, 치료 지침, 합성 방법, 제조 절차, wet-lab 프로토콜, 감염성 물질 취급 절차는 구현하거나 설명하지 않는다. 후보물질 점수는 연구 우선순위 지표로만 표시하고, 실제 치료 가능성 또는 안전성 보장처럼 표현하지 않는다.

## 구현 범위

1. Monorepo 구조로 `/frontend`, `/backend`, `/db`, `/docs`를 만든다.
2. Docker Compose로 PostgreSQL, FastAPI, Next.js를 한 번에 실행할 수 있게 한다.
3. Backend API:
   - `GET /api/health`
   - `GET/POST /api/targets`
   - `GET/POST /api/complexes`
   - `GET/POST /api/candidates`
   - `POST /api/candidates/{candidate_id}/score`
   - `POST /api/scoring-runs`
   - `GET /api/scoring-results`
   - `POST /api/validation/cross-validate`
   - `GET /api/validation/reports`
   - `GET /api/dashboard`
   - `GET /api/admin/audit-logs`
4. Backend DB 모델:
   - ProteinTarget
   - LigandComplexRecord
   - CandidateMolecule
   - ScoringRun
   - ScoringResult
   - ValidationReport
   - AuditLog
5. 후보물질 점수화:
   - docking score, binding affinity, molecular weight, logP, ADMET risk, novelty, data quality를 입력값으로 사용한다.
   - `research_priority_score`, `target_fit_score`, `drug_likeness_score`, `data_confidence_score`, `risk_penalty`, `rationale`을 반환한다.
   - 모든 라벨은 “연구 우선순위” 또는 “분석 지표”로 표현한다.
6. 교차검증 리포트:
   - 기록된 complex 데이터를 기반으로 K-fold cross validation MVP를 구현한다.
   - MAE, RMSE, R², dataset size, folds, summary를 저장하고 화면에 표시한다.
7. Frontend 화면:
   - Dashboard: 요약 통계, 최근 점수화 결과, 최근 검증 리포트
   - Candidates: 후보물질 등록, 목록, 점수화 실행
   - Complexes: Mpro–ligand complex 데이터 등록/목록
   - Validation: 교차검증 실행/리포트 목록
   - Admin: 감사 로그 목록
8. 코드 품질:
   - TypeScript 타입 정의
   - Pydantic schema 분리
   - API client 분리
   - README에 실행 방법 작성
   - `.env.example` 포함
   - 기본 테스트 1~2개 포함

## 완료 기준

- `docker compose up --build`로 실행 가능해야 한다.
- `http://localhost:3000`에서 화면 확인 가능해야 한다.
- `http://localhost:8000/docs`에서 API 문서 확인 가능해야 한다.
- demo seed data가 자동 생성되어 대시보드가 비어 있지 않아야 한다.
- 모든 기능은 실제 치료/투여/합성 지침 없이 연구지원용으로 동작해야 한다.

## 우선순위

1. 실행 가능한 MVP scaffold
2. API와 DB 정상 동작
3. 화면에서 등록/조회/점수화/검증 실행 가능
4. 안전한 문구와 범위 제한 유지
5. 향후 고도화 TODO 정리

---
