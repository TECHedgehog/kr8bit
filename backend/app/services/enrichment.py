import asyncio
import logging
import os
import time
from datetime import datetime, timezone

import httpx
from sqlalchemy import select, case, func, delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session
from app.models import (
    Game, GameScreenshot, GameVideo, GameSystemRequirement,
    SteamGenre, GameSteamGenre, SteamCategory, GameSteamCategory,
    IgdbGenre, GameIgdbGenre, ProtonDBData, HowLongToBeatData,
    EnrichmentSourceLog, SteamGridImage,
)
from app.services.title_matcher import clean_title, make_search_variants, verify_igdb_match
from app.services.igdb_client import (
    search_igdb, get_igdb_details, parse_igdb_meta, igdb_is_configured,
)
from app.services.steam_client import get_app_details, extract_steam_deck_status, parse_steam_meta
from app.services.protondb_client import fetch_protondb_data
from app.services.hltb_client import fetch_hltb_data
from app.services.steamgrid_client import SteamGridDBClient, search_and_get_images

logger = logging.getLogger(__name__)

_igdb_semaphore = asyncio.Semaphore(1)
_running_modules: dict[str, bool] = {}
_module_locks: dict[str, asyncio.Lock] = {}
_module_cancel_events: dict[str, asyncio.Event] = {}
_module_tasks: dict[str, asyncio.Task] = {}
ENRICHMENT_LOG_FILE = "data/enrichment_log.txt"

SOURCES = ["igdb", "steam", "steamgrid", "protondb", "hltb"]
SOURCE_MODULES = {
    "metadata": ["igdb", "steam"],
    "assets": ["steamgrid"],
    "info": ["protondb", "hltb"],
}


def _get_module_lock(module: str) -> asyncio.Lock:
    if module not in _module_locks:
        _module_locks[module] = asyncio.Lock()
    return _module_locks[module]


def _get_cancel_event(module: str) -> asyncio.Event:
    if module not in _module_cancel_events:
        _module_cancel_events[module] = asyncio.Event()
    return _module_cancel_events[module]


def is_module_running(module: str) -> bool:
    return _running_modules.get(module, False)


def is_any_running() -> bool:
    return any(_running_modules.values())


def stop_module(module: str) -> bool:
    if _running_modules.get(module):
        _get_cancel_event(module).set()
        return True
    return False


def stop_all():
    for module in list(_running_modules.keys()):
        stop_module(module)


async def _igdb_call(fn, *args, **kwargs):
    async with _igdb_semaphore:
        start = time.monotonic()
        result = await fn(*args, **kwargs)
        elapsed = time.monotonic() - start
        delay = max(0, (1.0 / settings.igdb_rate_limit) - elapsed)
        if delay > 0:
            await asyncio.sleep(delay)
        return result


async def _write_source_log(
    db: AsyncSession,
    game_id: int,
    source: str,
    status: str,
    error_message: str = "",
):
    try:
        result = await db.execute(
            select(EnrichmentSourceLog).where(
                EnrichmentSourceLog.game_id == game_id,
                EnrichmentSourceLog.source == source,
            )
        )
        log = result.scalar_one_or_none()
        now = datetime.now(timezone.utc)
        if not log:
            log = EnrichmentSourceLog(game_id=game_id, source=source)
            db.add(log)
        log.status = status
        log.error_message = error_message
        log.attempted_at = now
    except IntegrityError:
        await db.rollback()


def _write_file_log_line(line: str):
    os.makedirs("data", exist_ok=True)
    with open(ENRICHMENT_LOG_FILE, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def _start_file_log(module: str = "all"):
    os.makedirs("data", exist_ok=True)
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    with open(ENRICHMENT_LOG_FILE, "w", encoding="utf-8") as f:
        f.write(f"# Enrichment Run Started: {now} | Module: {module}\n")
        f.write("# Format: [STATUS] Game #ID: Title -> Source (ID)\n")


def _finish_file_log(stats: dict, module: str = "all"):
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    with open(ENRICHMENT_LOG_FILE, "a", encoding="utf-8") as f:
        f.write(f"\n# --- Enrichment Run Summary ({module}) ---\n")
        f.write(f"# Completed: {now}\n")
        for src, cnt in stats.items():
            f.write(f"# {src}: {cnt}\n")


async def run_module_background(module: str) -> dict:
    global _running_modules
    lock = _get_module_lock(module)
    cancel_event = _get_cancel_event(module)

    async with lock:
        if _running_modules.get(module):
            return {"status": "already_running", "module": module}
        _running_modules[module] = True
        cancel_event.clear()

    stats = {s: 0 for s in SOURCE_MODULES.get(module, [module])}
    stats["total"] = 0
    stats["failed"] = 0
    _start_file_log(module)

    try:
        if module == "all":
            await _run_all_background(stats, cancel_event)
        elif module == "metadata":
            await _run_metadata_background(stats, cancel_event)
        elif module == "assets":
            await _run_assets_background(stats, cancel_event)
        elif module == "info":
            await _run_info_background(stats, cancel_event)
        else:
            await _run_single_source_background(module, stats, cancel_event)
    except Exception as e:
        logger.error(f"Module '{module}' enrichment failed: {e}", exc_info=True)
    finally:
        _finish_file_log(stats, module)
        _running_modules[module] = False
        cancel_event.clear()

    return {"status": "completed", "module": module, "stats": stats}


async def _run_all_background(stats: dict, cancel_event: asyncio.Event):
    metadata_stats = {s: 0 for s in SOURCE_MODULES["metadata"]}
    metadata_stats["total"] = 0
    metadata_stats["failed"] = 0
    _start_file_log("metadata")
    try:
        await _run_metadata_background(metadata_stats, cancel_event)
    finally:
        _finish_file_log(metadata_stats, "metadata")
    stats.update(metadata_stats)

    if cancel_event.is_set():
        return

    assets_stats = {s: 0 for s in SOURCE_MODULES["assets"]}
    assets_stats["total"] = 0
    assets_stats["failed"] = 0
    _start_file_log("assets")
    try:
        await _run_assets_background(assets_stats, cancel_event)
    finally:
        _finish_file_log(assets_stats, "assets")
    stats.update(assets_stats)

    if cancel_event.is_set():
        return

    info_stats = {s: 0 for s in SOURCE_MODULES["info"]}
    info_stats["total"] = 0
    info_stats["failed"] = 0
    _start_file_log("info")
    try:
        await _run_info_background(info_stats, cancel_event)
    finally:
        _finish_file_log(info_stats, "info")
    stats.update(info_stats)


async def _run_metadata_background(stats: dict, cancel_event: asyncio.Event):
    statuses_igdb = ["none", "pending"]
    statuses_steam = ["none", "pending"]

    async with async_session() as db:
        result = await db.execute(
            select(Game.id).where(
                (Game.igdb_status.in_(statuses_igdb)) | (Game.steam_status.in_(statuses_steam))
            ).order_by(
                case(
                    (Game.igdb_status == "pending", 0),
                    (Game.igdb_status == "none", 1),
                    else_=2,
                )
            ).limit(settings.enrichment_batch_size)
        )
        game_ids = [row[0] for row in result.all()]

    if not game_ids:
        return

    is_sqlite = "sqlite" in settings.database_url
    concurrency = 1 if is_sqlite else settings.enrichment_concurrency
    sem = asyncio.Semaphore(concurrency)

    async def _enrich_game(game_id: int):
        async with sem:
            if cancel_event.is_set():
                return
            async with async_session() as db:
                game = await db.get(Game, game_id)
                if not game:
                    return
                try:
                    await _enrich_metadata(db, game, stats, cancel_event)
                except Exception as e:
                    logger.warning(f"Metadata enrichment failed for game {game_id}: {e}")
                    stats["failed"] += 1
                    stats["total"] += 1
                    try:
                        await db.rollback()
                    except Exception:
                        pass

    await asyncio.gather(*[_enrich_game(gid) for gid in game_ids])


async def _run_assets_background(stats: dict, cancel_event: asyncio.Event):
    statuses = ["none", "pending"]

    async with async_session() as db:
        result = await db.execute(
            select(Game.id).where(Game.steamgrid_status.in_(statuses))
            .where(Game.igdb_id.isnot(None) | Game.steam_app_id.isnot(None))
            .order_by(
                case(
                    (Game.steamgrid_status == "pending", 0),
                    (Game.steamgrid_status == "none", 1),
                    else_=2,
                )
            ).limit(settings.enrichment_batch_size)
        )
        game_ids = [row[0] for row in result.all()]

    if not game_ids:
        return

    is_sqlite = "sqlite" in settings.database_url
    concurrency = 1 if is_sqlite else settings.enrichment_concurrency
    sem = asyncio.Semaphore(concurrency)

    async def _enrich_game(game_id: int):
        async with sem:
            if cancel_event.is_set():
                return
            async with async_session() as db:
                game = await db.get(Game, game_id)
                if not game:
                    return
                try:
                    await _enrich_assets(db, game, stats)
                except Exception as e:
                    logger.warning(f"SteamGridDB enrichment failed for game {game_id}: {e}")
                    stats["failed"] += 1
                    stats["total"] += 1
                    try:
                        await db.rollback()
                    except Exception:
                        pass

    await asyncio.gather(*[_enrich_game(gid) for gid in game_ids])


async def _run_info_background(stats: dict, cancel_event: asyncio.Event):
    statuses = ["none", "pending"]

    async with async_session() as db:
        result = await db.execute(
            select(Game.id).where(
                (Game.protondb_status.in_(statuses)) | (Game.hltb_status.in_(statuses))
            ).where(Game.steam_app_id.isnot(None))
            .order_by(
                case(
                    (Game.protondb_status == "pending", 0),
                    (Game.hltb_status == "pending", 0),
                    (Game.protondb_status == "none", 1),
                    (Game.hltb_status == "none", 1),
                    else_=2,
                )
            ).limit(settings.enrichment_batch_size)
        )
        game_ids = [row[0] for row in result.all()]

    if not game_ids:
        return

    is_sqlite = "sqlite" in settings.database_url
    concurrency = 1 if is_sqlite else settings.enrichment_concurrency
    sem = asyncio.Semaphore(concurrency)

    async def _enrich_game(game_id: int):
        async with sem:
            if cancel_event.is_set():
                return
            async with async_session() as db:
                game = await db.get(Game, game_id)
                if not game:
                    return
                try:
                    await _enrich_info(db, game, stats)
                except Exception as e:
                    logger.warning(f"Info enrichment failed for game {game_id}: {e}")
                    stats["failed"] += 1
                    stats["total"] += 1
                    try:
                        await db.rollback()
                    except Exception:
                        pass

    await asyncio.gather(*[_enrich_game(gid) for gid in game_ids])


async def _run_single_source_background(source: str, stats: dict, cancel_event: asyncio.Event):
    if source not in SOURCES:
        return

    status_col = getattr(Game, f"{source}_status")
    statuses = ["none", "pending"]

    async with async_session() as db:
        result = await db.execute(
            select(Game.id).where(status_col.in_(statuses))
            .order_by(
                case(
                    (status_col == "pending", 0),
                    (status_col == "none", 1),
                    else_=2,
                )
            ).limit(settings.enrichment_batch_size)
        )
        game_ids = [row[0] for row in result.all()]

    if not game_ids:
        return

    is_sqlite = "sqlite" in settings.database_url
    concurrency = 1 if is_sqlite else settings.enrichment_concurrency
    sem = asyncio.Semaphore(concurrency)

    async def _enrich_game(game_id: int):
        async with sem:
            if cancel_event.is_set():
                return
            async with async_session() as db:
                game = await db.get(Game, game_id)
                if not game:
                    return
                try:
                    await _enrich_single_source(db, game, source, stats)
                except Exception as e:
                    logger.warning(f"Enrichment ({source}) failed for game {game_id}: {e}")
                    stats["failed"] += 1
                    stats["total"] += 1
                    try:
                        await db.rollback()
                    except Exception:
                        pass

    await asyncio.gather(*[_enrich_game(gid) for gid in game_ids])


async def _enrich_single_source(db: AsyncSession, game: Game, source: str, stats: dict):
    if source == "igdb":
        await _enrich_igdb(db, game, stats)
    elif source == "steam":
        await _enrich_steam(db, game, stats)
    elif source == "steamgrid":
        await _enrich_assets(db, game, stats)
    elif source == "protondb":
        await _enrich_protondb(db, game, stats)
    elif source == "hltb":
        await _enrich_hltb(db, game, stats)


async def _enrich_metadata(db: AsyncSession, game: Game, stats: dict, cancel_event: asyncio.Event):
    clean = clean_title(game.title)
    if not game.title_clean:
        game.title_clean = clean

    variants = make_search_variants(clean)
    igdb_matched = False
    steam_matched = False
    error_message = ""

    use_igdb = await igdb_is_configured()
    if use_igdb and game.igdb_status in ("none", "pending"):
        igdb_matched = await _try_igdb(db, game, clean, stats)
        if igdb_matched:
            game.igdb_status = "matched"
            _write_file_log_line(f"[SUCCESS] Game #{game.id}: \"{game.title}\" -> IGDB ({game.igdb_id})")
        else:
            game.igdb_status = "failed"
            error_message = f"No IGDB match for: {clean}"
            await _write_source_log(db, game.id, "igdb", "failed", error_message)
            _write_file_log_line(f"[FAILED]  Game #{game.id}: \"{game.title}\" -> IGDB ({error_message})")

    if cancel_event.is_set():
        await db.commit()
        return

    if game.steam_app_id and game.steam_status in ("none", "pending"):
        steam_matched = await _enrich_steam(db, game, stats)
        if steam_matched:
            game.steam_status = "matched"

    game.enrichment_matched_at = datetime.now(timezone.utc)
    await db.commit()
    stats["total"] += 1


async def _enrich_igdb(db: AsyncSession, game: Game, stats: dict) -> bool:
    clean = clean_title(game.title)
    variants = make_search_variants(clean)

    for query in variants:
        results = await _igdb_call(search_igdb, query, None)
        if not results:
            continue

        for result in results:
            if verify_igdb_match(clean, result, threshold=55):
                igdb_id = result.get("id")
                if not igdb_id:
                    continue
                details = await _igdb_call(get_igdb_details, igdb_id, None)
                if not details:
                    continue
                if verify_igdb_match(clean, details, threshold=55):
                    await _apply_igdb_data(db, game, details)
                    game.igdb_status = "matched"
                    stats["igdb"] = stats.get("igdb", 0) + 1
                    return True

    game.igdb_status = "failed"
    await _write_source_log(db, game.id, "igdb", "failed", f"No IGDB match for: {clean}")
    stats["igdb"] = stats.get("igdb", 0)
    return False


async def _enrich_steam(db: AsyncSession, game: Game, stats: dict) -> bool:
    if not game.steam_app_id:
        game.steam_status = "skipped"
        await _write_source_log(db, game.id, "steam", "skipped", "No steam_app_id")
        return False

    async with httpx.AsyncClient() as client:
        steam_details = await get_app_details(game.steam_app_id, client)

    if not steam_details:
        game.steam_status = "failed"
        await _write_source_log(db, game.id, "steam", "failed", f"Steam app {game.steam_app_id} not found")
        return False

    await _apply_steam_fallback(db, game, steam_details)
    game.steam_status = "matched"
    stats["steam"] = stats.get("steam", 0) + 1
    return True


async def _enrich_assets(db: AsyncSession, game: Game, stats: dict):
    if game.steamgrid_status == "matched":
        return

    search_name = game.steam_name or game.title_clean or clean_title(game.title)
    steam_app_id = game.steam_app_id

    client = SteamGridDBClient()
    try:
        images = await search_and_get_images(search_name, steam_app_id)
        if not images:
            game.steamgrid_status = "failed"
            await _write_source_log(db, game.id, "steamgrid", "failed", "No SteamGridDB results")
            _write_file_log_line(f"[FAILED]  Game #{game.id}: \"{game.title}\" -> SGDB (no results)")
            return

        grid = images.get("grid")
        hero = images.get("hero")
        logo = images.get("logo")
        icon = images.get("icon")

        if grid:
            game.sgdb_grid_url = grid.get("url", "")
        if hero:
            game.sgdb_hero_url = hero.get("url", "")
        if logo:
            game.sgdb_logo_url = logo.get("url", "")
        if icon:
            game.sgdb_icon_url = icon.get("url", "")

        await db.execute(
            delete(SteamGridImage).where(SteamGridImage.game_id == game.id)
        )

        for i, g in enumerate(images.get("all_grids", [])):
            db.add(SteamGridImage(
                game_id=game.id,
                sgdb_game_id=images.get("sgdb_id"),
                image_type="grid",
                url=g.get("url", ""),
                thumbnail_url=g.get("thumb", ""),
                width=g.get("width"),
                height=g.get("height"),
                style=g.get("style", ""),
                is_nsfw=g.get("nsfw", False),
                is_humor=g.get("humor", False),
                index_order=i,
            ))

        for i, h in enumerate(images.get("all_heroes", [])):
            db.add(SteamGridImage(
                game_id=game.id,
                sgdb_game_id=images.get("sgdb_id"),
                image_type="hero",
                url=h.get("url", ""),
                thumbnail_url=h.get("thumb", ""),
                width=h.get("width"),
                height=h.get("height"),
                style=h.get("style", ""),
                is_nsfw=h.get("nsfw", False),
                is_humor=h.get("humor", False),
                index_order=i,
            ))

        for i, l in enumerate(images.get("all_logos", [])):
            db.add(SteamGridImage(
                game_id=game.id,
                sgdb_game_id=images.get("sgdb_id"),
                image_type="logo",
                url=l.get("url", ""),
                thumbnail_url=l.get("thumb", ""),
                width=l.get("width"),
                height=l.get("height"),
                style=l.get("style", ""),
                is_nsfw=l.get("nsfw", False),
                is_humor=l.get("humor", False),
                index_order=i,
            ))

        for i, ic in enumerate(images.get("all_icons", [])):
            db.add(SteamGridImage(
                game_id=game.id,
                sgdb_game_id=images.get("sgdb_id"),
                image_type="icon",
                url=ic.get("url", ""),
                thumbnail_url=ic.get("thumb", ""),
                width=ic.get("width"),
                height=ic.get("height"),
                style=ic.get("style", ""),
                is_nsfw=ic.get("nsfw", False),
                is_humor=ic.get("humor", False),
                index_order=i,
            ))

        game.steamgrid_status = "matched"
        stats["steamgrid"] = stats.get("steamgrid", 0) + 1
        _write_file_log_line(f"[SUCCESS] Game #{game.id}: \"{game.title}\" -> SGDB (id={images.get('sgdb_id')})")

    except Exception as e:
        game.steamgrid_status = "failed"
        await _write_source_log(db, game.id, "steamgrid", "failed", str(e))
        _write_file_log_line(f"[FAILED]  Game #{game.id}: \"{game.title}\" -> SGDB ({e})")
        stats["steamgrid"] = stats.get("steamgrid", 0)
    finally:
        await client.close()


async def _enrich_info(db: AsyncSession, game: Game, stats: dict):
    await _enrich_protondb(db, game, stats)
    await _enrich_hltb(db, game, stats)


async def _enrich_protondb(db: AsyncSession, game: Game, stats: dict):
    if game.protondb_status == "matched" or not game.steam_app_id:
        return

    async with httpx.AsyncClient() as client:
        try:
            protondb_data = await fetch_protondb_data(game.steam_app_id, client)
            if protondb_data:
                await _apply_protondb_data(db, game, protondb_data)
                game.protondb_status = "matched"
                stats["protondb"] = stats.get("protondb", 0) + 1
                _write_file_log_line(f"[SUCCESS] Game #{game.id}: \"{game.title}\" -> ProtonDB")
            else:
                game.protondb_status = "failed"
                await _write_source_log(db, game.id, "protondb", "failed", "No ProtonDB data")
                stats["protondb"] = stats.get("protondb", 0)
        except Exception as e:
            game.protondb_status = "failed"
            await _write_source_log(db, game.id, "protondb", "failed", str(e))
            stats["protondb"] = stats.get("protondb", 0)


async def _enrich_hltb(db: AsyncSession, game: Game, stats: dict):
    if game.hltb_status == "matched":
        return

    clean = game.title_clean or clean_title(game.title)
    async with httpx.AsyncClient() as client:
        try:
            hltb = await fetch_hltb_data(clean, client)
            if hltb:
                await _apply_hltb_data(db, game, hltb)
                game.hltb_status = "matched"
                stats["hltb"] = stats.get("hltb", 0) + 1
                _write_file_log_line(f"[SUCCESS] Game #{game.id}: \"{game.title}\" -> HLTB")
            else:
                game.hltb_status = "failed"
                await _write_source_log(db, game.id, "hltb", "failed", "No HLTB match")
                stats["hltb"] = stats.get("hltb", 0)
        except Exception as e:
            game.hltb_status = "failed"
            await _write_source_log(db, game.id, "hltb", "failed", str(e))
            stats["hltb"] = stats.get("hltb", 0)


async def enrich_single_game_modules(
    db: AsyncSession,
    game: Game,
    modules: list[str],
) -> dict:
    stats = {}
    clean = clean_title(game.title)
    if not game.title_clean:
        game.title_clean = clean

    for module in modules:
        if module == "metadata":
            await _enrich_metadata(db, game, stats, asyncio.Event())
        elif module == "assets":
            await _enrich_assets(db, game, stats)
        elif module == "info":
            await _enrich_info(db, game, stats)
        elif module in SOURCES:
            await _enrich_single_source(db, game, module, stats)

    await db.commit()
    return stats


async def _apply_igdb_data(db: AsyncSession, game: Game, data: dict):
    meta = parse_igdb_meta(data)

    game.igdb_id = meta["igdb_id"]
    game.title = meta["igdb_name"] or game.title
    game.description = meta["description"] or game.description
    game.description_full = meta["description_full"] or game.description_full
    game.header_image = meta["header_image"] or game.header_image
    game.capsule_image = meta["capsule_image"] or game.capsule_image
    game.background_image = meta["background_image"] or game.background_image
    game.igdb_rating = meta.get("igdb_rating")
    game.igdb_rating_count = meta.get("igdb_rating_count")
    game.release_date_steam = meta["release_date_steam"] or game.release_date_steam
    game.website = meta["website"] or game.website
    if meta.get("steam_app_id") and not game.steam_app_id:
        game.steam_app_id = meta["steam_app_id"]
    game.platforms_windows = meta["platforms_windows"] or game.platforms_windows
    game.platforms_mac = meta["platforms_mac"] or game.platforms_mac
    game.platforms_linux = meta["platforms_linux"] or game.platforms_linux
    if meta["companies"] and not game.companies:
        game.companies = meta["companies"]
    game.igdb_status = "matched"

    if not game.title_original:
        game.title_original = game.title

    await db.flush()

    await db.execute(delete(GameScreenshot).where(GameScreenshot.game_id == game.id))
    for ss in meta["screenshots"]:
        db.add(GameScreenshot(game_id=game.id, **ss))

    await db.execute(delete(GameVideo).where(GameVideo.game_id == game.id))
    for vid in meta["videos"]:
        db.add(GameVideo(game_id=game.id, **vid))

    await db.execute(delete(GameIgdbGenre).where(GameIgdbGenre.game_id == game.id))
    for g in meta["genres"]:
        existing = await db.execute(select(IgdbGenre).where(IgdbGenre.igdb_genre_id == g["igdb_genre_id"]))
        ig = existing.scalar_one_or_none()
        if not ig:
            ig = IgdbGenre(igdb_genre_id=g["igdb_genre_id"], name=g["name"], slug=g["slug"])
            db.add(ig)
            await db.flush()
        db.add(GameIgdbGenre(game_id=game.id, genre_id=ig.id))


async def _apply_steam_fallback(db: AsyncSession, game: Game, data: dict):
    meta = parse_steam_meta(data)

    game.steam_app_id = data.get("steam_appid", game.steam_app_id)
    game.steam_name = meta["steam_name"]
    game.title = meta["steam_name"] or game.title
    game.description = meta["description"] or game.description
    game.description_full = meta["description_full"] or game.description_full
    game.header_image = meta["header_image"] or game.header_image
    game.capsule_image = meta["capsule_image"] or game.capsule_image
    game.background_image = meta["background_image"] or game.background_image
    game.metacritic_score = meta["metacritic_score"] or game.metacritic_score
    game.steam_rating_percent = meta.get("steam_rating_percent") or game.steam_rating_percent
    game.steam_rating_count = meta.get("steam_rating_count") or game.steam_rating_count
    game.release_date_steam = meta["release_date_steam"] or game.release_date_steam
    game.website = meta["website"] or game.website
    game.platforms_windows = meta["platforms_windows"] or game.platforms_windows
    game.platforms_mac = meta["platforms_mac"] or game.platforms_mac
    game.platforms_linux = meta["platforms_linux"] or game.platforms_linux
    game.steam_deck_status = meta.get("steam_deck_status", "")
    game.steam_status = "matched"

    if not game.title_original:
        game.title_original = game.title

    await db.flush()

    await db.execute(delete(GameScreenshot).where(GameScreenshot.game_id == game.id))
    for ss in meta["screenshots"]:
        db.add(GameScreenshot(game_id=game.id, **ss))

    await db.execute(delete(GameVideo).where(GameVideo.game_id == game.id))
    for vid in meta["videos"]:
        db.add(GameVideo(game_id=game.id, **vid))

    await db.execute(delete(GameSystemRequirement).where(GameSystemRequirement.game_id == game.id))
    for req in meta["system_requirements"]:
        db.add(GameSystemRequirement(game_id=game.id, **req))

    await db.execute(delete(GameSteamGenre).where(GameSteamGenre.game_id == game.id))
    for g in meta["genres"]:
        existing = await db.execute(select(SteamGenre).where(SteamGenre.slug == g["slug"]))
        sg = existing.scalar_one_or_none()
        if not sg:
            sg = SteamGenre(name=g["name"], slug=g["slug"])
            db.add(sg)
            await db.flush()
        db.add(GameSteamGenre(game_id=game.id, genre_id=sg.id))

    await db.execute(delete(GameSteamCategory).where(GameSteamCategory.game_id == game.id))
    for c in meta["categories"]:
        existing = await db.execute(select(SteamCategory).where(SteamCategory.name == c["name"]))
        sc = existing.scalar_one_or_none()
        if not sc:
            sc = SteamCategory(steam_category_id=c["steam_category_id"], name=c["name"])
            db.add(sc)
            await db.flush()
        db.add(GameSteamCategory(game_id=game.id, category_id=sc.id))


async def _apply_protondb_data(db: AsyncSession, game: Game, data: dict):
    try:
        existing = await db.execute(
            select(ProtonDBData).where(ProtonDBData.game_id == game.id)
        )
        rec = existing.scalar_one_or_none()
        if not rec:
            rec = ProtonDBData(game_id=game.id)
            db.add(rec)
        rec.steam_app_id = data["steam_app_id"]
        rec.deck_tier = data["deck_tier"]
        rec.proton_tier = data["proton_tier"]
        rec.confidence = data["confidence"]
        rec.score = data["score"]
        rec.total_reports = data["total_reports"]
    except IntegrityError:
        await db.rollback()
        logger.warning(f"ProtonDB integrity error for game {game.id}")


async def _apply_hltb_data(db: AsyncSession, game: Game, data: dict):
    try:
        existing = await db.execute(
            select(HowLongToBeatData).where(HowLongToBeatData.game_id == game.id)
        )
        rec = existing.scalar_one_or_none()
        if not rec:
            rec = HowLongToBeatData(game_id=game.id)
            db.add(rec)
        rec.hltb_game_id = data["hltb_game_id"]
        rec.game_name = data["game_name"]
        rec.time_main = data["time_main"]
        rec.time_plus = data["time_plus"]
        rec.time_100 = data["time_100"]
        rec.time_all = data["time_all"]
        rec.count_main = data["count_main"]
        rec.count_plus = data["count_plus"]
        rec.count_100 = data["count_100"]
        rec.count_all = data["count_all"]
    except IntegrityError:
        await db.rollback()
        logger.warning(f"HLTB integrity error for game {game.id}")


async def reset_all_enrichments(db: AsyncSession, module: str | None = None):
    sources_to_reset = []
    if module == "metadata":
        sources_to_reset = ["igdb_status", "steam_status"]
    elif module == "assets":
        sources_to_reset = ["steamgrid_status"]
    elif module == "info":
        sources_to_reset = ["protondb_status", "hltb_status"]
    elif module and module in SOURCES:
        sources_to_reset = [f"{module}_status"]
    else:
        sources_to_reset = ["igdb_status", "steam_status", "steamgrid_status", "protondb_status", "hltb_status"]

    sgdb_cols = ["sgdb_grid_url", "sgdb_hero_url", "sgdb_logo_url", "sgdb_icon_url"]
    enrichment_cols = [
        "igdb_id", "igdb_status", "steam_status", "steamgrid_status", "protondb_status", "hltb_status",
        "title_clean", "enrichment_matched_at",
    ]
    all_reset_cols = list(set(sources_to_reset + sgdb_cols if module in ("assets", "all", None) else sources_to_reset))

    tables_to_clear = [
        GameScreenshot.__tablename__,
        GameVideo.__tablename__,
        GameSystemRequirement.__tablename__,
        GameSteamGenre.__tablename__,
        GameSteamCategory.__tablename__,
        GameIgdbGenre.__tablename__,
        ProtonDBData.__tablename__,
        HowLongToBeatData.__tablename__,
        EnrichmentSourceLog.__tablename__,
        SteamGridImage.__tablename__,
    ]

    for table in tables_to_clear:
        try:
            await db.execute(f"DELETE FROM {table}")
        except Exception:
            pass

    reset_sets = ", ".join([f"{col} = 'none'" for col in all_reset_cols if col.endswith("_status")])
    if module == "assets" or module in ("all", None):
        reset_sets += ", " + ", ".join([f"{col} = ''" for col in sgdb_cols])

    if reset_sets:
        await db.execute(f"UPDATE {Game.__tablename__} SET {reset_sets}")

    await db.commit()
    return {"status": "reset", "module": module or "all"}


async def get_enrichment_counts(db: AsyncSession) -> dict:
    result = await db.execute(
        select(
            func.count().label("total"),
            func.sum(case((Game.igdb_status == "matched", 1), else_=0)).label("igdb_matched"),
            func.sum(case((Game.igdb_status == "failed", 1), else_=0)).label("igdb_failed"),
            func.sum(case((Game.steam_status == "matched", 1), else_=0)).label("steam_matched"),
            func.sum(case((Game.steam_status == "failed", 1), else_=0)).label("steam_failed"),
            func.sum(case((Game.steamgrid_status == "matched", 1), else_=0)).label("steamgrid_matched"),
            func.sum(case((Game.steamgrid_status == "failed", 1), else_=0)).label("steamgrid_failed"),
            func.sum(case((Game.protondb_status == "matched", 1), else_=0)).label("protondb_matched"),
            func.sum(case((Game.protondb_status == "failed", 1), else_=0)).label("protondb_failed"),
            func.sum(case((Game.hltb_status == "matched", 1), else_=0)).label("hltb_matched"),
            func.sum(case((Game.hltb_status == "failed", 1), else_=0)).label("hltb_failed"),
        ).select_from(Game)
    )
    row = result.one()

    pending = await db.execute(
        select(func.count(Game.id)).where(
            (Game.igdb_status.in_(["none", "pending"])) |
            (Game.steam_status.in_(["none", "pending"])) |
            (Game.steamgrid_status.in_(["none", "pending"])) |
            (Game.protondb_status.in_(["none", "pending"])) |
            (Game.hltb_status.in_(["none", "pending"]))
        )
    )
    pending_count = pending.scalar() or 0

    return {
        "total": row.total or 0,
        "igdb": {"matched": row.igdb_matched or 0, "failed": row.igdb_failed or 0},
        "steam": {"matched": row.steam_matched or 0, "failed": row.steam_failed or 0},
        "steamgrid": {"matched": row.steamgrid_matched or 0, "failed": row.steamgrid_failed or 0},
        "protondb": {"matched": row.protondb_matched or 0, "failed": row.protondb_failed or 0},
        "hltb": {"matched": row.hltb_matched or 0, "failed": row.hltb_failed or 0},
        "pending": pending_count,
        "metadata": {
            "pending": pending_count,
        },
    }


async def get_enrichment_status() -> dict:
    return {
        "is_running": is_any_running(),
        "modules": {
            "metadata": is_module_running("metadata"),
            "assets": is_module_running("assets"),
            "info": is_module_running("info"),
            "all": is_module_running("all"),
        },
        "sources": {s: is_module_running(s) for s in SOURCES},
    }