from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db, migrate_unescape_titles
from app.routers import games, categories, tags, enrichment, qbittorrent, download_clients, scraper, settings as settings_router, library, user_library, downloads


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    await migrate_unescape_titles()
    yield


app = FastAPI(
    title="Kr8bit",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(games.router, prefix="/api", tags=["games"])
app.include_router(categories.router, prefix="/api", tags=["categories"])
app.include_router(tags.router, prefix="/api", tags=["tags"])
app.include_router(enrichment.router, prefix="/api", tags=["enrichment"])
app.include_router(qbittorrent.router, prefix="/api", tags=["qbittorrent"])
app.include_router(download_clients.router, prefix="/api", tags=["download_clients"])
app.include_router(scraper.router, prefix="/api", tags=["scraper"])
app.include_router(settings_router.router, prefix="/api", tags=["settings"])
app.include_router(library.router, prefix="/api", tags=["library"])
app.include_router(user_library.router, prefix="/api", tags=["user_library"])
app.include_router(downloads.router, prefix="/api", tags=["downloads"])


@app.get("/api/health")
async def health():
    return {"status": "ok"}