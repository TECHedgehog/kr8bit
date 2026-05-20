"""
Download client abstraction layer.
Supports multiple client instances (qBittorrent, Transmission, Deluge, etc.)
Registry-based architecture for easy extensibility.
"""

from __future__ import annotations

import json
import logging
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Optional

from qbittorrentapi import Client as QBittorrentAPIClient
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import DownloadClient, Game, MagnetLink, QbitTorrentSync

logger = logging.getLogger(__name__)

# Per-client connection cache: {client_id: (client_instance, config_dict)}
_client_cache: dict[int, tuple] = {}


class DownloadClientBase(ABC):
    """Abstract base class for all download client implementations."""

    def __init__(self, client_id: int, host: str, username: str, password: str, extra_config: dict | None = None):
        self.client_id = client_id
        self.host = host.rstrip("/")
        self.username = username
        self.password = password
        self.extra_config = extra_config or {}

    @abstractmethod
    def test_connection(self) -> tuple[bool, str]:
        """Return (connected, error_message_or_empty)."""
        ...

    @abstractmethod
    def add_magnet(self, magnet_uri: str, save_path: str = "") -> bool:
        """Add a magnet URI to the client. Return success."""
        ...

    @abstractmethod
    def get_torrents(self) -> list[dict]:
        """Return list of torrent dicts."""
        ...

    @abstractmethod
    def get_transfer_info(self) -> dict:
        """Return transfer info dict."""
        ...

    def _normalize_torrent(self, raw: dict) -> dict:
        """Normalize a raw torrent dict to a common schema."""
        return raw


class QBittorrentClient(DownloadClientBase):
    """qBittorrent API client wrapper."""

    def test_connection(self) -> tuple[bool, str]:
        try:
            client = self._get_api_client()
            version = client.app_version()
            return bool(version), ""
        except Exception as e:
            logger.warning(f"qBit connection failed for client {self.client_id}: {e}")
            return False, str(e)

    def add_magnet(self, magnet_uri: str, save_path: str = "") -> bool:
        try:
            client = self._get_api_client()
            client.torrents_add(urls=magnet_uri, save_path=save_path or None)
            return True
        except Exception as e:
            logger.warning(f"qBit add_magnet failed for client {self.client_id}: {e}")
            return False

    def get_torrents(self) -> list[dict]:
        try:
            client = self._get_api_client()
            return client.torrents_info()
        except Exception:
            return []

    def get_transfer_info(self) -> dict:
        try:
            client = self._get_api_client()
            return client.transfer_info()
        except Exception:
            return {}

    def _get_api_client(self) -> QBittorrentAPIClient:
        """Get or create the qbittorrent-api client, caching per client_id."""
        global _client_cache
        cached = _client_cache.get(self.client_id)
        if cached is not None:
            api_client, cached_config = cached
            current_config = {
                "host": self.host,
                "username": self.username,
                "password": self.password,
            }
            if cached_config == current_config:
                # Ensure still logged in
                try:
                    api_client.auth_log_in()
                except Exception:
                    pass
                return api_client
            # Config changed, invalidate cache
            _client_cache.pop(self.client_id, None)

        api_client = QBittorrentAPIClient(
            host=self.host,
            username=self.username,
            password=self.password,
            VERIFY_WEBUI_CERTIFICATE=False,
        )
        api_client.auth_log_in()
        _client_cache[self.client_id] = (
            api_client,
            {
                "host": self.host,
                "username": self.username,
                "password": self.password,
            },
        )
        return api_client


# Registry mapping client_type string to implementation class
CLIENT_REGISTRY: dict[str, type[DownloadClientBase]] = {
    "qbittorrent": QBittorrentClient,
    # "transmission": TransmissionClient,  # Future
    # "deluge": DelugeClient,              # Future
}


def _build_instance(row: DownloadClient) -> DownloadClientBase:
    """Instantiate the correct client class from a DownloadClient DB row."""
    cls = CLIENT_REGISTRY.get(row.client_type)
    if cls is None:
        raise ValueError(f"Unknown download client type: {row.client_type}")
    extra = {}
    if row.extra_config:
        try:
            extra = json.loads(row.extra_config)
        except json.JSONDecodeError:
            pass
    return cls(
        client_id=row.id,
        host=row.host,
        username=row.username,
        password=row.password,
        extra_config=extra,
    )


async def get_client_instance(client_id: int, db: AsyncSession) -> DownloadClientBase:
    """Get a client implementation instance by ID."""
    result = await db.execute(select(DownloadClient).where(DownloadClient.id == client_id))
    row = result.scalar_one_or_none()
    if row is None:
        raise ValueError(f"Download client {client_id} not found")
    if not row.is_enabled:
        raise ValueError(f"Download client {client_id} is disabled")
    return _build_instance(row)


async def get_default_client_instance(db: AsyncSession) -> DownloadClientBase | None:
    """Get the default enabled client instance, or None."""
    result = await db.execute(
        select(DownloadClient)
        .where(DownloadClient.is_enabled == True)
        .where(DownloadClient.is_default == True)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return None
    return _build_instance(row)


async def get_all_enabled_client_instances(db: AsyncSession) -> list[DownloadClientBase]:
    """Get all enabled client instances."""
    result = await db.execute(
        select(DownloadClient).where(DownloadClient.is_enabled == True)
    )
    rows = result.scalars().all()
    return [_build_instance(r) for r in rows]


async def get_all_clients(db: AsyncSession) -> list[DownloadClient]:
    """Return all download client rows ordered by name."""
    result = await db.execute(select(DownloadClient).order_by(DownloadClient.name))
    return list(result.scalars().all())


async def get_client_row(db: AsyncSession, client_id: int) -> DownloadClient | None:
    result = await db.execute(select(DownloadClient).where(DownloadClient.id == client_id))
    return result.scalar_one_or_none()


async def test_client_connection(db: AsyncSession, client_id: int) -> tuple[bool, str]:
    """Test connection for a specific saved client."""
    try:
        instance = await get_client_instance(client_id, db)
        return instance.test_connection()
    except Exception as e:
        return False, str(e)


def test_connection_raw(
    client_type: str, host: str, username: str, password: str
) -> tuple[bool, str]:
    """Test connection with raw parameters (no DB required). Used for test-before-save."""
    cls = CLIENT_REGISTRY.get(client_type)
    if cls is None:
        return False, f"Unknown download client type: {client_type}"
    try:
        instance = cls(
            client_id=-1,
            host=host,
            username=username,
            password=password,
            extra_config={},
        )
        return instance.test_connection()
    except Exception as e:
        return False, str(e)


async def add_magnet_to_client(
    db: AsyncSession, client_id: int, magnet_uri: str, save_path: str = ""
) -> bool:
    """Add a magnet to a specific client."""
    instance = await get_client_instance(client_id, db)
    return instance.add_magnet(magnet_uri, save_path)


async def get_client_status(db: AsyncSession, client_id: int) -> dict:
    """Get status dict for a single client."""
    row = await get_client_row(db, client_id)
    if row is None:
        return {"client_id": client_id, "connected": False, "error": "Not found"}

    connected, error = await test_client_connection(db, client_id)
    if not connected:
        return {
            "client_id": client_id,
            "name": row.name,
            "client_type": row.client_type,
            "connected": False,
            "torrent_count": 0,
            "active_count": 0,
            "paused_count": 0,
            "completed_count": 0,
            "downloading_speed": 0.0,
            "uploading_speed": 0.0,
            "error": error,
        }

    try:
        instance = await get_client_instance(client_id, db)
        torrents = instance.get_torrents()
        transfer = instance.get_transfer_info()
    except Exception as e:
        return {
            "client_id": client_id,
            "name": row.name,
            "client_type": row.client_type,
            "connected": False,
            "torrent_count": 0,
            "active_count": 0,
            "paused_count": 0,
            "completed_count": 0,
            "downloading_speed": 0.0,
            "uploading_speed": 0.0,
            "error": str(e),
        }

    total = len(torrents)
    active = sum(
        1
        for t in torrents
        if t.get("state") in ("downloading", "uploading", "stalledDL", "stalledUP")
    )
    paused = sum(1 for t in torrents if t.get("state") == "pausedDL")
    completed = sum(1 for t in torrents if t.get("progress", 0) >= 1)

    return {
        "client_id": client_id,
        "name": row.name,
        "client_type": row.client_type,
        "connected": True,
        "torrent_count": total,
        "active_count": active,
        "paused_count": paused,
        "completed_count": completed,
        "downloading_speed": float(transfer.get("dl_info_speed", 0)),
        "uploading_speed": float(transfer.get("up_info_speed", 0)),
        "error": None,
    }


async def get_aggregate_status(db: AsyncSession) -> dict:
    """Get aggregate status across all enabled clients."""
    clients = []
    total_torrents = 0
    total_active = 0
    total_dl_speed = 0.0
    total_ul_speed = 0.0

    rows = await get_all_clients(db)
    for row in rows:
        if not row.is_enabled:
            continue
        status = await get_client_status(db, row.id)
        clients.append(status)
        if status["connected"]:
            total_torrents += status["torrent_count"]
            total_active += status["active_count"]
            total_dl_speed += status["downloading_speed"]
            total_ul_speed += status["uploading_speed"]

    return {
        "clients": clients,
        "total_torrent_count": total_torrents,
        "total_active_count": total_active,
        "total_downloading_speed": total_dl_speed,
        "total_uploading_speed": total_ul_speed,
    }


async def sync_client_torrents_with_db(db: AsyncSession, client_id: int) -> int:
    """Sync torrents from a specific client into the DB."""
    try:
        instance = await get_client_instance(client_id, db)
        torrents = instance.get_torrents()
    except Exception:
        return 0

    updated = 0
    for t in torrents:
        info_hash = t.get("hash", "").upper()
        if not info_hash:
            continue

        existing = await db.execute(
            select(QbitTorrentSync).where(
                QbitTorrentSync.client_id == client_id,
                QbitTorrentSync.info_hash == info_hash,
            )
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
                client_id=client_id,
                game_id=game_id or 0,
                info_hash=info_hash,
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
    result = await db.execute(
        select(MagnetLink.game_id).where(MagnetLink.info_hash == info_hash).limit(1)
    )
    row = result.scalar_one_or_none()
    return row


async def get_sync_summary(db: AsyncSession) -> dict:
    """Get aggregate sync summary across all clients."""
    total = (await db.execute(select(func.count(QbitTorrentSync.id)))).scalar() or 0
    active = (
        await db.execute(
            select(func.count(QbitTorrentSync.id)).where(
                QbitTorrentSync.progress > 0, QbitTorrentSync.progress < 100
            )
        )
    ).scalar() or 0
    completed = (
        await db.execute(
            select(func.count(QbitTorrentSync.id)).where(QbitTorrentSync.progress >= 100)
        )
    ).scalar() or 0
    matched = (
        await db.execute(
            select(func.count(QbitTorrentSync.id)).where(QbitTorrentSync.game_id > 0)
        )
    ).scalar() or 0

    return {
        "total": total,
        "active": active,
        "completed": completed,
        "matched_to_games": matched,
    }


# Backward-compat helpers (used by old /api/qbittorrent/* endpoints)

async def _get_default_client_id(db: AsyncSession) -> int | None:
    """Return the ID of the default enabled client, or None."""
    result = await db.execute(
        select(DownloadClient.id)
        .where(DownloadClient.is_enabled == True)
        .where(DownloadClient.is_default == True)
    )
    row = result.scalar_one_or_none()
    if row is None:
        # Fallback: first enabled client
        result = await db.execute(
            select(DownloadClient.id)
            .where(DownloadClient.is_enabled == True)
            .limit(1)
        )
        row = result.scalar_one_or_none()
    return row


async def check_connection_compat(db: AsyncSession) -> tuple[bool, str]:
    """Backward-compat: test the default client."""
    cid = await _get_default_client_id(db)
    if cid is None:
        return False, "No download clients configured"
    return await test_client_connection(db, cid)


async def add_magnet_compat(
    db: AsyncSession, magnet_uri: str, save_path: str = ""
) -> bool:
    """Backward-compat: add magnet to default client."""
    cid = await _get_default_client_id(db)
    if cid is None:
        return False
    return await add_magnet_to_client(db, cid, magnet_uri, save_path)


async def get_torrents_compat(db: AsyncSession) -> list[dict]:
    """Backward-compat: get torrents from default client."""
    cid = await _get_default_client_id(db)
    if cid is None:
        return []
    instance = await get_client_instance(cid, db)
    return instance.get_torrents()


async def get_transfer_info_compat(db: AsyncSession) -> dict:
    """Backward-compat: get transfer info from default client."""
    cid = await _get_default_client_id(db)
    if cid is None:
        return {}
    instance = await get_client_instance(cid, db)
    return instance.get_transfer_info()
