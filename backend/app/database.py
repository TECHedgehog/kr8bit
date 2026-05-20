from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import text
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(
    settings.database_url,
    echo=False,
    connect_args={"timeout": 30.0},
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        await conn.execute(text("PRAGMA journal_mode=WAL"))
        await conn.execute(text("PRAGMA busy_timeout=5000"))
        await conn.run_sync(Base.metadata.create_all)

        migrations = [
            ("games", "title_original", "TEXT DEFAULT ''"),
            ("games", "igdb_id", "INTEGER"),
            ("games", "igdb_rating", "FLOAT"),
            ("games", "igdb_rating_count", "INTEGER"),
            ("games", "steam_deck_status", "TEXT DEFAULT ''"),
            ("qbittorrent_sync", "client_id", "INTEGER"),
            ("games", "igdb_status", "TEXT DEFAULT 'none'"),
            ("games", "steam_status", "TEXT DEFAULT 'none'"),
            ("games", "steamgrid_status", "TEXT DEFAULT 'none'"),
            ("games", "protondb_status", "TEXT DEFAULT 'none'"),
            ("games", "hltb_status", "TEXT DEFAULT 'none'"),
            ("games", "sgdb_grid_url", "TEXT DEFAULT ''"),
            ("games", "sgdb_hero_url", "TEXT DEFAULT ''"),
            ("games", "sgdb_logo_url", "TEXT DEFAULT ''"),
            ("games", "sgdb_icon_url", "TEXT DEFAULT ''"),
            ("local_library", "igdb_status", "TEXT DEFAULT 'none'"),
            ("local_library", "steam_status", "TEXT DEFAULT 'none'"),
            ("local_library", "steamgrid_status", "TEXT DEFAULT 'none'"),
            ("local_library", "protondb_status", "TEXT DEFAULT 'none'"),
            ("local_library", "hltb_status", "TEXT DEFAULT 'none'"),
            ("local_library", "sgdb_grid_url", "TEXT DEFAULT ''"),
            ("local_library", "sgdb_hero_url", "TEXT DEFAULT ''"),
            ("local_library", "sgdb_logo_url", "TEXT DEFAULT ''"),
            ("local_library", "sgdb_icon_url", "TEXT DEFAULT ''"),
        ]
        for table, column, col_type in migrations:
            try:
                await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}"))
            except Exception:
                pass

        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS download_clients (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(200) NOT NULL,
                    client_type VARCHAR(50) NOT NULL DEFAULT 'qbittorrent',
                    host VARCHAR(500) NOT NULL,
                    username VARCHAR(200) DEFAULT '',
                    password TEXT DEFAULT '',
                    is_enabled BOOLEAN DEFAULT 1,
                    is_default BOOLEAN DEFAULT 0,
                    extra_config TEXT DEFAULT '',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """))
        except Exception:
            pass

        try:
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_download_clients_is_default
                ON download_clients(is_default)
            """))
        except Exception:
            pass
        try:
            await conn.execute(text("""
                CREATE INDEX IF NOT EXISTS ix_download_clients_is_enabled
                ON download_clients(is_enabled)
            """))
        except Exception:
            pass

        # Migrate old qBittorrent settings from settings table to download_clients
        try:
            existing_clients = (await conn.execute(text("SELECT COUNT(*) FROM download_clients"))).scalar() or 0
            if existing_clients == 0:
                host_row = await conn.execute(text("SELECT value FROM settings WHERE key = 'qbittorrent_host'"))
                host = (host_row.fetchone() or (None,))[0]
                user_row = await conn.execute(text("SELECT value FROM settings WHERE key = 'qbittorrent_user'"))
                user = (user_row.fetchone() or (None,))[0]
                pass_row = await conn.execute(text("SELECT value FROM settings WHERE key = 'qbittorrent_pass'"))
                password = (pass_row.fetchone() or (None,))[0]

                if host and host.strip():
                    from app.config import settings as cfg
                    host_val = host.strip()
                    user_val = user.strip() if user else cfg.qbittorrent_user
                    pass_val = password if password else cfg.qbittorrent_pass
                    await conn.execute(text("""
                        INSERT INTO download_clients (name, client_type, host, username, password, is_enabled, is_default)
                        VALUES (:name, :ctype, :host, :user, :pass, 1, 1)
                    """), {
                        "name": "qBittorrent",
                        "ctype": "qbittorrent",
                        "host": host_val,
                        "user": user_val,
                        "pass": pass_val,
                    })
                    # Backfill client_id on existing torrent sync rows
                    new_id_row = await conn.execute(text("SELECT id FROM download_clients WHERE is_default = 1"))
                    new_id = (new_id_row.fetchone() or (None,))[0]
                    if new_id:
                        await conn.execute(text("UPDATE qbittorrent_sync SET client_id = :cid WHERE client_id IS NULL"), {"cid": new_id})
        except Exception:
            pass

        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS igdb_genres (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    igdb_genre_id INTEGER UNIQUE NOT NULL,
                    name VARCHAR(200) NOT NULL,
                    slug VARCHAR(200) NOT NULL
                )
            """))
        except Exception:
            pass

        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS game_igdb_genres (
                    game_id INTEGER NOT NULL,
                    genre_id INTEGER NOT NULL,
                    PRIMARY KEY (game_id, genre_id),
                    FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE,
                    FOREIGN KEY(genre_id) REFERENCES igdb_genres(id) ON DELETE CASCADE
                )
            """))
        except Exception:
            pass

        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS settings (
                    key VARCHAR(100) PRIMARY KEY,
                    value TEXT DEFAULT '',
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """))
        except Exception:
            pass

        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS enrichment_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    game_id INTEGER NOT NULL UNIQUE,
                    title VARCHAR(500) NOT NULL,
                    clean_title VARCHAR(500) DEFAULT '',
                    status VARCHAR(20) NOT NULL,
                    matched_via VARCHAR(20) DEFAULT 'none',
                    igdb_id INTEGER,
                    steam_app_id INTEGER,
                    search_variants TEXT DEFAULT '',
                    error_message TEXT DEFAULT '',
                    attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
                )
            """))
        except Exception:
            pass

        try:
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_enrichment_logs_game_id ON enrichment_logs(game_id)"))
        except Exception:
            pass
        try:
            await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_enrichment_logs_status ON enrichment_logs(status)"))
        except Exception:
            pass
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS enrichment_source_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    game_id INTEGER NOT NULL,
                    source VARCHAR(20) NOT NULL,
                    status VARCHAR(20) NOT NULL,
                    error_message TEXT DEFAULT '',
                    attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE,
                    UNIQUE(game_id, source)
                )
            """))
        except Exception:
            pass
        try:
            await conn.execute(text("""
                CREATE TABLE IF NOT EXISTS steamgrid_images (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    game_id INTEGER NOT NULL,
                    sgdb_game_id INTEGER,
                    image_type VARCHAR(20) NOT NULL,
                    url VARCHAR(500) NOT NULL,
                    thumbnail_url VARCHAR(500) DEFAULT '',
                    width INTEGER,
                    height INTEGER,
                    style VARCHAR(50) DEFAULT '',
                    is_nsfw BOOLEAN DEFAULT 0,
                    is_humor BOOLEAN DEFAULT 0,
                    index_order INTEGER DEFAULT 0,
                    FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE CASCADE
                )
            """))
        except Exception:
            pass

        indexes = [
            "CREATE INDEX IF NOT EXISTS ix_games_enrichment_status ON games(enrichment_status)",
            "CREATE INDEX IF NOT EXISTS ix_games_date_published ON games(date_published)",
            "CREATE INDEX IF NOT EXISTS ix_games_steam_app_id ON games(steam_app_id)",
            "CREATE INDEX IF NOT EXISTS ix_games_igdb_id ON games(igdb_id)",
            "CREATE INDEX IF NOT EXISTS ix_games_title ON games(title)",
            "CREATE INDEX IF NOT EXISTS ix_games_title_clean ON games(title_clean)",
            "CREATE INDEX IF NOT EXISTS ix_games_group_key ON games(group_key)",
            "CREATE INDEX IF NOT EXISTS ix_games_wp_post_id ON games(wp_post_id)",
            "CREATE INDEX IF NOT EXISTS ix_game_categories_game_id ON game_categories(game_id)",
            "CREATE INDEX IF NOT EXISTS ix_game_categories_category_id ON game_categories(category_id)",
            "CREATE INDEX IF NOT EXISTS ix_game_tags_game_id ON game_tags(game_id)",
            "CREATE INDEX IF NOT EXISTS ix_game_tags_tag_id ON game_tags(tag_id)",
            "CREATE INDEX IF NOT EXISTS ix_magnet_links_game_id ON magnet_links(game_id)",
            "CREATE INDEX IF NOT EXISTS ix_torrent_files_game_id ON torrent_files(game_id)",
            "CREATE INDEX IF NOT EXISTS ix_download_mirrors_game_id ON download_mirrors(game_id)",
            "CREATE INDEX IF NOT EXISTS ix_game_screenshots_game_id ON game_screenshots(game_id)",
            "CREATE INDEX IF NOT EXISTS ix_game_videos_game_id ON game_videos(game_id)",
            "CREATE INDEX IF NOT EXISTS ix_game_system_requirements_game_id ON game_system_requirements(game_id)",
            "CREATE INDEX IF NOT EXISTS ix_game_steam_genres_game_id ON game_steam_genres(game_id)",
            "CREATE INDEX IF NOT EXISTS ix_game_steam_categories_game_id ON game_steam_categories(game_id)",
            "CREATE INDEX IF NOT EXISTS ix_game_igdb_genres_game_id ON game_igdb_genres(game_id)",
            "CREATE INDEX IF NOT EXISTS ix_qbittorrent_sync_game_id ON qbittorrent_sync(game_id)",
            "CREATE INDEX IF NOT EXISTS ix_qbittorrent_sync_info_hash ON qbittorrent_sync(info_hash)",
            "CREATE INDEX IF NOT EXISTS ix_categories_wp_category_id ON categories(wp_category_id)",
            "CREATE INDEX IF NOT EXISTS ix_tags_wp_tag_id ON tags(wp_tag_id)",
        ]
        for idx_sql in indexes:
            await conn.execute(text(idx_sql))

        try:
            await conn.execute(text("""
                CREATE VIRTUAL TABLE IF NOT EXISTS games_fts USING fts5(
                    title,
                    title_clean,
                    content_text,
                    description,
                    companies,
                    content=games,
                    content_rowid=id
                )
            """))
        except Exception:
            pass

        try:
            await conn.execute(text("""
                CREATE TRIGGER IF NOT EXISTS games_ai AFTER INSERT ON games BEGIN
                    INSERT INTO games_fts(rowid, title, title_clean, content_text, description, companies)
                    VALUES (new.id, new.title, COALESCE(new.title_clean,''), COALESCE(new.content_text,''), COALESCE(new.description,''), COALESCE(new.companies,''));
                END
            """))
        except Exception:
            pass

        try:
            await conn.execute(text("""
                CREATE TRIGGER IF NOT EXISTS games_ad AFTER DELETE ON games BEGIN
                    INSERT INTO games_fts(games_fts, rowid, title, title_clean, content_text, description, companies)
                    VALUES ('delete', old.id, old.title, COALESCE(old.title_clean,''), COALESCE(old.content_text,''), COALESCE(old.description,''), COALESCE(old.companies,''));
                END
            """))
        except Exception:
            pass

        try:
            await conn.execute(text("""
                CREATE TRIGGER IF NOT EXISTS games_au AFTER UPDATE ON games BEGIN
                    INSERT INTO games_fts(games_fts, rowid, title, title_clean, content_text, description, companies)
                    VALUES ('delete', old.id, old.title, COALESCE(old.title_clean,''), COALESCE(old.content_text,''), COALESCE(old.description,''), COALESCE(old.companies,''));
                    INSERT INTO games_fts(rowid, title, title_clean, content_text, description, companies)
                    VALUES (new.id, new.title, COALESCE(new.title_clean,''), COALESCE(new.content_text,''), COALESCE(new.description,''), COALESCE(new.companies,''));
                END
            """))
        except Exception:
            pass

        try:
            fts_count = (await conn.execute(text("SELECT COUNT(*) FROM games_fts"))).scalar()
            games_count = (await conn.execute(text("SELECT COUNT(*) FROM games"))).scalar()
            if fts_count == 0 and games_count > 0:
                await conn.execute(text("""
                    INSERT INTO games_fts(rowid, title, title_clean, content_text, description, companies)
                    SELECT id, COALESCE(title,''), COALESCE(title_clean,''), COALESCE(content_text,''), COALESCE(description,''), COALESCE(companies,'')
                    FROM games
                """))
        except Exception:
            pass

        # Local library tables
        local_tables = [
            ("local_library", """
                CREATE TABLE IF NOT EXISTS local_library (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name VARCHAR(500) DEFAULT '',
                    title VARCHAR(500) DEFAULT '',
                    original_name VARCHAR(500) DEFAULT '',
                    folder_path VARCHAR(1000) DEFAULT '',
                    folder_size INTEGER DEFAULT 0,
                    file_count INTEGER DEFAULT 0,
                    format VARCHAR(20) DEFAULT 'unknown',
                    game_id INTEGER,
                    steam_app_id INTEGER,
                    steam_name VARCHAR(500) DEFAULT '',
                    igdb_id INTEGER,
                    description TEXT DEFAULT '',
                    description_full TEXT DEFAULT '',
                    header_image VARCHAR(500) DEFAULT '',
                    capsule_image VARCHAR(500) DEFAULT '',
                    background_image VARCHAR(500) DEFAULT '',
                    sgdb_grid_url VARCHAR(500) DEFAULT '',
                    sgdb_hero_url VARCHAR(500) DEFAULT '',
                    sgdb_logo_url VARCHAR(500) DEFAULT '',
                    sgdb_icon_url VARCHAR(500) DEFAULT '',
                    metacritic_score INTEGER,
                    igdb_rating FLOAT,
                    release_date VARCHAR(50) DEFAULT '',
                    igdb_status VARCHAR(20) DEFAULT 'none',
                    steam_status VARCHAR(20) DEFAULT 'none',
                    steamgrid_status VARCHAR(20) DEFAULT 'none',
                    protondb_status VARCHAR(20) DEFAULT 'none',
                    hltb_status VARCHAR(20) DEFAULT 'none',
                    source VARCHAR(20) DEFAULT 'scanner',
                    is_available BOOLEAN DEFAULT 1,
                    notes TEXT DEFAULT '',
                    client_id INTEGER,
                    download_info_hash VARCHAR(40) DEFAULT '',
                    download_status VARCHAR(20) DEFAULT 'complete',
                    download_progress FLOAT DEFAULT 1.0,
                    date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
                    date_scanned DATETIME DEFAULT CURRENT_TIMESTAMP,
                    date_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(game_id) REFERENCES games(id) ON DELETE SET NULL,
                    FOREIGN KEY(client_id) REFERENCES download_clients(id) ON DELETE SET NULL
                )
            """),
            ("users", """
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username VARCHAR(100) UNIQUE NOT NULL,
                    display_name VARCHAR(200) DEFAULT '',
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """),
            ("user_library", """
                CREATE TABLE IF NOT EXISTS user_library (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER,
                    library_entry_id INTEGER NOT NULL,
                    date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
                    FOREIGN KEY(library_entry_id) REFERENCES local_library(id) ON DELETE CASCADE
                )
            """),
            ("local_system_requirements", """
                CREATE TABLE IF NOT EXISTS local_system_requirements (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    entry_id INTEGER NOT NULL,
                    req_type VARCHAR(20) DEFAULT 'minimum',
                    os VARCHAR(200) DEFAULT '',
                    processor VARCHAR(300) DEFAULT '',
                    memory VARCHAR(100) DEFAULT '',
                    graphics VARCHAR(300) DEFAULT '',
                    directx VARCHAR(50) DEFAULT '',
                    storage VARCHAR(100) DEFAULT '',
                    notes VARCHAR(500) DEFAULT '',
                    FOREIGN KEY(entry_id) REFERENCES local_library(id) ON DELETE CASCADE
                )
            """),
            ("local_steam_genres", """
                CREATE TABLE IF NOT EXISTS local_steam_genres (
                    entry_id INTEGER NOT NULL,
                    genre_id INTEGER NOT NULL,
                    PRIMARY KEY (entry_id, genre_id),
                    FOREIGN KEY(entry_id) REFERENCES local_library(id) ON DELETE CASCADE,
                    FOREIGN KEY(genre_id) REFERENCES steam_genres(id) ON DELETE CASCADE
                )
            """),
            ("local_igdb_genres", """
                CREATE TABLE IF NOT EXISTS local_igdb_genres (
                    entry_id INTEGER NOT NULL,
                    genre_id INTEGER NOT NULL,
                    PRIMARY KEY (entry_id, genre_id),
                    FOREIGN KEY(entry_id) REFERENCES local_library(id) ON DELETE CASCADE,
                    FOREIGN KEY(genre_id) REFERENCES igdb_genres(id) ON DELETE CASCADE
                )
            """),
        ]
        for table_name, sql in local_tables:
            try:
                await conn.execute(text(sql))
            except Exception:
                pass

        # Insert default user
        try:
            await conn.execute(text("INSERT OR IGNORE INTO users (id, username, display_name) VALUES (1, 'default', 'Default User')"))
        except Exception:
            pass

        local_indexes = [
            "CREATE INDEX IF NOT EXISTS ix_local_library_game_id ON local_library(game_id)",
            "CREATE INDEX IF NOT EXISTS ix_local_library_steam_app_id ON local_library(steam_app_id)",
            "CREATE INDEX IF NOT EXISTS ix_local_library_igdb_id ON local_library(igdb_id)",
            "CREATE INDEX IF NOT EXISTS ix_local_library_enrichment_status ON local_library(enrichment_status)",
            "CREATE INDEX IF NOT EXISTS ix_local_library_is_available ON local_library(is_available)",
            "CREATE INDEX IF NOT EXISTS ix_local_library_download_status ON local_library(download_status)",
            "CREATE INDEX IF NOT EXISTS ix_local_library_client_id ON local_library(client_id)",
            "CREATE INDEX IF NOT EXISTS ix_user_library_user_id ON user_library(user_id)",
            "CREATE INDEX IF NOT EXISTS ix_user_library_library_entry_id ON user_library(library_entry_id)",
            "CREATE INDEX IF NOT EXISTS ix_local_system_requirements_entry_id ON local_system_requirements(entry_id)",
        ]
        for idx_sql in local_indexes:
            try:
                await conn.execute(text(idx_sql))
            except Exception:
                pass


async def migrate_unescape_titles():
    """One-time migration: unescape HTML entities in game titles."""
    import html as html_mod
    from sqlalchemy import select, update
    from app.models import Game, Setting

    async with async_session() as session:
        try:
            existing = await session.execute(select(Setting).where(Setting.key == "migration_unescape_titles_v1"))
            if existing.scalar_one_or_none():
                return
        except Exception:
            pass

        try:
            result = await session.execute(select(Game).where(Game.title.like("%&%")))
            games = result.scalars().all()
            updated = 0
            for game in games:
                new_title = html_mod.unescape(game.title)
                new_original = html_mod.unescape(game.title_original) if game.title_original else game.title_original
                new_clean = html_mod.unescape(game.title_clean) if game.title_clean else game.title_clean
                if new_title != game.title or new_original != game.title_original or new_clean != game.title_clean:
                    game.title = new_title
                    if game.title_original:
                        game.title_original = new_original
                    if game.title_clean:
                        game.title_clean = new_clean
                    updated += 1
            await session.commit()
            print(f"[migrate] Unescaped HTML entities in {updated} game titles")
        except Exception as e:
            print(f"[migrate] Error unescaping titles: {e}")
            await session.rollback()

        try:
            session.add(Setting(key="migration_unescape_titles_v1", value="done"))
            await session.commit()
        except Exception:
            pass