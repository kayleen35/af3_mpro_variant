# 전체 기능명세서

## 1. 목적

본 MVP는 SARS-CoV-2 Mpro–ligand/inhibitor complex 관련 연구 데이터를 입력하고, 후보물질의 연구 우선순위를 점수화하며, 내부 데이터 기반 교차검증 리포트를 제공하는 AI 기반 신약개발 의사결정 지원 플랫폼이다.

## 2. 사용자 유형

### 연구기획/사업기획 사용자
- 파이프라인 후보군의 우선순위와 리스크를 빠르게 확인한다.
- 투자/개발 의사결정용 요약 지표를 확인한다.

### 데이터 사이언티스트/연구원
- complex record와 후보물질 데이터를 등록한다.
- 점수화 로직과 교차검증 결과를 확인한다.

### 관리자
- 등록/점수화/검증 실행 로그를 확인한다.
- 데이터 품질 및 운영 상태를 점검한다.

## 3. 범위

### 포함
- Mpro 타깃 데이터 관리
- ligand/inhibitor complex record 관리
- 후보물질 등록
- 후보물질 연구 우선순위 점수화
- 교차검증 리포트 생성
- 대시보드
- 관리자 감사 로그

### 제외
- 실제 임상 판단
- 투여량, 투여 방법, 치료법 추천
- 화합물 합성 방법 또는 제조 절차
- wet-lab 프로토콜
- 감염성 물질 취급 절차
- 실제 약효/안전성 보장

## 4. 시스템 아키텍처

```text
[Browser]
   |
   v
[Next.js Frontend]
   |
   | REST API
   v
[FastAPI Backend]
   |
   v
[PostgreSQL]
```

## 5. 데이터 모델

### ProteinTarget
- id
- name
- organism
- pdb_reference
- description
- created_at

### LigandComplexRecord
- id
- target_id
- ligand_name
- ligand_smiles
- pdb_id
- docking_score
- binding_affinity_nm
- molecular_weight
- logp
- hbond_donors
- hbond_acceptors
- tpsa
- data_source
- assay_type
- observed_activity_label
- notes
- created_at

### CandidateMolecule
- id
- name
- smiles
- target_id
- molecular_weight
- logp
- docking_score
- binding_affinity_nm
- admet_risk_score
- novelty_score
- data_quality_score
- status
- notes
- created_at

### ScoringRun
- id
- name
- description
- created_at

### ScoringResult
- id
- run_id
- candidate_id
- research_priority_score
- target_fit_score
- drug_likeness_score
- data_confidence_score
- risk_penalty
- rationale
- created_at

### ValidationReport
- id
- model_name
- dataset_size
- folds
- mae
- rmse
- r2
- summary
- created_at

### AuditLog
- id
- actor
- action
- entity_type
- entity_id
- detail
- created_at

## 6. API 명세

### Health
- `GET /api/health`
- 서비스 상태 확인

### Targets
- `GET /api/targets`
- `POST /api/targets`

### Complexes
- `GET /api/complexes`
- `POST /api/complexes`

### Candidates
- `GET /api/candidates`
- `POST /api/candidates`
- `POST /api/candidates/{candidate_id}/score`

### Scoring
- `POST /api/scoring-runs`
- `GET /api/scoring-results`

### Validation
- `POST /api/validation/cross-validate?target_id=1&folds=5`
- `GET /api/validation/reports`

### Dashboard
- `GET /api/dashboard`

### Admin
- `GET /api/admin/audit-logs`

## 7. 점수화 로직 MVP

최종 점수는 `research_priority_score`이며 0~100 범위로 계산한다.

입력 지표:
- docking score: 낮을수록 유리한 것으로 정규화
- binding affinity nM: 낮을수록 유리한 것으로 로그 정규화
- molecular weight: 150~500 범위를 우호적으로 평가
- logP: -1~5 범위를 우호적으로 평가
- ADMET risk score: 0~1 범위, 높을수록 페널티
- novelty score: 0~1 범위
- data quality score: 0~1 범위

결과 지표:
- research_priority_score
- target_fit_score
- drug_likeness_score
- data_confidence_score
- risk_penalty
- rationale

주의: 이 점수는 연구 우선순위 산정용 예시이며 실제 치료 가능성, 임상 성공률, 안전성 판단이 아니다.

## 8. 교차검증 MVP

- LigandComplexRecord 데이터를 사용한다.
- feature: molecular_weight, logp, docking_score, binding_affinity_nm, hbond_donors, hbond_acceptors, tpsa
- label: observed_activity_label을 active/moderate/inactive로 단순 수치화한다.
- K-fold cross validation으로 MAE, RMSE, R²를 계산한다.
- 데이터가 부족할 경우 “insufficient data” 리포트를 생성한다.

## 9. 화면 명세

### Dashboard
- 전체 후보물질 수
- complex record 수
- 평균 연구 우선순위 점수
- 최근 scoring result
- 최근 validation report

### Candidates
- 후보물질 등록 폼
- 후보물질 목록
- 점수화 실행 버튼
- 최근 점수 표시

### Complexes
- complex record 등록 폼
- 입력 데이터 목록

### Validation
- 교차검증 실행 버튼
- 검증 리포트 목록

### Admin
- 감사 로그 목록

## 10. 비기능 요구사항

- API 응답은 JSON
- DB URL은 환경변수로 관리
- CORS 허용 origin은 환경변수로 관리
- demo seed data 자동 생성 옵션 제공
- 연구지원용 범위 제한 문구 표시
- Docker Compose 실행 지원

## 11. 고도화 제안

- 사용자 인증/권한: RBAC, SSO
- 데이터 출처 관리: DOI, PDB, ChEMBL, BindingDB 연결
- 파일 업로드: CSV/SDF/SMILES 파일 파싱
- 모델 관리: MLflow, model registry
- MLOps: feature store, batch inference, monitoring
- 시각화: molecular viewer, 3D structure viewer
- 보안: 감사 로그 강화, API rate limit, secret manager
