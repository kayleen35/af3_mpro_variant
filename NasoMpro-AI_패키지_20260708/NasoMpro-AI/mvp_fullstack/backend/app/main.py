from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import get_settings
from app.db.base import Base
from app.db.session import AsyncSessionLocal, engine
from app.models import entities  # noqa: F401 - ensure model metadata is registered
from app.seed import seed_demo_data

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    if settings.seed_demo_data:
        async with AsyncSessionLocal() as session:
            await seed_demo_data(session)
    yield


app = FastAPI(
    title=settings.app_name,
    description=(
        "Research decision-support API for AI-assisted drug discovery planning. "
        "No clinical, dosing, synthesis, or therapeutic guidance is provided."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix=settings.api_prefix)
