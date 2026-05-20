import asyncio
import os

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Game, EnrichmentSourceLog
from app.schemas import (
    EnrichmentStatusOut,
    EnrichmentSourceStatus,
    EnrichmentRunRequest,
    ManualMatchRequest,
    FailedEnrichmentResponse,
    FailedEnrichmentItem,
    EnrichmentLogFileResponse,
)
from app.services.enrichment import (
    run_module_background,
    get_enrichment_counts,
    get_enrichment_status as get_enrich_status,
    stop_module,
    stop_all,
    enrich_single_game_modules,
    reset_all_enrichments,
    is_module_running,
    is_any_running,
    ENRICHMENT_LOG_FILE,
    SOURCE_MODULES,
)
from app.services.igdb_client import search_igdb, igdb_is_configured
from app.config import settings

router = APIRouter()

_module_tasks: dict[str, asyncio.Task] = {}


@router.get("/enrichment/status", response_model=EnrichmentStatusOut)
async def get_enrichment_status(db: AsyncSession = Depends(get_db)):
    total = (await db.execute(select(func.count(Game.id)))).scalar() or 0
    counts = await get_enrichment_counts(db)
    status = await get_enrich_status()

    from app.schemas import EnrichmentModuleStatus
    metadata_status = EnrichmentModuleStatus(
        igdb=counts["igdb"],
        steam=counts["steam"],
        steamgrid=counts["steamgrid"],
        protondb=counts["protondb"],
        hltb=counts["hltb"],
        pending=counts["pending"],
    )

    return EnrichmentStatusOut(
        is_running=status["is_running"],
        modules=status["modules"],
        sources=status["sources"],
        total_games=total,
        metadata=metadata_status,
    )


@router.post("/enrichment/run")
async def trigger_enrichment(module: str | None = None):
    if is_any_running():
        return {"status": "already_running"}

    target = module or "all"
    if target not in ("all", "metadata", "assets", "info") and target not in SOURCE_MODULES.get("all", []):
        raise HTTPException(status_code=400, detail=f"Invalid module: {target}")

    task = asyncio.create_task(run_module_background(target))
    _module_tasks[target] = task
    return {"status": "started", "module": target}


@router.post("/enrichment/run/{module}")
async def trigger_module(module: str):
    if module not in ("all", "metadata", "assets", "info") and module not in SOURCE_MODULES.get("all", []):
        raise HTTPException(status_code=400, detail=f"Invalid module: {module}")

    if is_module_running(module):
        return {"status": "already_running", "module": module}

    task = asyncio.create_task(run_module_background(module))
    _module_tasks[module] = task
    return {"status": "started", "module": module}


@router.post("/enrichment/stop")
async def trigger_stop_all():
    stop_all()
    return {"status": "stopped"}


@router.post("/enrichment/stop/{module}")
async def trigger_stop_module(module: str):
    was_running = stop_module(module)
    return {"status": "stopped" if was_running else "not_running", "module": module}


@router.post("/enrichment/run/{game_id}")
async def trigger_enrichment_single(
    game_id: int,
    modules: str = Query(None, description="Comma-separated modules: metadata,assets,info or sources: igdb,steam,steamgrid,protondb,hltb"),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Game).where(Game.id == game_id))
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    target_modules = None
    if modules:
        parts = [m.strip() for m in modules.split(",")]
        valid = {"all", "metadata", "assets", "info", "igdb", "steam", "steamgrid", "protondb", "hltb"}
        for p in parts:
            if p not in valid:
                raise HTTPException(status_code=400, detail=f"Invalid module/source: {p}")
        target_modules = parts

    stats = await enrich_single_game_modules(db, game, target_modules or ["metadata", "assets", "info"])

    return {
        "status": "completed",
        "game_id": game_id,
        "modules": target_modules or ["all"],
        "stats": stats,
    }


@router.post("/enrichment/match")
async def manual_match(req: ManualMatchRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Game).where(Game.id == req.game_id))
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    if req.igdb_id:
        game.igdb_id = req.igdb_id
        game.igdb_status = "pending"
    if req.steam_app_id:
        game.steam_app_id = req.steam_app_id
        game.steam_status = "pending"

    await db.commit()

    if req.igdb_id:
        await enrich_single_game_modules(db, game, ["metadata"])

    return {
        "status": "completed",
        "game_id": req.game_id,
        "igdb_id": game.igdb_id,
        "steam_app_id": game.steam_app_id,
    }


@router.get("/enrichment/igdb/search")
async def search_igdb_games(q: str = Query(..., min_length=1)):
    results = await search_igdb(q)
    return [
        {
            "igdb_id": r.get("id"),
            "name": r.get("name", ""),
            "cover_url": r.get("cover", {}).get("url", "") if isinstance(r.get("cover"), dict) else "",
            "first_release_date": r.get("first_release_date"),
        }
        for r in results
    ]


@router.get("/enrichment/config")
async def get_enrichment_config():
    return {
        "igdb_configured": await igdb_is_configured(),
        "steam_available": True,
        "steamgrid_configured": bool(settings.steamgriddb_api_key),
        "modules": list(SOURCE_MODULES.keys()),
        "sources": list(SOURCE_MODULES.values()),
    }


@router.get("/enrichment/failed", response_model=FailedEnrichmentResponse)
async def get_failed_enrichments(
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
):
    total = (await db.execute(
        select(func.count(Game.id)).where(
            (Game.igdb_status == "failed") |
            (Game.steam_status == "failed") |
            (Game.steamgrid_status == "failed") |
            (Game.protondb_status == "failed") |
            (Game.hltb_status == "failed")
        )
    )).scalar() or 0

    result = await db.execute(
        select(Game)
        .where(
            (Game.igdb_status == "failed") |
            (Game.steam_status == "failed") |
            (Game.steamgrid_status == "failed") |
            (Game.protondb_status == "failed") |
            (Game.hltb_status == "failed")
        )
        .order_by(Game.id.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    games = result.scalars().all()

    items = []
    for game in games:
        items.append(FailedEnrichmentItem(
            game_id=game.id,
            title=game.title,
            enrichment=EnrichmentSourceStatus(
                igdb=game.igdb_status,
                steam=game.steam_status,
                steamgrid=game.steamgrid_status,
                protondb=game.protondb_status,
                hltb=game.hltb_status,
            ),
            igdb_id=game.igdb_id,
            steam_app_id=game.steam_app_id,
            error_message="",
            attempted_at=game.enrichment_matched_at,
        ))

    total_pages = (total + per_page - 1) // per_page
    return FailedEnrichmentResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.get("/enrichment/logs")
async def get_enrichment_log():
    if not os.path.exists(ENRICHMENT_LOG_FILE):
        return PlainTextResponse("# No enrichment log file found. Run enrichment first.\n")
    try:
        with open(ENRICHMENT_LOG_FILE, "r", encoding="utf-8") as f:
            content = f.read()
        return PlainTextResponse(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Could not read log file: {e}")


@router.post("/enrichment/reset")
async def reset_enrichment(
    module: str | None = Query(None, description="Module to reset: metadata, assets, info, or specific source"),
    confirm: bool = Query(False),
    db: AsyncSession = Depends(get_db),
):
    if not confirm:
        raise HTTPException(
            status_code=400,
            detail="This is destructive. Add ?confirm=true to proceed."
        )
    result = await reset_all_enrichments(db, module)
    return result