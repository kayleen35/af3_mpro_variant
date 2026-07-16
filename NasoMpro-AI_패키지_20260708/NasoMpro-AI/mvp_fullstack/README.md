# AI 기반 신약개발 의사결정 지원 플랫폼 MVP

이 저장소는 연구지원/데이터분석 목적의 MVP 예시입니다. 실제 임상 판단, 투여 지침, 합성 프로토콜, 제조 방법, 감염성 물질 취급 절차를 제공하지 않습니다.

## 구성

- Frontend: Next.js App Router + TypeScript + Tailwind CSS
- Backend: FastAPI + SQLAlchemy Async + Pydantic
- Database: PostgreSQL
- ML/Scoring: 휴리스틱 점수화 + 교차검증 리포트 MVP
- Target use case: SARS-CoV-2 Mpro–ligand/inhibitor complex 관련 데이터 입력, 후보물질 연구 우선순위 점수화, 검증 리포트, 대시보드, 관리자 화면

## 빠른 실행

```bash
cp .env.example .env
docker compose up --build
```

실행 후 접속:

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- Swagger UI: http://localhost:8000/docs

## 로컬 개발

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="postgresql+asyncpg://app:app@localhost:5432/ai_drugdiscovery"
uvicorn app.main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## 주요 기능

1. SARS-CoV-2 Mpro 타깃 및 ligand/inhibitor complex 데이터 관리
2. 후보물질 입력 및 연구 우선순위 점수화
3. 교차검증 리포트 생성
4. 예측/점수화 결과 대시보드
5. 관리자 감사 로그 조회

## 안전/범위 제한

- 연구지원용 의사결정 보조 플랫폼입니다.
- 실제 약효, 안전성, 임상 성공 가능성을 보장하지 않습니다.
- 실험 절차, 합성 경로, 투여 방법, 치료 지침은 의도적으로 제외했습니다.
- 점수화 로직은 MVP용 예시이며, 검증된 실험/임상 데이터와 도메인 전문가 검토가 필요합니다.

## 다음 단계 권장

- 인증/권한: OAuth 또는 조직 SSO
- 데이터 계보: 원천 파일, DOI, PDB/ChEMBL/BindingDB 등 출처 관리
- 모델 관리: MLflow, model registry, feature store
- 검증 강화: 외부 검증 세트, calibration, uncertainty estimation
- 보안: 감사 로그, PII/PHI 미수집 원칙, RBAC, SAST/DAST
