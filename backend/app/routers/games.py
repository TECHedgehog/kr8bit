import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, or_, distinct, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import get_db
from app.models import (
    Game, GameCategory, Category, Tag, GameTag, GameIgdbGenre, IgdbGenre,
    GameSteamGenre, SteamGenre, GameSteamCategory, ProtonDBData, HowLongToBeatData,
    LocalLibraryEntry, UserLibraryEntry,
)
from app.schemas import (
    CategoryOut, GameDetail, GameListItem, GameListResponse, GameSearchResult,
    GameGroupInfo, TagOut, IgdbGenreOut, SteamGenreOut, QbitTorrentSyncOut,
    ProtonDBOut, HowLongToBeatOut, EnrichmentSourceStatus, SteamGridImageOut,
)

router = APIRouter()

GAME_CAT_IDS = settings.game_category_ids


def _fts_escape(q: str) -> str:
    tokens = re.findall(r'[a-zA-Z0-9]+', q)
    if not tokens:
        return ""
    return " ".join(f'"{t}"' for t in tokens[:10])


async def _get_game_cat_ids(db: AsyncSession) -> list[int]:
    result = await db.execute(select(Category.id).where(Category.wp_category_id.in_(GAME_CAT_IDS)))
    return [row[0] for row in result.all()]


@router.get("/games", response_model=GameListResponse)
async def list_games(
    page: int = Query(1, ge=1),
    per_page: int = Query(48, ge=1, le=200),
    category: Optional[int] = None,
    tag: Optional[int] = None,
    search: Optional[str] = None,
    sort: str = Query("date_desc", regex="^(date_desc|date_asc|name_asc|name_desc|size_asc|size_desc|metacritic|rating)$"),
    platform: Optional[str] = None,
    group_key: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    game_cat_ids = await _get_game_cat_ids(db)

    base_where = [GameCategory.category_id.in_(game_cat_ids)]

    if group_key:
        base_where.append(Game.group_key == group_key)

    if search:
        fts_query = _fts_escape(search)
        fts_ids = []
        if fts_query:
            try:
                fts_result = await db.execute(text(
                    "SELECT rowid FROM games_fts WHERE games_fts MATCH :q LIMIT 500"
                ), {"q": fts_query})
                fts_ids = [row[0] for row in fts_result.all()]
            except Exception:
                fts_ids = []
        if fts_ids:
            base_where.append(Game.id.in_(fts_ids))
        else:
            like = f"%{search}%"
            base_where.append(or_(Game.title.ilike(like), Game.content_text.ilike(like), Game.description.ilike(like)))

    if category:
        base_where.append(GameCategory.category_id == category)
    if tag:
        base_where.append(GameTag.tag_id == tag)
    if platform == "windows":
        base_where.append(Game.platforms_windows == True)
    elif platform == "mac":
        base_where.append(Game.platforms_mac == True)
    elif platform == "linux":
        base_where.append(Game.platforms_linux == True)

    count_subq = (
        select(Game.id)
        .join(GameCategory, GameCategory.game_id == Game.id)
    )
    if tag:
        count_subq = count_subq.join(GameTag, GameTag.game_id == Game.id)
    for w in base_where:
        count_subq = count_subq.where(w)
    count_subq = count_subq.distinct()
    total = (await db.execute(select(func.count()).select_from(count_subq.subquery()))).scalar() or 0

    sort_map = {
        "date_desc": Game.date_published.desc(),
        "date_asc": Game.date_published.asc(),
        "name_asc": Game.title.asc(),
        "name_desc": Game.title.desc(),
        "size_asc": Game.original_size.asc(),
        "size_desc": Game.original_size.desc(),
        "metacritic": Game.metacritic_score.desc().nullslast(),
        "rating": Game.igdb_rating.desc().nullslast(),
    }
    order = sort_map.get(sort, Game.date_published.desc())

    id_query = (
        select(Game.id)
        .join(GameCategory, GameCategory.game_id == Game.id)
    )
    if tag:
        id_query = id_query.join(GameTag, GameTag.game_id == Game.id)
    for w in base_where:
        id_query = id_query.where(w)
    id_query = id_query.distinct().order_by(order).offset((page - 1) * per_page).limit(per_page)

    id_result = await db.execute(id_query)
    game_ids = [row[0] for row in id_result.all()]

    if not game_ids:
        return GameListResponse(items=[], total=total, page=page, per_page=per_page, total_pages=max(1, (total + per_page - 1) // per_page))

    games_query = (
        select(Game)
        .options(
            selectinload(Game.categories).selectinload(GameCategory.category),
            selectinload(Game.tags).selectinload(GameTag.tag),
            selectinload(Game.steam_genres).selectinload(GameSteamGenre.genre),
            selectinload(Game.igdb_genres).selectinload(GameIgdbGenre.genre),
            selectinload(Game.qbit_torrents),
            selectinload(Game.protondb_data),
        )
        .where(Game.id.in_(game_ids))
        .order_by(order)
    )
    result = await db.execute(games_query)
    games = result.unique().scalars().all()
    games_by_id = {g.id: g for g in games}
    ordered_games = [games_by_id[gid] for gid in game_ids if gid in games_by_id]

    # Pre-fetch library mappings for these games
    lib_result = await db.execute(
        select(LocalLibraryEntry.game_id, LocalLibraryEntry.id)
        .where(LocalLibraryEntry.game_id.in_(game_ids))
    )
    lib_map = {row[0]: row[1] for row in lib_result.all()}

    items = []
    for g in ordered_games:
        igdb_genres = []
        for gg in (g.igdb_genres or []):
            if gg and gg.genre:
                igdb_genres.append(IgdbGenreOut(id=gg.genre.id, name=gg.genre.name, slug=gg.genre.slug))

        steam_genres = []
        for sg in (g.steam_genres or []):
            if sg and sg.genre:
                steam_genres.append(SteamGenreOut(id=sg.genre.id, name=sg.genre.name, slug=sg.genre.slug))

        qbit_torrents = []
        for qt in (g.qbit_torrents or []):
            qbit_torrents.append(QbitTorrentSyncOut(
                client_id=qt.client_id,
                info_hash=qt.info_hash,
                torrent_name=qt.torrent_name,
                status=qt.status,
                progress=qt.progress,
                size=qt.size,
                dlspeed=qt.dlspeed,
                upspeed=qt.upspeed,
                eta=qt.eta,
            ))

        pdb = None
        if g.protondb_data:
            pdb = ProtonDBOut(
                steam_app_id=g.protondb_data.steam_app_id,
                deck_tier=g.protondb_data.deck_tier,
                proton_tier=g.protondb_data.proton_tier,
                confidence=g.protondb_data.confidence,
                score=g.protondb_data.score,
                total_reports=g.protondb_data.total_reports,
                updated_at=g.protondb_data.updated_at,
            )

        lib_entry_id = lib_map.get(g.id)

        enrichment = EnrichmentSourceStatus(
            igdb=g.igdb_status or "none",
            steam=g.steam_status or "none",
            steamgrid=g.steamgrid_status or "none",
            protondb=g.protondb_status or "none",
            hltb=g.hltb_status or "none",
        )

        item = GameListItem(
            id=g.id,
            title=g.title,
            title_original=g.title_original or "",
            slug=g.slug,
            version=g.version or "",
            repack_version=g.repack_version or "",
            edition=g.edition or "",
            dlc_info=g.dlc_info or "",
            group_key=g.group_key or "",
            image_url=g.image_url or "",
            header_image=g.header_image or "",
            capsule_image=g.capsule_image or "",
            sgdb_grid_url=g.sgdb_grid_url or "",
            sgdb_hero_url=g.sgdb_hero_url or "",
            sgdb_logo_url=g.sgdb_logo_url or "",
            sgdb_icon_url=g.sgdb_icon_url or "",
            repack_size=g.repack_size or "",
            original_size=g.original_size or "",
            date_published=g.date_published,
            enrichment=enrichment,
            igdb_status=g.igdb_status or "none",
            steam_status=g.steam_status or "none",
            steamgrid_status=g.steamgrid_status or "none",
            protondb_status=g.protondb_status or "none",
            hltb_status=g.hltb_status or "none",
            metacritic_score=g.metacritic_score,
            igdb_rating=g.igdb_rating,
            platforms_windows=g.platforms_windows or False,
            platforms_mac=g.platforms_mac or False,
            platforms_linux=g.platforms_linux or False,
            categories=[_category_to_out(gc.category) for gc in g.categories] if g.categories else [],
            tags=[_tag_to_out(gt.tag) for gt in g.tags] if g.tags else [],
            steam_genres=steam_genres,
            igdb_genres=igdb_genres,
            qbit_torrents=qbit_torrents,
            protondb_data=pdb,
            in_library=lib_entry_id is not None,
            library_entry_id=lib_entry_id,
        )
        items.append(item)

    return GameListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=max(1, (total + per_page - 1) // per_page),
    )


def _category_to_out(cat: Category) -> CategoryOut:
    return CategoryOut(id=cat.id, name=cat.name, slug=cat.slug, post_count=cat.post_count)


def _tag_to_out(tag: Tag) -> TagOut:
    return TagOut(id=tag.id, name=tag.name, slug=tag.slug, post_count=tag.post_count)


def _steam_genre_to_out(gg) -> dict:
    if gg and gg.genre:
        return {"id": gg.genre.id, "name": gg.genre.name, "slug": gg.genre.slug}
    return {"id": 0, "name": "", "slug": ""}


def _steam_cat_to_out(gc) -> dict:
    if gc and gc.category:
        return {"id": gc.category.id, "name": gc.category.name}
    return {"id": 0, "name": ""}


def _igdb_genre_to_out(gg) -> dict:
    if gg and gg.genre:
        return {"id": gg.genre.id, "name": gg.genre.name, "slug": gg.genre.slug}
    return {"id": 0, "name": "", "slug": ""}


@router.get("/games/{game_id}", response_model=GameDetail)
async def get_game(game_id: int, db: AsyncSession = Depends(get_db)):
    query = (
        select(Game)
        .options(
            selectinload(Game.categories).selectinload(GameCategory.category),
            selectinload(Game.tags).selectinload(GameTag.tag),
            selectinload(Game.magnet_links),
            selectinload(Game.torrent_files),
            selectinload(Game.download_mirrors),
            selectinload(Game.screenshots),
            selectinload(Game.videos),
            selectinload(Game.system_requirements),
            selectinload(Game.steam_genres).selectinload(GameSteamGenre.genre),
            selectinload(Game.steam_categories).selectinload(GameSteamCategory.category),
            selectinload(Game.igdb_genres).selectinload(GameIgdbGenre.genre),
            selectinload(Game.qbit_torrents),
            selectinload(Game.protondb_data),
            selectinload(Game.hltb_data),
            selectinload(Game.steamgrid_images),
        )
        .where(Game.id == game_id)
    )
    result = await db.execute(query)
    game = result.unique().scalar_one_or_none()
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    pdb = None
    if game.protondb_data:
        pdb = ProtonDBOut(
            steam_app_id=game.protondb_data.steam_app_id,
            deck_tier=game.protondb_data.deck_tier,
            proton_tier=game.protondb_data.proton_tier,
            confidence=game.protondb_data.confidence,
            score=game.protondb_data.score,
            total_reports=game.protondb_data.total_reports,
            updated_at=game.protondb_data.updated_at,
        )

    hltb = None
    if game.hltb_data:
        hltb = HowLongToBeatOut(
            time_main=game.hltb_data.time_main,
            time_plus=game.hltb_data.time_plus,
            time_100=game.hltb_data.time_100,
            time_all=game.hltb_data.time_all,
            count_main=game.hltb_data.count_main,
            count_plus=game.hltb_data.count_plus,
            count_100=game.hltb_data.count_100,
            count_all=game.hltb_data.count_all,
            hltb_url=f"https://howlongtobeat.com/game?id={game.hltb_data.hltb_game_id}" if game.hltb_data.hltb_game_id else "",
            updated_at=game.hltb_data.updated_at,
        )

    # Check if in library
    lib_result = await db.execute(
        select(LocalLibraryEntry.id).where(LocalLibraryEntry.game_id == game.id).limit(1)
    )
    lib_row = lib_result.scalar_one_or_none()
    lib_entry_id = lib_row

    enrichment = EnrichmentSourceStatus(
        igdb=game.igdb_status or "none",
        steam=game.steam_status or "none",
        steamgrid=game.steamgrid_status or "none",
        protondb=game.protondb_status or "none",
        hltb=game.hltb_status or "none",
    )

    return GameDetail(
        id=game.id,
        title=game.title,
        title_original=game.title_original or "",
        title_clean=game.title_clean or "",
        slug=game.slug,
        version=game.version or "",
        repack_version=game.repack_version or "",
        edition=game.edition or "",
        dlc_info=game.dlc_info or "",
        group_key=game.group_key or "",
        companies=game.companies or "",
        languages=game.languages or "",
        selective_download=game.selective_download or "",
        image_url=game.image_url or "",
        content_html="",
        description=game.description or "",
        description_full=game.description_full or "",
        header_image=game.header_image or "",
        capsule_image=game.capsule_image or "",
        sgdb_grid_url=game.sgdb_grid_url or "",
        sgdb_hero_url=game.sgdb_hero_url or "",
        sgdb_logo_url=game.sgdb_logo_url or "",
        sgdb_icon_url=game.sgdb_icon_url or "",
        background_image=game.background_image or "",
        repack_size=game.repack_size or "",
        original_size=game.original_size or "",
        steam_app_id=game.steam_app_id,
        steam_name=game.steam_name or "",
        igdb_id=game.igdb_id,
        rawg_id=game.rawg_id,
        metacritic_score=game.metacritic_score,
        igdb_rating=game.igdb_rating,
        release_date_steam=game.release_date_steam or "",
        website=game.website or "",
        date_published=game.date_published,
        date_updated=game.date_updated,
        enrichment=enrichment,
        igdb_status=game.igdb_status or "none",
        steam_status=game.steam_status or "none",
        steamgrid_status=game.steamgrid_status or "none",
        protondb_status=game.protondb_status or "none",
        hltb_status=game.hltb_status or "none",
        steam_rating_percent=game.steam_rating_percent,
        steam_rating_count=game.steam_rating_count,
        igdb_rating_count=game.igdb_rating_count,
        platforms_windows=game.platforms_windows,
        platforms_mac=game.platforms_mac,
        platforms_linux=game.platforms_linux,
        categories=[_category_to_out(gc.category) for gc in game.categories] if game.categories else [],
        tags=[_tag_to_out(gt.tag) for gt in game.tags] if game.tags else [],
        magnet_links=game.magnet_links or [],
        torrent_files=game.torrent_files or [],
        download_mirrors=game.download_mirrors or [],
        screenshots=game.screenshots or [],
        videos=game.videos or [],
        system_requirements=game.system_requirements or [],
        steam_genres=[_steam_genre_to_out(gg) for gg in game.steam_genres] if game.steam_genres else [],
        steam_categories=[_steam_cat_to_out(gc) for gc in game.steam_categories] if game.steam_categories else [],
        igdb_genres=[_igdb_genre_to_out(gg) for gg in game.igdb_genres] if game.igdb_genres else [],
        qbit_torrents=game.qbit_torrents or [],
        protondb_data=pdb,
        hltb_data=hltb,
        in_library=lib_entry_id is not None,
        library_entry_id=lib_entry_id,
        steamgrid_images=[
            SteamGridImageOut(
                id=img.id,
                image_type=img.image_type,
                url=img.url,
                thumbnail_url=img.thumbnail_url or "",
                width=img.width,
                height=img.height,
                style=img.style or "",
                is_nsfw=img.is_nsfw or False,
                is_humor=img.is_humor or False,
            )
            for img in (game.steamgrid_images or [])
        ],
    )


@router.get("/search", response_model=list[GameSearchResult])
async def search_games(
    q: str = Query(..., min_length=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    game_cat_ids = await _get_game_cat_ids(db)

    fts_query = _fts_escape(q)
    fts_ids = []
    if fts_query:
        try:
            fts_result = await db.execute(text(
                "SELECT rowid FROM games_fts WHERE games_fts MATCH :q ORDER BY rank LIMIT :limit"
            ), {"q": fts_query, "limit": limit})
            fts_ids = [row[0] for row in fts_result.all()]
        except Exception:
            fts_ids = []

    if fts_ids:
        query = (
            select(Game)
            .join(GameCategory, GameCategory.game_id == Game.id)
            .where(GameCategory.category_id.in_(game_cat_ids))
            .where(Game.id.in_(fts_ids))
            .limit(limit)
        )
        result = await db.execute(query)
        games = result.unique().scalars().all()
    else:
        like = f"%{q}%"
        query = (
            select(Game)
            .join(GameCategory, GameCategory.game_id == Game.id)
            .where(GameCategory.category_id.in_(game_cat_ids))
            .where(or_(Game.title.ilike(like), Game.description.ilike(like)))
            .order_by(Game.date_published.desc())
            .limit(limit)
        )
        result = await db.execute(query)
        games = result.unique().scalars().all()

    return [
        GameSearchResult(
            id=g.id,
            title=g.title,
            slug=g.slug,
            header_image=g.header_image or g.image_url or "",
            date_published=g.date_published,
            enrichment=EnrichmentSourceStatus(
                igdb=g.igdb_status or "none",
                steam=g.steam_status or "none",
                steamgrid=g.steamgrid_status or "none",
                protondb=g.protondb_status or "none",
                hltb=g.hltb_status or "none",
            ),
        )
        for g in games
    ]


@router.get("/games/group/{group_key}", response_model=list[GameListItem])
async def get_game_group(
    group_key: str,
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(Game)
        .options(
            selectinload(Game.categories).selectinload(GameCategory.category),
            selectinload(Game.tags).selectinload(GameTag.tag),
            selectinload(Game.steam_genres).selectinload(GameSteamGenre.genre),
            selectinload(Game.igdb_genres).selectinload(GameIgdbGenre.genre),
            selectinload(Game.qbit_torrents),
            selectinload(Game.protondb_data),
        )
        .where(Game.group_key == group_key)
        .order_by(Game.date_published.desc())
    )
    result = await db.execute(query)
    games = result.unique().scalars().all()

    items = []
    for g in games:
        igdb_genres = []
        for gg in (g.igdb_genres or []):
            if gg and gg.genre:
                igdb_genres.append(IgdbGenreOut(id=gg.genre.id, name=gg.genre.name, slug=gg.genre.slug))

        steam_genres = []
        for sg in (g.steam_genres or []):
            if sg and sg.genre:
                steam_genres.append(SteamGenreOut(id=sg.genre.id, name=sg.genre.name, slug=sg.genre.slug))

        qbit_torrents = []
        for qt in (g.qbit_torrents or []):
            qbit_torrents.append(QbitTorrentSyncOut(
                client_id=qt.client_id,
                info_hash=qt.info_hash,
                torrent_name=qt.torrent_name,
                status=qt.status,
                progress=qt.progress,
                size=qt.size,
                dlspeed=qt.dlspeed,
                upspeed=qt.upspeed,
                eta=qt.eta,
            ))

        pdb = None
        if g.protondb_data:
            pdb = ProtonDBOut(
                steam_app_id=g.protondb_data.steam_app_id,
                deck_tier=g.protondb_data.deck_tier,
                proton_tier=g.protondb_data.proton_tier,
                confidence=g.protondb_data.confidence,
                score=g.protondb_data.score,
                total_reports=g.protondb_data.total_reports,
                updated_at=g.protondb_data.updated_at,
            )

        items.append(GameListItem(
            id=g.id,
            title=g.title,
            title_original=g.title_original or "",
            slug=g.slug,
            version=g.version or "",
            repack_version=g.repack_version or "",
            edition=g.edition or "",
            dlc_info=g.dlc_info or "",
            group_key=g.group_key or "",
            image_url=g.image_url or "",
            header_image=g.header_image or "",
            capsule_image=g.capsule_image or "",
            sgdb_grid_url=g.sgdb_grid_url or "",
            sgdb_hero_url=g.sgdb_hero_url or "",
            sgdb_logo_url=g.sgdb_logo_url or "",
            sgdb_icon_url=g.sgdb_icon_url or "",
            repack_size=g.repack_size or "",
            original_size=g.original_size or "",
            date_published=g.date_published,
            enrichment=EnrichmentSourceStatus(
                igdb=g.igdb_status or "none",
                steam=g.steam_status or "none",
                steamgrid=g.steamgrid_status or "none",
                protondb=g.protondb_status or "none",
                hltb=g.hltb_status or "none",
            ),
            igdb_status=g.igdb_status or "none",
            steam_status=g.steam_status or "none",
            steamgrid_status=g.steamgrid_status or "none",
            protondb_status=g.protondb_status or "none",
            hltb_status=g.hltb_status or "none",
            metacritic_score=g.metacritic_score,
            igdb_rating=g.igdb_rating,
            platforms_windows=g.platforms_windows or False,
            platforms_mac=g.platforms_mac or False,
            platforms_linux=g.platforms_linux or False,
            categories=[_category_to_out(gc.category) for gc in g.categories] if g.categories else [],
            tags=[_tag_to_out(gt.tag) for gt in g.tags] if g.tags else [],
            steam_genres=steam_genres,
            igdb_genres=igdb_genres,
            qbit_torrents=qbit_torrents,
            protondb_data=pdb,
        ))

    return items


@router.get("/stats", response_model=dict)
async def get_stats(db: AsyncSession = Depends(get_db)):
    game_cat_ids = await _get_game_cat_ids(db)
    game_count_query = (
        select(func.count(distinct(Game.id)))
        .join(GameCategory, GameCategory.game_id == Game.id)
        .where(GameCategory.category_id.in_(game_cat_ids))
    )
    total = (await db.execute(game_count_query)).scalar() or 0
    enriched = (await db.execute(select(func.count(Game.id)).where(
        (Game.igdb_status == "matched") | (Game.steam_status == "matched")
    ))).scalar() or 0
    unmatched = (await db.execute(select(func.count(Game.id)).where(
        (Game.igdb_status == "none") & (Game.steam_status == "none")
    ))).scalar() or 0
    failed = (await db.execute(select(func.count(Game.id)).where(Game.igdb_status == "failed"))).scalar() or 0
    cats = (await db.execute(select(func.count(Category.id)).where(Category.wp_category_id.in_(GAME_CAT_IDS)))).scalar() or 0
    last = (await db.execute(select(Game.date_published).order_by(Game.date_published.desc()).limit(1))).scalar()

    lib_total = (await db.execute(select(func.count(LocalLibraryEntry.id)))).scalar() or 0
    lib_size = (await db.execute(select(func.sum(LocalLibraryEntry.folder_size)))).scalar() or 0
    lib_downloading = (await db.execute(
        select(func.count(LocalLibraryEntry.id)).where(LocalLibraryEntry.download_status == "downloading")
    )).scalar() or 0

    return {
        "total_games": total,
        "total_enriched": enriched,
        "total_unmatched": unmatched,
        "total_failed": failed,
        "total_categories": cats,
        "total_tags": (await db.execute(select(func.count(Tag.id)))).scalar() or 0,
        "last_scrape": last,
        "library_total_games": lib_total,
        "library_total_size": lib_size or 0,
        "library_downloading": lib_downloading,
    }