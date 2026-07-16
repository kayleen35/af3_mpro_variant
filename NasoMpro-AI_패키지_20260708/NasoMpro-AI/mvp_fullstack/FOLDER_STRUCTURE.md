# 폴더구조

```text
ai_drug_discovery_mvp/
├── CODEX_PROMPT.md
├── SPEC.md
├── FOLDER_STRUCTURE.md
├── README.md
├── .env.example
├── .gitignore
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── seed.py
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   └── routes.py
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   └── config.py
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── base.py
│   │   │   └── session.py
│   │   ├── models/
│   │   │   ├── __init__.py
│   │   │   └── entities.py
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   └── entities.py
│   │   └── services/
│   │       ├── __init__.py
│   │       ├── scoring.py
│   │       └── validation.py
│   └── tests/
│       └── test_scoring.py
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── next.config.mjs
│   ├── postcss.config.mjs
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── app/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── admin/
│   │   │   └── page.tsx
│   │   ├── candidates/
│   │   │   └── page.tsx
│   │   ├── complexes/
│   │   │   └── page.tsx
│   │   └── validation/
│   │       └── page.tsx
│   ├── components/
│   │   ├── ScoreBadge.tsx
│   │   ├── Shell.tsx
│   │   └── StatCard.tsx
│   └── lib/
│       └── api.ts
├── docs/
│   ├── ARCHITECTURE.md
│   ├── SAFETY_SCOPE.md
│   └── SCORING.md
└── db/
    └── README.md
```
