# Database

PostgreSQL schema는 FastAPI 시작 시 SQLAlchemy `Base.metadata.create_all()`로 생성됩니다.

운영 환경에서는 Alembic migration을 추가하는 것을 권장합니다.

권장 고도화:

- Alembic revision 관리
- seed data와 운영 data 분리
- audit log retention 정책
- data provenance 테이블 추가
- external dataset ingestion pipeline 분리
