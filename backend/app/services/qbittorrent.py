from datetime import datetime, timezone
from typing import Optional
import logging

from qbittorrentapi import Client as QBittorrentClient
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import Game, QbitTorrentSync, Setting

logger = logging.getLogger(__name__)

_client: Optional[QBittorrentClient] = None
_client_config: Optional[dict] = None


async def _get_setting(db: AsyncSession | None, key: str) -> str:
    if db:
        try:
            result = await db.execute(select(Setting).where(Setting.key == key))
            s = result.scalar_one_or_none()
            if s and s.value:
                return s.value
        except Exception:
            pass
    return ""


async def _get_qbit_config(db: AsyncSession | None = None) -> dict:
    host = await _get_setting(db, "qbittorrent_host") or settings.qbittorrent_host
    user = await _get_setting(db, "qbittorrent_user") or settings.qbittorrent_user
    password = await _get_setting(db, "qbittorrent_pass") or settings.qbittorrent_pass
    return {"host": host, "user": user, "password": password}


def _get_client(config: dict) -> QBittorrentClient:
    global _client, _client_config
    if _client is None or _client_config != config:
        _client = QBittorrentClient(
            host=config["host"],
            username=config["user"],
            password=config["password"],
        )
        _client.auth_log_in()
        _client_config = config.copy()
    return _client


def _reset_client():
    global _client, _client_config
    _client = None
    _client_config = None


async def check_connection(db: AsyncSession | None = None) -> tuple[bool, str]:
    _reset_client()
    try:
        config = await _get_qbit_config(db)
        logger.info(f"qBit test connecting to: {config['host']} user: {config['user']}")
        c = _get_client(config)
        version = c.app_version()
        return bool(version), ""
    except Exception as e:
        logger.warning(f"qBit connection failed: {e}")
        _reset_client()
        return False, str(e)


async def get_torrents(db: AsyncSession | None = None) -> list[dict]:
    try:
        config = await _get_qbit_config(db)
        c = _get_client(config)
        return c.torrents_info()
    except Exception:
        return []


async def get_transfer_info(db: AsyncSession | None = None) -> dict:
    try:
        config = await _get_qbit_config(db)
        c = _get_client(config)
        return c.transfer_info()
    except Exception:
        return {}


async def add_magnet(magnet_uri: str, save_path: str = "", db: AsyncSession | None = None) -> bool:
    try:
        config = await _get_qbit_config(db)
        c = _get_client(config)
        c.torrents_add(urls=magnet_uri, save_path=save_path or None)
        return True
    except Exception:
        return False


async def sync_torrents_with_db(db: AsyncSession) -> int:
    try:
        torrents = await get_torrents(db)
    except Exception:
        return 0

    updated = 0
    for t in torrents:
        info_hash = t.get("hash", "").upper()
        if not info_hash:
            continue

        existing = await db.execute(
            select(QbitTorrentSync).where(QbitTorrentSync.info_hash == info_hash)
        )
        qbt = existing.scalar_one_or_none()

        if qbt:
            qbt.status = t.get("state", "unknown")
            qbt.progress = t.get("progress", 0.0) * 100
            qbt.size = t.get("size", 0)
            qbt.dlspeed = t.get("dlspeed", 0)
            qbt.upspeed = t.get("upspeed", 0)
            qbt.eta = t.get("eta", 0)
            qbt.updated_at = datetime.now(timezone.utc)
        else:
            game_id = await _find_game_for_hash(db, info_hash)
            qbt = QbitTorrentSync(
                info_hash=info_hash,
                game_id=game_id or 0,
                torrent_name=t.get("name", ""),
                status=t.get("state", "unknown"),
                progress=t.get("progress", 0.0) * 100,
                size=t.get("size", 0),
                dlspeed=t.get("dlspeed", 0),
                upspeed=t.get("upspeed", 0),
                eta=t.get("eta", 0),
                added_at=datetime.now(timezone.utc),
            )
            db.add(qbt)
        updated += 1

    await db.commit()
    return updated


async def _find_game_for_hash(db: AsyncSession, info_hash: str) -> Optional[int]:
    from app.models import MagnetLink
    result = await db.execute(
        select(MagnetLink.game_id).where(MagnetLink.info_hash == info_hash).limit(1)
    )
    row = result.scalar_one_or_none()
    return row


async def get_sync_summary(db: AsyncSession) -> dict:
    total = (await db.execute(select(func.count(QbitTorrentSync.id)))).scalar() or 0
    active = (await db.execute(
        select(func.count(QbitTorrentSync.id))
        .where(QbitTorrentSync.progress > 0, QbitTorrentSync.progress < 100)
    )).scalar() or 0
    completed = (await db.execute(
        select(func.count(QbitTorrentSync.id)).where(QbitTorrentSync.progress >= 100)
    )).scalar() or 0

    matched = (await db.execute(
        select(func.count(QbitTorrentSync.id)).where(QbitTorrentSync.game_id > 0)
    )).scalar() or 0

    return {
        "total": total,
        "active": active,
        "completed": completed,
        "matched_to_games": matched,
    }