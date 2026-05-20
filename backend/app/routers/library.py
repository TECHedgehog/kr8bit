"""
Library router: CRUD, file browser, download proxy, scan trigger.
"""

from __future__ import annotations

import logging
import mimetypes
import os
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models import (
    Game, LocalLibraryEntry, UserLibraryEntry, User,
    LocalSystemRequirement, LocalSteamGenre, LocalIgdbGenre,
    SteamGenre, IgdbGenre, DownloadClient,
)
from app.schemas import (
    LocalLibraryEntryOut, LocalLibraryEntryDetail, LibraryStatsOut,
    FileEntryOut, LibraryListResponse, UserLibraryListResponse,
    LocalSystemRequirementOut, LocalGenreOut, GameSearchResult,
    EnrichmentSourceStatus, SteamGridImageOut,
)
from app.services.library_scanner import (
    scan_library_directory, scan_downloads_directory, move_to_library,
    LIBRARY_PATH, DOWNLOADS_PATH,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _secure_path(base: Path, rel_path: str) -> Path:
    """Resolve a relative path under base, preventing path traversal."""
    target = (base / rel_path).resolve()
    if not str(target).startswith(str(base.resolve())):
        raise HTTPException(status_code=400, detail="Invalid path")
    return target


@router.get("/library", response_model=LibraryListResponse)
async def list_library(
    page: int = Query(1, ge=1),
    per_page: int = Query(48, ge=1, le=200),
    search: str | None = None,
    format: str | None = None,
    matched: bool | None = None,
    available: bool | None = None,
    sort: str = Query("date_desc", regex="^(date_desc|date_asc|name_asc|name_desc|size_desc|size_asc)$"),
    db: AsyncSession = Depends(get_db),
):
    query = select(LocalLibraryEntry)

    filters = []
    if search:
        like = f"%{search}%"
        filters.append(
            or_(
                LocalLibraryEntry.name.ilike(like),
                LocalLibraryEntry.title.ilike(like),
                LocalLibraryEntry.steam_name.ilike(like),
            )
        )
    if format:
        filters.append(LocalLibraryEntry.format == format)
    if matched is not None:
        if matched:
            filters.append(LocalLibraryEntry.game_id.isnot(None))
        else:
            filters.append(LocalLibraryEntry.game_id.is_(None))
    if available is not None:
        filters.append(LocalLibraryEntry.is_available == available)

    for f in filters:
        query = query.where(f)

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0

    sort_map = {
        "date_desc": LocalLibraryEntry.date_added.desc(),
        "date_asc": LocalLibraryEntry.date_added.asc(),
        "name_asc": LocalLibraryEntry.title.asc(),
        "name_desc": LocalLibraryEntry.title.desc(),
        "size_desc": LocalLibraryEntry.folder_size.desc(),
        "size_asc": LocalLibraryEntry.folder_size.asc(),
    }
    order = sort_map.get(sort, LocalLibraryEntry.date_added.desc())

    query = query.order_by(order).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    entries = result.scalars().all()

    return LibraryListResponse(
        items=[_entry_to_out(e) for e in entries],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=max(1, (total + per_page - 1) // per_page),
    )


@router.get("/library/stats", response_model=LibraryStatsOut)
async def library_stats(db: AsyncSession = Depends(get_db)):
    total = (await db.execute(select(func.count(LocalLibraryEntry.id)))).scalar() or 0
    user_total = (await db.execute(select(func.count(UserLibraryEntry.id)))).scalar() or 0
    total_size = (await db.execute(select(func.sum(LocalLibraryEntry.folder_size)))).scalar() or 0
    downloading = (await db.execute(
        select(func.count(LocalLibraryEntry.id)).where(LocalLibraryEntry.download_status == "downloading")
    )).scalar() or 0
    matched = (await db.execute(
        select(func.count(LocalLibraryEntry.id)).where(LocalLibraryEntry.game_id.isnot(None))
    )).scalar() or 0
    unmatched = total - matched
    available = (await db.execute(
        select(func.count(LocalLibraryEntry.id)).where(LocalLibraryEntry.is_available == True)
    )).scalar() or 0
    unavailable = total - available

    return LibraryStatsOut(
        total_library_games=total,
        total_user_games=user_total,
        total_size=total_size or 0,
        downloading_count=downloading,
        matched_count=matched,
        unmatched_count=unmatched,
        available_count=available,
        unavailable_count=unavailable,
    )


@router.get("/library/{entry_id}", response_model=LocalLibraryEntryDetail)
async def get_library_entry(entry_id: int, db: AsyncSession = Depends(get_db)):
    query = (
        select(LocalLibraryEntry)
        .options(
            selectinload(LocalLibraryEntry.system_requirements),
            selectinload(LocalLibraryEntry.steam_genres).selectinload(LocalSteamGenre.genre),
            selectinload(LocalLibraryEntry.igdb_genres).selectinload(LocalIgdbGenre.genre),
            selectinload(LocalLibraryEntry.game),
        )
        .where(LocalLibraryEntry.id == entry_id)
    )
    result = await db.execute(query)
    entry = result.unique().scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Library entry not found")

    game_out = None
    if entry.game:
        game_out = GameSearchResult(
            id=entry.game.id,
            title=entry.game.title,
            slug=entry.game.slug,
            header_image=entry.game.header_image or entry.game.image_url or "",
            date_published=entry.game.date_published,
            enrichment=EnrichmentSourceStatus(
                igdb=entry.game.igdb_status or "none",
                steam=entry.game.steam_status or "none",
                steamgrid=entry.game.steamgrid_status or "none",
                protondb=entry.game.protondb_status or "none",
                hltb=entry.game.hltb_status or "none",
            ),
        )

    return LocalLibraryEntryDetail(
        id=entry.id,
        name=entry.name,
        title=entry.title,
        original_name=entry.original_name or "",
        folder_path=entry.folder_path,
        folder_size=entry.folder_size,
        file_count=entry.file_count,
        format=entry.format,
        game_id=entry.game_id,
        steam_app_id=entry.steam_app_id,
        steam_name=entry.steam_name or "",
        igdb_id=entry.igdb_id,
        description=entry.description or "",
        description_full=entry.description_full or "",
        header_image=entry.header_image or "",
        capsule_image=entry.capsule_image or "",
        background_image=entry.background_image or "",
        sgdb_grid_url=entry.sgdb_grid_url or "",
        sgdb_hero_url=entry.sgdb_hero_url or "",
        sgdb_logo_url=entry.sgdb_logo_url or "",
        sgdb_icon_url=entry.sgdb_icon_url or "",
        metacritic_score=entry.metacritic_score,
        igdb_rating=entry.igdb_rating,
        release_date=entry.release_date or "",
        enrichment=EnrichmentSourceStatus(
            igdb=entry.igdb_status or "none",
            steam=entry.steam_status or "none",
            steamgrid=entry.steamgrid_status or "none",
            protondb=entry.protondb_status or "none",
            hltb=entry.hltb_status or "none",
        ),
        source=entry.source,
        is_available=entry.is_available,
        notes=entry.notes or "",
        client_id=entry.client_id,
        download_info_hash=entry.download_info_hash or "",
        download_status=entry.download_status,
        download_progress=entry.download_progress,
        date_added=entry.date_added,
        date_scanned=entry.date_scanned,
        date_updated=entry.date_updated,
        system_requirements=[
            LocalSystemRequirementOut(
                id=s.id, req_type=s.req_type, os=s.os, processor=s.processor,
                memory=s.memory, graphics=s.graphics, directx=s.directx,
                storage=s.storage, notes=s.notes,
            )
            for s in entry.system_requirements
        ],
        steam_genres=[
            LocalGenreOut(id=g.genre.id, name=g.genre.name, slug=g.genre.slug)
            for g in entry.steam_genres if g.genre
        ],
        igdb_genres=[
            LocalGenreOut(id=g.genre.id, name=g.genre.name, slug=g.genre.slug)
            for g in entry.igdb_genres if g.genre
        ],
        game=game_out,
    )


@router.get("/library/{entry_id}/files")
async def list_files(entry_id: int, sub_path: str = "", db: AsyncSession = Depends(get_db)):
    entry = await db.get(LocalLibraryEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Library entry not found")

    base = _secure_path(LIBRARY_PATH, entry.folder_path)
    target = _secure_path(base, sub_path)

    if not target.exists():
        raise HTTPException(status_code=404, detail="Path not found")

    if target.is_file():
        return [FileEntryOut(
            name=target.name,
            path=str(target.relative_to(LIBRARY_PATH)),
            size=target.stat().st_size,
            is_dir=False,
            modified=datetime.fromtimestamp(target.stat().st_mtime),
        )]

    items = []
    for child in sorted(target.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
        if child.name.startswith("."):
            continue
        try:
            stat = child.stat()
            items.append(FileEntryOut(
                name=child.name,
                path=str(child.relative_to(LIBRARY_PATH)),
                size=stat.st_size if child.is_file() else 0,
                is_dir=child.is_dir(),
                modified=datetime.fromtimestamp(stat.st_mtime),
            ))
        except OSError:
            pass

    return items


@router.get("/library/{entry_id}/download")
async def download_file(
    entry_id: int,
    file: str,
    db: AsyncSession = Depends(get_db),
):
    entry = await db.get(LocalLibraryEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Library entry not found")

    base = _secure_path(LIBRARY_PATH, entry.folder_path)
    target = _secure_path(base, file)

    if not target.exists() or target.is_dir():
        raise HTTPException(status_code=404, detail="File not found")

    media_type, _ = mimetypes.guess_type(str(target))
    return FileResponse(
        path=str(target),
        media_type=media_type or "application/octet-stream",
        filename=target.name,
    )


@router.post("/library/scan")
async def trigger_scan(db: AsyncSession = Depends(get_db)):
    lib_count = await scan_library_directory(db)
    dl_count = await scan_downloads_directory(db)
    return {"library_scanned": lib_count, "downloads_scanned": dl_count}


@router.put("/library/{entry_id}")
async def update_library_entry(
    entry_id: int,
    name: str | None = None,
    title: str | None = None,
    notes: str | None = None,
    format: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    entry = await db.get(LocalLibraryEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Library entry not found")

    if name is not None:
        entry.name = name
    if title is not None:
        entry.title = title
    if notes is not None:
        entry.notes = notes
    if format is not None:
        entry.format = format
    entry.date_updated = datetime.now(timezone.utc)
    await db.commit()
    return _entry_to_out(entry)


@router.delete("/library/{entry_id}")
async def delete_library_entry(entry_id: int, db: AsyncSession = Depends(get_db)):
    entry = await db.get(LocalLibraryEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Library entry not found")

    await db.delete(entry)
    await db.commit()
    return {"deleted": True}


@router.post("/library/{entry_id}/match")
async def match_library_entry(
    entry_id: int,
    game_id: int,
    db: AsyncSession = Depends(get_db),
):
    entry = await db.get(LocalLibraryEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Library entry not found")

    game = await db.get(Game, game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    entry.game_id = game.id
    entry.steam_app_id = game.steam_app_id
    entry.steam_name = game.steam_name or game.title
    entry.igdb_id = game.igdb_id
    entry.title = clean_title(game.title)
    entry.igdb_status = game.igdb_status
    entry.steam_status = game.steam_status
    entry.steamgrid_status = game.steamgrid_status
    entry.protondb_status = game.protondb_status
    entry.hltb_status = game.hltb_status
    entry.sgdb_grid_url = game.sgdb_grid_url or ""
    entry.sgdb_hero_url = game.sgdb_hero_url or ""
    entry.sgdb_logo_url = game.sgdb_logo_url or ""
    entry.sgdb_icon_url = game.sgdb_icon_url or ""
    entry.date_updated = datetime.now(timezone.utc)
    await db.commit()
    return _entry_to_out(entry)


@router.post("/library/{entry_id}/move")
async def move_entry_to_library(
    entry_id: int,
    target_name: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    entry = await db.get(LocalLibraryEntry, entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Library entry not found")

    try:
        updated = await move_to_library(db, entry, target_name)
        return _entry_to_out(updated)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.exception("Failed to move entry to library")
        raise HTTPException(status_code=500, detail=str(e))


def _entry_to_out(entry: LocalLibraryEntry) -> LocalLibraryEntryOut:
    return LocalLibraryEntryOut(
        id=entry.id,
        name=entry.name,
        title=entry.title,
        original_name=entry.original_name or "",
        folder_path=entry.folder_path,
        folder_size=entry.folder_size,
        file_count=entry.file_count,
        format=entry.format,
        game_id=entry.game_id,
        steam_app_id=entry.steam_app_id,
        steam_name=entry.steam_name or "",
        igdb_id=entry.igdb_id,
        description=entry.description or "",
        header_image=entry.header_image or "",
        capsule_image=entry.capsule_image or "",
        background_image=entry.background_image or "",
        sgdb_grid_url=entry.sgdb_grid_url or "",
        sgdb_hero_url=entry.sgdb_hero_url or "",
        sgdb_logo_url=entry.sgdb_logo_url or "",
        sgdb_icon_url=entry.sgdb_icon_url or "",
        metacritic_score=entry.metacritic_score,
        igdb_rating=entry.igdb_rating,
        release_date=entry.release_date or "",
        enrichment=EnrichmentSourceStatus(
            igdb=entry.igdb_status or "none",
            steam=entry.steam_status or "none",
            steamgrid=entry.steamgrid_status or "none",
            protondb=entry.protondb_status or "none",
            hltb=entry.hltb_status or "none",
        ),
        source=entry.source,
        is_available=entry.is_available,
        notes=entry.notes or "",
        client_id=entry.client_id,
        download_info_hash=entry.download_info_hash or "",
        download_status=entry.download_status,
        download_progress=entry.download_progress,
        date_added=entry.date_added,
        date_scanned=entry.date_scanned,
        date_updated=entry.date_updated,
    )
