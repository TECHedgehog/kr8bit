import asyncio
import csv
import os
import re
from datetime import datetime, timezone as tz
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import async_session
from app.models import (
    Game, Category, Tag, GameCategory, GameTag,
    MagnetLink, TorrentFile, DownloadMirror,
    GameScreenshot, GameVideo, GameSystemRequirement,
    GameSteamGenre, GameSteamCategory, GameIgdbGenre,
    QbitTorrentSync, ProtonDBData, HowLongToBeatData,
    ScrapeLog,
)
from app.services.parser import parse_game_post
from app.services.title_matcher import extract_base_name

import httpx

GAME_CATEGORY_IDS = set(settings.game_category_ids)


def _parse_wp_date(date_str: str) -> datetime:
    """Parse WordPress ISO 8601 date string to UTC datetime."""
    if not date_str:
        return datetime.now(tz.utc)
    try:
        return datetime.fromisoformat(date_str).replace(tzinfo=tz.utc)
    except (ValueError, TypeError):
        return datetime.now(tz.utc)


def _slugify_group_key(text: str) -> str:
    """Convert a game name into a consistent group key slug."""
    slug = text.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    # Collapse multiple dashes
    slug = re.sub(r"-+", "-", slug)
    return slug[:100]


async def _fetch_json(url: str, client: httpx.AsyncClient) -> dict | list | None:
    try:
        resp = await client.get(url, timeout=30)
        resp.raise_for_status()
        return resp.json()
    except Exception:
        return None


async def _fetch_categories(client: httpx.AsyncClient) -> list[dict]:
    url = f"{settings.scraper_base_url}/wp-json/wp/v2/categories?per_page=100"
    data = await _fetch_json(url, client)
    return data if isinstance(data, list) else []


async def _fetch_tags(client: httpx.AsyncClient) -> list[dict]:
    all_tags = []
    page = 1
    while True:
        url = f"{settings.scraper_base_url}/wp-json/wp/v2/tags?per_page=100&page={page}"
        data = await _fetch_json(url, client)
        if not isinstance(data, list) or len(data) == 0:
            break
        all_tags.extend(data)
        if len(data) < 100:
            break
        page += 1
        await asyncio.sleep(0.1)
    return all_tags


async def _fetch_posts_page(client: httpx.AsyncClient, page: int, per_page: int | None = None) -> list[dict]:
    if per_page is None:
        per_page = settings.scraper_posts_per_page
    url = (
        f"{settings.scraper_base_url}/wp-json/wp/v2/posts"
        f"?per_page={per_page}&page={page}&_fields=id,title,slug,date_gmt,date,content,categories,tags"
    )
    data = await _fetch_json(url, client)
    return data if isinstance(data, list) else []


async def _load_categories(db: AsyncSession, client: httpx.AsyncClient):
    cats = await _fetch_categories(client)
    for c in cats:
        existing = await db.execute(select(Category).where(Category.wp_category_id == c["id"]))
        cat = existing.scalar_one_or_none()
        if cat:
            cat.name = c.get("name", cat.name)
            cat.slug = c.get("slug", cat.slug)
            cat.post_count = c.get("count", 0)
        else:
            db.add(Category(
                wp_category_id=c["id"],
                name=c.get("name", ""),
                slug=c.get("slug", ""),
                post_count=c.get("count", 0),
            ))
    await db.commit()


async def _load_tags(db: AsyncSession, client: httpx.AsyncClient):
    tags = await _fetch_tags(client)
    for t in tags:
        existing = await db.execute(select(Tag).where(Tag.wp_tag_id == t["id"]))
        tag = existing.scalar_one_or_none()
        if tag:
            tag.name = t.get("name", tag.name)
            tag.slug = t.get("slug", tag.slug)
            tag.post_count = t.get("count", 0)
        else:
            db.add(Tag(
                wp_tag_id=t["id"],
                name=t.get("name", ""),
                slug=t.get("slug", ""),
                post_count=t.get("count", 0),
            ))
    await db.commit()


def _is_game_post(post: dict) -> bool:
    post_cats = post.get("categories", [])
    if not post_cats:
        return False
    return bool(set(post_cats) & GAME_CATEGORY_IDS)


async def _process_post(db: AsyncSession, post: dict, client: httpx.AsyncClient):
    if not _is_game_post(post):
        return None

    wp_id = post["id"]
    parsed = parse_game_post(post)

    # Compute group_key from base name
    group_key = _slugify_group_key(parsed.get("title", ""))

    existing = await db.execute(select(Game).where(Game.wp_post_id == wp_id))
    game = existing.scalar_one_or_none()
    is_new = game is None

    if game:
        old_content = game.content_html
        if old_content == parsed["content_html"]:
            return None
        if not game.title_original:
            game.title_original = parsed.get("title_original", game.title)
        game.title = parsed["title"]
        game.slug = parsed["slug"]
        game.content_html = parsed["content_html"]
        game.content_text = parsed["content_text"]
        game.repack_version = parsed.get("fitgirl_version", "") or game.repack_version
        game.edition = parsed.get("edition", "") or game.edition
        game.dlc_info = parsed.get("dlc_info", "") or game.dlc_info
        game.version = parsed.get("fitgirl_version", "") or game.version
        game.languages = parsed["languages"] or game.languages
        game.original_size = parsed["original_size"] or game.original_size
        game.repack_size = parsed["repack_size"] or game.repack_size
        game.selective_download = parsed["selective_download"] or game.selective_download
        game.image_url = parsed["image_url"] or game.image_url
        game.group_key = group_key
        game.last_synced = datetime.now(tz.utc)
    else:
        game = Game(
            wp_post_id=wp_id,
            title=parsed["title"],
            title_original=parsed.get("title_original", parsed["title"]),
            title_clean=extract_base_name(parsed.get("title_original", parsed["title"])),
            slug=parsed["slug"],
            content_html=parsed["content_html"],
            content_text=parsed["content_text"],
            repack_version=parsed.get("fitgirl_version", ""),
            edition=parsed.get("edition", ""),
            dlc_info=parsed.get("dlc_info", ""),
            version=parsed.get("fitgirl_version", ""),
            companies=parsed["companies"],
            languages=parsed["languages"],
            original_size=parsed["original_size"],
            repack_size=parsed["repack_size"],
            selective_download=parsed["selective_download"],
            image_url=parsed["image_url"],
            group_key=group_key,
            date_published=_parse_wp_date(parsed.get("date_published", "")),
            last_synced=datetime.now(tz.utc),
        )
        db.add(game)
        await db.flush()

    await db.execute(MagnetLink.__table__.delete().where(MagnetLink.game_id == game.id))
    for i, m in enumerate(parsed["magnet_links"]):
        db.add(MagnetLink(
            game_id=game.id,
            magnet_uri=m["magnet_uri"],
            info_hash=m["info_hash"],
            source=m.get("source", ""),
            index_order=i,
        ))

    await db.execute(TorrentFile.__table__.delete().where(TorrentFile.game_id == game.id))
    for i, t in enumerate(parsed["torrent_files"]):
        db.add(TorrentFile(
            game_id=game.id,
            torrent_url=t["torrent_url"],
            source=t.get("source", ""),
            index_order=i,
        ))

    await db.execute(DownloadMirror.__table__.delete().where(DownloadMirror.game_id == game.id))
    for i, m in enumerate(parsed["download_mirrors"]):
        db.add(DownloadMirror(
            game_id=game.id,
            url=m["url"],
            mirror_type=m.get("mirror_type", ""),
            filename=m.get("filename", ""),
            index_order=i,
        ))

    companies = parsed.get("companies", "")
    if companies and not game.companies:
        game.companies = companies

    cat_ids = post.get("categories", [])
    if cat_ids:
        await db.execute(GameCategory.__table__.delete().where(GameCategory.game_id == game.id))
        for cid in cat_ids:
            cat_result = await db.execute(select(Category).where(Category.wp_category_id == cid))
            category = cat_result.scalar_one_or_none()
            if category:
                db.add(GameCategory(game_id=game.id, category_id=category.id))

    tag_ids = post.get("tags", [])
    if tag_ids:
        await db.execute(GameTag.__table__.delete().where(GameTag.game_id == game.id))
        for tid in tag_ids:
            tg_result = await db.execute(select(Tag).where(Tag.wp_tag_id == tid))
            tag = tg_result.scalar_one_or_none()
            if tag:
                db.add(GameTag(game_id=game.id, tag_id=tag.id))

    return "new" if is_new else "updated"


async def scrape_all(db: AsyncSession | None = None):
    if db is None:
        async with async_session() as session:
            return await _do_scrape(session)
    return await _do_scrape(db)


async def _write_scrape_report(db: AsyncSession) -> str:
    """Write a CSV report of all scraped games. Returns the file path."""
    report_path = settings.scraper_report_path
    os.makedirs(os.path.dirname(report_path) or ".", exist_ok=True)

    # Query all games with categories and magnet/torrent counts
    result = await db.execute(
        select(Game).order_by(Game.title.asc())
    )
    games = result.scalars().all()

    rows = []
    for game in games:
        # Fetch categories
        cat_result = await db.execute(
            select(Category.name)
            .join(GameCategory, GameCategory.category_id == Category.id)
            .where(GameCategory.game_id == game.id)
        )
        categories = ", ".join([r[0] for r in cat_result.all()])

        # Count magnet and torrent links
        magnet_count = (
            await db.execute(
                select(func.count(MagnetLink.id)).where(MagnetLink.game_id == game.id)
            )
        ).scalar() or 0

        torrent_count = (
            await db.execute(
                select(func.count(TorrentFile.id)).where(TorrentFile.game_id == game.id)
            )
        ).scalar() or 0

        rows.append({
            "id": game.id,
            "title": game.title or "",
            "title_original": game.title_original or "",
            "title_clean": game.title_clean or "",
            "group_key": game.group_key or "",
            "repack_version": game.repack_version or "",
            "edition": game.edition or "",
            "dlc_info": game.dlc_info or "",
            "companies": game.companies or "",
            "languages": game.languages or "",
            "original_size": game.original_size or "",
            "repack_size": game.repack_size or "",
            "selective_download": game.selective_download or "",
            "categories": categories,
            "magnet_count": magnet_count,
            "torrent_count": torrent_count,
            "slug": game.slug or "",
            "date_published": game.date_published.isoformat() if game.date_published else "",
            "enrichment_status": game.enrichment_status or "none",
        })

    fieldnames = [
        "id", "title", "title_original", "title_clean", "group_key",
        "repack_version", "edition", "dlc_info", "companies", "languages",
        "original_size", "repack_size", "selective_download", "categories",
        "magnet_count", "torrent_count", "slug", "date_published", "enrichment_status",
    ]

    with open(report_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    return report_path


async def _do_scrape(db: AsyncSession):
    # Delete all previous scrape logs — keep only the latest
    await db.execute(text("DELETE FROM scrape_logs"))
    await db.commit()

    log = ScrapeLog(run_type="full", status="running")
    db.add(log)
    await db.commit()

    new_count = 0
    updated_count = 0
    skipped_count = 0
    pages = 0

    async with httpx.AsyncClient() as client:
        await _load_categories(db, client)
        await _load_tags(db, client)

        page = 1
        while True:
            posts = await _fetch_posts_page(client, page)
            if not posts:
                break
            pages += 1
            for post in posts:
                result = await _process_post(db, post, client)
                if result == "new":
                    new_count += 1
                elif result == "updated":
                    updated_count += 1
                else:
                    skipped_count += 1
            await db.commit()
            if len(posts) < settings.scraper_posts_per_page:
                break
            page += 1
            await asyncio.sleep(settings.scraper_delay_seconds)

    log.status = "completed"
    log.pages_scraped = pages
    log.new_games = new_count
    log.updated_games = updated_count
    await db.commit()

    # Write CSV report
    try:
        report_path = await _write_scrape_report(db)
    except Exception as e:
        report_path = ""
        print(f"[scraper] Failed to write CSV report: {e}")

    return {
        "pages": pages,
        "new": new_count,
        "updated": updated_count,
        "skipped": skipped_count,
        "report_path": report_path,
    }


async def reset_scrape(db: AsyncSession | None = None) -> dict:
    """Delete all scraped game data and reset the database."""
    if db is None:
        async with async_session() as session:
            return await _do_reset(session)
    return await _do_reset(db)


async def _do_reset(db: AsyncSession) -> dict:
    deleted = {}

    # Delete child tables first (order matters for FK constraints)
    tables = [
        "magnet_links",
        "torrent_files",
        "download_mirrors",
        "game_screenshots",
        "game_videos",
        "game_system_requirements",
        "game_steam_genres",
        "game_steam_categories",
        "game_igdb_genres",
        "game_categories",
        "game_tags",
        "qbittorrent_sync",
        "protondb_data",
        "hltb_data",
    ]
    for table in tables:
        try:
            result = await db.execute(text(f"DELETE FROM {table}"))
            # For SQLite, rowcount may not be accurate for DELETE without WHERE
        except Exception:
            pass

    # Delete games
    try:
        result = await db.execute(text("DELETE FROM games"))
        deleted["games"] = result.rowcount if result.rowcount >= 0 else 0
    except Exception:
        deleted["games"] = 0

    # Delete scrape logs
    try:
        await db.execute(text("DELETE FROM scrape_logs"))
    except Exception:
        pass

    # Reset FTS
    try:
        await db.execute(text("DELETE FROM games_fts"))
    except Exception:
        pass

    await db.commit()

    return {"status": "reset", "deleted_games": deleted.get("games", 0)}
