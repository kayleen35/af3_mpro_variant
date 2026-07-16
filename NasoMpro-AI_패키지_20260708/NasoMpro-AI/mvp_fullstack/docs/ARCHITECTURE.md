# Architecture

```text
Browser
  -> Next.js App Router frontend
  -> FastAPI REST API
  -> PostgreSQL
```

Backend creates tables at startup for MVP convenience. Production should replace this with Alembic migrations.

Key modules:

- `app/api/routes.py`: REST endpoints
- `app/models/entities.py`: SQLAlchemy models
- `app/schemas/entities.py`: Pydantic schemas
- `app/services/scoring.py`: research-priority scoring
- `app/services/validation.py`: K-fold validation report
- `app/seed.py`: demo data
