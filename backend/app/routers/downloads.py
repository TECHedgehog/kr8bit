"""
Downloads router: aggregate active downloads from all enabled download clients.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import DownloadClient, Game, MagnetLink, LocalLibraryEntry
from app.schemas import DownloadListResponse, DownloadItemOut
from app.services.download_client import get_all_enabled_client_instances

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/downloads", response_model=DownloadListResponse)
async def list_downloads(db: AsyncSession = Depends(get_db)):
    """List all active torrents from all enabled download clients."""
    items = []
    total_dl_speed = 0.0
    total_ul_speed = 0.0
    active_count = 0
    completed_count = 0

    try:
        clients = await get_all_enabled_client_instances(db)
    except Exception:
        clients = []

    for client in clients:
        try:
            torrents = client.get_torrents()
        except Exception:
            continue

        for t in torrents:
            progress = t.get("progress", 0.0)
            if isinstance(progress, str):
                try:
                    progress = float(progress)
                except ValueError:
                    progress = 0.0
            # qBit returns 0-1
            if progress <= 1.0:
                progress = progress * 100

            state = t.get("state", "unknown")
            size = t.get("size", 0)
            dlspeed = t.get("dlspeed", 0)
            upspeed = t.get("upspeed", 0)
            eta = t.get("eta", 0)
            info_hash = t.get("hash", "").upper()
            name = t.get("name", "")

            if state in ("downloading", "stalledDL", "metaDL", "allocating"):
                active_count += 1
            elif state in ("uploading", "stalledUP") and progress >= 100:
                completed_count += 1

            total_dl_speed += float(dlspeed)
            total_ul_speed += float(upspeed)

            # Try to find linked game
            game_id = None
            if info_hash:
                magnet = await db.execute(
                    select(MagnetLink.game_id).where(MagnetLink.info_hash == info_hash).limit(1)
                )
                row = magnet.scalar_one_or_none()
                if row:
                    game_id = row

            items.append(DownloadItemOut(
                info_hash=info_hash,
                torrent_name=name,
                status=state,
                progress=progress,
                size=size,
                dlspeed=dlspeed,
                upspeed=upspeed,
                eta=eta,
                client_id=client.client_id,
                client_name=client.host,  # We don't have name here easily, use host
                game_id=game_id,
            ))

    # Also include library entries that are downloading
    result = await db.execute(
        select(LocalLibraryEntry).where(LocalLibraryEntry.download_status == "downloading")
    )
    for entry in result.scalars().all():
        # Skip if already in torrent list
        if any(i.info_hash == entry.download_info_hash for i in items):
            continue
        items.append(DownloadItemOut(
            info_hash=entry.download_info_hash or "",
            torrent_name=entry.name,
            status=entry.download_status,
            progress=entry.download_progress * 100,
            size=entry.folder_size,
            dlspeed=0,
            upspeed=0,
            eta=0,
            client_id=entry.client_id,
            client_name="",
            game_id=entry.game_id,
        ))

    return DownloadListResponse(
        items=items,
        total=len(items),
        active_count=active_count,
        completed_count=completed_count,
        total_dl_speed=total_dl_speed,
        total_ul_speed=total_ul_speed,
    )
