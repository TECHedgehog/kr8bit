"""
User library router: per-user library management, smart add from catalog.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models import (
    Game, LocalLibraryEntry, UserLibraryEntry, User, MagnetLink,
)
from app.schemas import (
    UserLibraryListResponse, UserLibraryEntryOut, LocalLibraryEntryOut,
    SmartAddRequest, EnrichmentSourceStatus,
)
from app.services.library_scanner import (
    _upsert_local_entry, _link_to_default_user, move_to_library,
    clean_title, DOWNLOADS_PATH,
)
from app.services.download_client import add_magnet_to_client, get_default_client_instance

logger = logging.getLogger(__name__)
router = APIRouter()

DEFAULT_USER_ID = 1


def _local_out(entry: LocalLibraryEntry) -> LocalLibraryEntryOut:
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


@router.get("/user/library", response_model=UserLibraryListResponse)
async def list_user_library(
    page: int = 1,
    per_page: int = 48,
    search: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(UserLibraryEntry)
        .options(selectinload(UserLibraryEntry.library_entry))
        .where(UserLibraryEntry.user_id == DEFAULT_USER_ID)
    )

    if search:
        like = f"%{search}%"
        query = query.join(LocalLibraryEntry).where(
            or_(
                LocalLibraryEntry.name.ilike(like),
                LocalLibraryEntry.title.ilike(like),
                LocalLibraryEntry.steam_name.ilike(like),
            )
        )

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0

    query = query.order_by(UserLibraryEntry.date_added.desc()).offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(query)
    items = result.scalars().all()

    return UserLibraryListResponse(
        items=[
            UserLibraryEntryOut(
                id=item.id,
                user_id=item.user_id,
                library_entry_id=item.library_entry_id,
                date_added=item.date_added,
                library_entry=_local_out(item.library_entry) if item.library_entry else None,
            )
            for item in items
        ],
        total=total,
        page=page,
        per_page=per_page,
        total_pages=max(1, (total + per_page - 1) // per_page),
    )


@router.post("/user/library/add")
async def add_to_user_library(
    library_entry_id: int,
    db: AsyncSession = Depends(get_db),
):
    entry = await db.get(LocalLibraryEntry, library_entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Library entry not found")

    existing = await db.execute(
        select(UserLibraryEntry).where(
            UserLibraryEntry.user_id == DEFAULT_USER_ID,
            UserLibraryEntry.library_entry_id == library_entry_id,
        ).limit(1)
    )
    if existing.scalar_one_or_none():
        return {"message": "Already in library"}

    db.add(UserLibraryEntry(user_id=DEFAULT_USER_ID, library_entry_id=library_entry_id))
    await db.commit()
    return {"message": "Added to library"}


@router.post("/user/library/add-from-catalog")
async def smart_add_from_catalog(
    request: SmartAddRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Smart add from FitGirl catalog:
    1. Check if game already exists in local_library (by game_id)
    2. If yes, just add to user's library
    3. If no, check if there's a torrent downloading for this game
    4. If no torrent, send magnet to download client and create tracking entry
    """
    game = await db.get(Game, request.game_id)
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    # 1. Check if already in local library
    result = await db.execute(
        select(LocalLibraryEntry).where(LocalLibraryEntry.game_id == request.game_id).limit(1)
    )
    existing = result.scalar_one_or_none()
    if existing:
        # Add to user library if not already there
        ul = await db.execute(
            select(UserLibraryEntry).where(
                UserLibraryEntry.user_id == DEFAULT_USER_ID,
                UserLibraryEntry.library_entry_id == existing.id,
            ).limit(1)
        )
        if not ul.scalar_one_or_none():
            db.add(UserLibraryEntry(user_id=DEFAULT_USER_ID, library_entry_id=existing.id))
            await db.commit()
        return {
            "message": "Game is already available in your library",
            "library_entry_id": existing.id,
            "action": "linked",
        }

    # 2. Check if there's a torrent already downloading for this game
    result = await db.execute(
        select(LocalLibraryEntry).where(
            LocalLibraryEntry.download_info_hash.isnot(None),
            LocalLibraryEntry.game_id == request.game_id,
            LocalLibraryEntry.download_status.in_(["downloading", "stalled"]),
        ).limit(1)
    )
    downloading = result.scalar_one_or_none()
    if downloading:
        ul = await db.execute(
            select(UserLibraryEntry).where(
                UserLibraryEntry.user_id == DEFAULT_USER_ID,
                UserLibraryEntry.library_entry_id == downloading.id,
            ).limit(1)
        )
        if not ul.scalar_one_or_none():
            db.add(UserLibraryEntry(user_id=DEFAULT_USER_ID, library_entry_id=downloading.id))
            await db.commit()
        return {
            "message": "Download already in progress",
            "library_entry_id": downloading.id,
            "action": "linked_downloading",
        }

    # 3. Get magnet and send to download client
    magnet_result = await db.execute(
        select(MagnetLink).where(MagnetLink.game_id == request.game_id).limit(1)
    )
    magnet = magnet_result.scalar_one_or_none()
    if not magnet:
        raise HTTPException(status_code=400, detail="No magnet link available for this game")

    # Determine client
    client_id = request.client_id
    if not client_id:
        default_client = await get_default_client_instance(db)
        if not default_client:
            raise HTTPException(status_code=400, detail="No download client configured")
        client_id = default_client.client_id

    # Send magnet
    success = await add_magnet_to_client(db, client_id, magnet.magnet_uri, save_path="/downloads/torrents/games")
    if not success:
        raise HTTPException(status_code=500, detail="Failed to add magnet to download client")

    # Create tracking entry
    title_clean = clean_title(game.title)
    entry = await _upsert_local_entry(
        db=db,
        folder_path=f"_pending_{game.id}_{magnet.info_hash[:8]}",
        name=game.title,
        title_clean=title_clean,
        folder_size=0,
        file_count=0,
        fmt="unknown",
        game_id=game.id,
        steam_app_id=game.steam_app_id,
        steam_name=game.steam_name or game.title,
        is_available=False,
        source="fitgirl",
        download_status="downloading",
        download_progress=0.0,
        client_id=client_id,
        download_info_hash=magnet.info_hash,
    )
    await _link_to_default_user(db, entry)
    await db.commit()

    return {
        "message": "Download started and added to your library",
        "library_entry_id": entry.id,
        "action": "downloading",
    }


@router.delete("/user/library/{user_entry_id}")
async def remove_from_user_library(user_entry_id: int, db: AsyncSession = Depends(get_db)):
    entry = await db.get(UserLibraryEntry, user_entry_id)
    if not entry or entry.user_id != DEFAULT_USER_ID:
        raise HTTPException(status_code=404, detail="Entry not found")

    await db.delete(entry)
    await db.commit()
    return {"deleted": True}
