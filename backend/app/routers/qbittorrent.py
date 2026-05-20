from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.download_client import (
    check_connection_compat,
    add_magnet_compat,
    get_torrents_compat,
    get_transfer_info_compat,
    get_sync_summary,
)

router = APIRouter()


@router.get("/qbittorrent/status")
async def qbit_status(db: AsyncSession = Depends(get_db)):
    """Backward-compat: returns status of the default download client."""
    connected, _ = await check_connection_compat(db)
    if not connected:
        return {
            "connected": False,
            "torrent_count": 0,
            "active_count": 0,
            "paused_count": 0,
            "completed_count": 0,
            "downloading_speed": 0,
            "uploading_speed": 0,
        }

    torrents = await get_torrents_compat(db)
    transfer = await get_transfer_info_compat(db)

    total = len(torrents)
    active = sum(
        1
        for t in torrents
        if t.get("state") in ("downloading", "uploading", "stalledDL", "stalledUP")
    )
    paused = sum(1 for t in torrents if t.get("state") == "pausedDL")
    completed = sum(1 for t in torrents if t.get("progress", 0) >= 1)

    return {
        "connected": True,
        "torrent_count": total,
        "active_count": active,
        "paused_count": paused,
        "completed_count": completed,
        "downloading_speed": transfer.get("dl_info_speed", 0),
        "uploading_speed": transfer.get("up_info_speed", 0),
    }


@router.get("/qbittorrent/torrents")
async def list_qbit_torrents(db: AsyncSession = Depends(get_db)):
    """Backward-compat: returns torrents from the default download client."""
    connected, _ = await check_connection_compat(db)
    if not connected:
        raise HTTPException(status_code=503, detail="qBittorrent not connected")
    torrents = await get_torrents_compat(db)
    return torrents


@router.post("/qbittorrent/add")
async def add_to_qbit(
    magnet_uri: str = Query(...),
    save_path: str = Query("", max_length=500),
    db: AsyncSession = Depends(get_db),
):
    """Backward-compat: adds magnet to the default download client."""
    if not magnet_uri.startswith("magnet:"):
        raise HTTPException(status_code=400, detail="Invalid magnet URI")
    connected, _ = await check_connection_compat(db)
    if not connected:
        raise HTTPException(status_code=503, detail="qBittorrent not connected")
    result = await add_magnet_compat(db, magnet_uri, save_path)
    return {"status": "added", "result": result}


@router.get("/qbittorrent/sync")
async def qbit_sync_status(db: AsyncSession = Depends(get_db)):
    """Backward-compat: returns sync summary across all clients."""
    summary = await get_sync_summary(db)
    return summary
