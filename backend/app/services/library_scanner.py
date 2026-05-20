"""
Library scanner service.
Scans library and download directories, detects games, manages sidecar metadata.
"""

from __future__ import annotations

import json
import logging
import os
import shutil
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import (
    Game, LocalLibraryEntry, UserLibraryEntry, User, DownloadClient,
    SteamGenre, IgdbGenre, LocalSteamGenre, LocalIgdbGenre,
)
from app.services.title_matcher import clean_title
from app.services.download_client import get_all_enabled_client_instances

logger = logging.getLogger(__name__)

LIBRARY_PATH = Path(settings.library_path)
DOWNLOADS_PATH = Path(settings.downloads_path)
FGMETA_FILENAME = ".fgmeta.json"

_ARCHIVE_EXTS = {
    ".zip", ".7z", ".rar", ".iso", ".tar", ".gz", ".bz2",
    ".xz", ".wim", ".cab", ".dmg", ".ext", ".hfs",
}
_INSTALLER_EXTS = {".exe", ".msi", ".sh", ".appimage"}


def _is_archive(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in _ARCHIVE_EXTS


def _is_installer(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() in _INSTALLER_EXTS


def detect_format(entry_path: Path) -> str:
    """Detect if entry is installer, installed game, archive, or unknown."""
    if entry_path.is_file():
        if _is_archive(entry_path):
            return "archive"
        if _is_installer(entry_path):
            return "installer"
        return "unknown"

    # Directory: look at contents
    has_installer = False
    has_game_exe = False
    has_archive = False
    total_files = 0

    for root, _dirs, files in os.walk(entry_path):
        for f in files:
            total_files += 1
            fp = Path(root) / f
            if _is_installer(fp):
                has_installer = True
            if _is_archive(fp):
                has_archive = True
            # Simple heuristic for game executable
            if fp.suffix.lower() == ".exe":
                name_lower = fp.name.lower()
                if any(
                    x in name_lower
                    for x in ("setup", "install", "launcher", "start")
                ):
                    has_installer = True
                else:
                    has_game_exe = True

    if has_installer and not has_game_exe:
        return "installer"
    if has_game_exe and not has_installer:
        return "installed"
    if has_archive and total_files <= 3:
        return "archive"
    if has_game_exe:
        return "installed"
    if has_installer:
        return "installer"
    return "unknown"


def get_folder_size(path: Path) -> int:
    """Recursively calculate total size in bytes."""
    total = 0
    if path.is_file():
        return path.stat().st_size
    for root, _dirs, files in os.walk(path):
        for f in files:
            try:
                total += (Path(root) / f).stat().st_size
            except OSError:
                pass
    return total


def get_file_count(path: Path) -> int:
    """Count files recursively."""
    if path.is_file():
        return 1
    count = 0
    for root, _dirs, files in os.walk(path):
        count += len(files)
    return count


def read_fgmeta(entry_path: Path) -> dict | None:
    """Read .fgmeta.json sidecar if it exists."""
    meta_path = entry_path / FGMETA_FILENAME if entry_path.is_dir() else entry_path.parent / FGMETA_FILENAME
    try:
        if meta_path.exists():
            with open(meta_path, "r", encoding="utf-8") as f:
                return json.load(f)
    except (json.JSONDecodeError, OSError) as e:
        logger.warning(f"Failed to read {meta_path}: {e}")
    return None


def write_fgmeta(library_path: Path, data: dict) -> None:
    """Write .fgmeta.json sidecar to library folder."""
    meta_path = library_path / FGMETA_FILENAME
    try:
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except OSError as e:
        logger.warning(f"Failed to write {meta_path}: {e}")


def normalize_folder_name(title: str, steam_app_id: int | None = None, igdb_id: int | None = None) -> str:
    """Create normalized folder name from metadata."""
    if steam_app_id:
        return f"{title} [{steam_app_id}]"
    if igdb_id:
        return f"{title} [IGDB_{igdb_id}]"
    return title


def parse_folder_name(name: str) -> tuple[str, int | None, int | None]:
    """Parse normalized folder name to extract title and IDs."""
    # Check for [steam_app_id] pattern
    m = __import__("re").search(r"\[(\d+)\]$", name)
    if m:
        return name[:m.start()].strip(), int(m.group(1)), None
    # Check for [IGDB_xxx] pattern
    m = __import__("re").search(r"\[IGDB_(\d+)\]$", name)
    if m:
        return name[:m.start()].strip(), None, int(m.group(1))
    return name, None, None


async def _match_fitgirl_game(db: AsyncSession, title_clean: str) -> Game | None:
    """Fuzzy match a cleaned title against FitGirl games."""
    from thefuzz import fuzz

    # First try exact-ish match on title_clean
    result = await db.execute(
        select(Game).where(func.lower(Game.title_clean) == func.lower(title_clean)).limit(1)
    )
    game = result.scalar_one_or_none()
    if game:
        return game

    # Try LIKE on title_clean
    like = f"%{title_clean}%"
    result = await db.execute(
        select(Game).where(Game.title_clean.ilike(like)).limit(5)
    )
    candidates = result.scalars().all()
    if candidates:
        best = max(candidates, key=lambda g: fuzz.ratio(title_clean.lower(), (g.title_clean or "").lower()))
        if fuzz.ratio(title_clean.lower(), (best.title_clean or "").lower()) >= 70:
            return best

    # Fallback: search on title
    result = await db.execute(
        select(Game).where(Game.title.ilike(like)).limit(5)
    )
    candidates = result.scalars().all()
    if candidates:
        best = max(candidates, key=lambda g: fuzz.ratio(title_clean.lower(), (g.title or "").lower()))
        if fuzz.ratio(title_clean.lower(), (best.title or "").lower()) >= 70:
            return best

    return None


async def _upsert_local_entry(
    db: AsyncSession,
    folder_path: str,
    name: str,
    title_clean: str,
    folder_size: int,
    file_count: int,
    fmt: str,
    game_id: int | None = None,
    steam_app_id: int | None = None,
    steam_name: str = "",
    is_available: bool = True,
    source: str = "scanner",
    download_status: str = "complete",
    download_progress: float = 1.0,
    client_id: int | None = None,
    download_info_hash: str = "",
) -> LocalLibraryEntry:
    """Upsert a local library entry by folder_path."""
    result = await db.execute(
        select(LocalLibraryEntry).where(LocalLibraryEntry.folder_path == folder_path).limit(1)
    )
    entry = result.scalar_one_or_none()

    if entry:
        entry.name = name
        entry.title = title_clean
        entry.folder_size = folder_size
        entry.file_count = file_count
        entry.format = fmt
        entry.is_available = is_available
        entry.date_scanned = datetime.now(timezone.utc)
        if game_id is not None:
            entry.game_id = game_id
        if steam_app_id is not None:
            entry.steam_app_id = steam_app_id
            entry.steam_name = steam_name
        if download_status:
            entry.download_status = download_status
        entry.download_progress = download_progress
        if client_id is not None:
            entry.client_id = client_id
        if download_info_hash:
            entry.download_info_hash = download_info_hash
    else:
        entry = LocalLibraryEntry(
            name=name,
            title=title_clean,
            original_name=name,
            folder_path=folder_path,
            folder_size=folder_size,
            file_count=file_count,
            format=fmt,
            game_id=game_id,
            steam_app_id=steam_app_id,
            steam_name=steam_name,
            is_available=is_available,
            source=source,
            download_status=download_status,
            download_progress=download_progress,
            client_id=client_id,
            download_info_hash=download_info_hash,
        )
        db.add(entry)
        # Need to flush to get the ID for user library link
        await db.flush()

    return entry


async def _link_to_default_user(db: AsyncSession, entry: LocalLibraryEntry) -> None:
    """Link a local library entry to the default user if not already linked."""
    result = await db.execute(
        select(UserLibraryEntry).where(
            UserLibraryEntry.library_entry_id == entry.id,
            UserLibraryEntry.user_id == 1,
        ).limit(1)
    )
    if result.scalar_one_or_none() is None:
        db.add(UserLibraryEntry(user_id=1, library_entry_id=entry.id))


async def scan_library_directory(db: AsyncSession) -> int:
    """Scan the library directory and upsert entries. Returns count of entries processed."""
    if not LIBRARY_PATH.exists():
        logger.warning(f"Library path does not exist: {LIBRARY_PATH}")
        return 0

    count = 0
    seen_paths = set()

    for item in LIBRARY_PATH.iterdir():
        if item.name.startswith("."):
            continue

        folder_path = str(item.relative_to(LIBRARY_PATH))
        seen_paths.add(folder_path)

        # Read sidecar if present
        fgmeta = read_fgmeta(item)

        if fgmeta:
            title = fgmeta.get("normalized_name", item.name)
            steam_app_id = fgmeta.get("steam_app_id")
            igdb_id = fgmeta.get("igdb_id")
            game_id = fgmeta.get("fitgirl_game_id")
        else:
            title, steam_app_id, igdb_id = parse_folder_name(item.name)
            game_id = None

        title_clean = clean_title(title)
        folder_size = get_folder_size(item)
        file_count = get_file_count(item)
        fmt = detect_format(item)

        # Try to match FitGirl game if not already known
        if not game_id:
            matched_game = await _match_fitgirl_game(db, title_clean)
            if matched_game:
                game_id = matched_game.id
                if not steam_app_id:
                    steam_app_id = matched_game.steam_app_id
                if not igdb_id:
                    igdb_id = matched_game.igdb_id

        entry = await _upsert_local_entry(
            db=db,
            folder_path=folder_path,
            name=item.name,
            title_clean=title_clean,
            folder_size=folder_size,
            file_count=file_count,
            fmt=fmt,
            game_id=game_id,
            steam_app_id=steam_app_id,
            steam_name=title_clean,
            is_available=True,
            source="scanner",
        )

        # If sidecar has fitgirl_game_id, ensure user link exists
        if fgmeta and fgmeta.get("fitgirl_game_id"):
            await _link_to_default_user(db, entry)

        count += 1

    # Mark entries whose paths no longer exist as unavailable
    if seen_paths:
        result = await db.execute(select(LocalLibraryEntry).where(LocalLibraryEntry.is_available == True))
        for entry in result.scalars().all():
            if entry.folder_path not in seen_paths:
                entry.is_available = False
                entry.date_scanned = datetime.now(timezone.utc)

    await db.commit()
    return count


async def scan_downloads_directory(db: AsyncSession) -> int:
    """Scan the downloads directory for completed downloads not yet in library."""
    if not DOWNLOADS_PATH.exists():
        logger.warning(f"Downloads path does not exist: {DOWNLOADS_PATH}")
        return 0

    count = 0
    for item in DOWNLOADS_PATH.iterdir():
        if item.name.startswith("."):
            continue

        folder_path = str(item.relative_to(DOWNLOADS_PATH))

        # Check if already in library
        result = await db.execute(
            select(LocalLibraryEntry).where(
                (LocalLibraryEntry.original_name == item.name)
                | (LocalLibraryEntry.folder_path == folder_path)
            ).limit(1)
        )
        if result.scalar_one_or_none():
            continue

        title_clean = clean_title(item.name)
        folder_size = get_folder_size(item)
        file_count = get_file_count(item)
        fmt = detect_format(item)

        # Try to match FitGirl game
        matched_game = await _match_fitgirl_game(db, title_clean)
        game_id = matched_game.id if matched_game else None
        steam_app_id = matched_game.steam_app_id if matched_game else None
        igdb_id = matched_game.igdb_id if matched_game else None

        entry = await _upsert_local_entry(
            db=db,
            folder_path=folder_path,
            name=item.name,
            title_clean=title_clean,
            folder_size=folder_size,
            file_count=file_count,
            fmt=fmt,
            game_id=game_id,
            steam_app_id=steam_app_id,
            steam_name=title_clean,
            is_available=True,
            source="qbit",
            download_status="complete",
            download_progress=1.0,
        )
        await _link_to_default_user(db, entry)
        count += 1

    await db.commit()
    return count


async def move_to_library(
    db: AsyncSession,
    entry: LocalLibraryEntry,
    target_name: str | None = None,
) -> LocalLibraryEntry:
    """Move a download entry to the permanent library, normalize, create sidecar."""
    src = DOWNLOADS_PATH / entry.folder_path
    if not src.exists():
        raise FileNotFoundError(f"Source path does not exist: {src}")

    # Determine normalized name
    if target_name:
        norm_name = target_name
    else:
        norm_name = normalize_folder_name(
            entry.title or entry.name,
            entry.steam_app_id,
            entry.igdb_id,
        )

    dst = LIBRARY_PATH / norm_name
    if dst.exists():
        # Append number if collision
        i = 1
        while dst.exists():
            dst = LIBRARY_PATH / f"{norm_name} ({i})"
            i += 1

    # Move files
    shutil.move(str(src), str(dst))

    # Write sidecar
    fgmeta = {
        "version": 1,
        "source": entry.source or "fitgirl",
        "original_name": entry.original_name or entry.name,
        "original_path": str(src),
        "normalized_name": norm_name,
        "fitgirl_game_id": entry.game_id,
        "steam_app_id": entry.steam_app_id,
        "igdb_id": entry.igdb_id,
        "date_added": entry.date_added.isoformat() if entry.date_added else datetime.now(timezone.utc).isoformat(),
        "date_moved": datetime.now(timezone.utc).isoformat(),
    }
    write_fgmeta(dst, fgmeta)

    # Update entry
    entry.name = norm_name
    entry.folder_path = str(dst.relative_to(LIBRARY_PATH))
    entry.original_name = entry.original_name or entry.name
    entry.download_status = "complete"
    entry.download_progress = 1.0
    entry.date_updated = datetime.now(timezone.utc)

    await db.commit()
    return entry
