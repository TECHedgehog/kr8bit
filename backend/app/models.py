from datetime import datetime, timezone
from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


class Game(Base):
    __tablename__ = "games"

    id = Column(Integer, primary_key=True, autoincrement=True)
    wp_post_id = Column(Integer, unique=True, nullable=False)
    title = Column(String(500), nullable=False)
    title_clean = Column(String(500), default="")
    title_original = Column(String(500), default="")
    slug = Column(String(500), nullable=False)
    version = Column(String(200), default="")
    repack_version = Column("fitgirl_version", String(200), default="")
    edition = Column(String(200), default="")
    dlc_info = Column(String(300), default="")
    group_key = Column(String(500), default="", index=True)
    companies = Column(String(500), default="")
    languages = Column(String(300), default="")
    original_size = Column(String(50), default="")
    repack_size = Column(String(50), default="")
    selective_download = Column(String(50), default="")
    image_url = Column(String(500), default="")
    content_html = Column(Text, default="")
    content_text = Column(Text, default="")
    date_published = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    date_updated = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    steam_app_id = Column(Integer, nullable=True)
    steam_name = Column(String(500), default="")
    igdb_id = Column(Integer, nullable=True)
    rawg_id = Column(Integer, nullable=True)
    description = Column(Text, default="")
    description_full = Column(Text, default="")
    header_image = Column(String(500), default="")
    capsule_image = Column(String(500), default="")
    background_image = Column(String(500), default="")
    metacritic_score = Column(Integer, nullable=True)
    steam_rating_percent = Column(Integer, nullable=True)
    steam_rating_count = Column(Integer, nullable=True)
    igdb_rating = Column(Float, nullable=True)
    igdb_rating_count = Column(Integer, nullable=True)
    release_date_steam = Column(String(50), default="")
    website = Column(String(500), default="")
    platforms_windows = Column(Boolean, default=False)
    platforms_mac = Column(Boolean, default=False)
    platforms_linux = Column(Boolean, default=False)
    enrichment_matched_at = Column(DateTime, nullable=True)

    igdb_status = Column(String(20), default="none")
    steam_status = Column(String(20), default="none")
    steamgrid_status = Column(String(20), default="none")
    protondb_status = Column(String(20), default="none")
    hltb_status = Column(String(20), default="none")

    sgdb_grid_url = Column(String(500), default="")
    sgdb_hero_url = Column(String(500), default="")
    sgdb_logo_url = Column(String(500), default="")
    sgdb_icon_url = Column(String(500), default="")

    last_synced = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    categories = relationship("GameCategory", back_populates="game", cascade="all, delete-orphan")
    tags = relationship("GameTag", back_populates="game", cascade="all, delete-orphan")
    magnet_links = relationship("MagnetLink", back_populates="game", cascade="all, delete-orphan")
    torrent_files = relationship("TorrentFile", back_populates="game", cascade="all, delete-orphan")
    download_mirrors = relationship("DownloadMirror", back_populates="game", cascade="all, delete-orphan")
    screenshots = relationship("GameScreenshot", back_populates="game", cascade="all, delete-orphan")
    videos = relationship("GameVideo", back_populates="game", cascade="all, delete-orphan")
    system_requirements = relationship("GameSystemRequirement", back_populates="game", cascade="all, delete-orphan")
    steam_genres = relationship("GameSteamGenre", back_populates="game", cascade="all, delete-orphan")
    steam_categories = relationship("GameSteamCategory", back_populates="game", cascade="all, delete-orphan")
    igdb_genres = relationship("GameIgdbGenre", back_populates="game", cascade="all, delete-orphan")
    qbit_torrents = relationship("QbitTorrentSync", back_populates="game", cascade="all, delete-orphan")
    protondb_data = relationship("ProtonDBData", back_populates="game", cascade="all, delete-orphan", uselist=False)
    hltb_data = relationship("HowLongToBeatData", back_populates="game", cascade="all, delete-orphan", uselist=False)
    enrichment_sources = relationship("EnrichmentSourceLog", back_populates="game", cascade="all, delete-orphan")
    steamgrid_images = relationship("SteamGridImage", back_populates="game", cascade="all, delete-orphan")


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    wp_category_id = Column(Integer, unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    slug = Column(String(200), nullable=False)
    post_count = Column(Integer, default=0)

    games = relationship("GameCategory", back_populates="category")


class GameCategory(Base):
    __tablename__ = "game_categories"

    game_id = Column(Integer, ForeignKey("games.id", ondelete="CASCADE"), primary_key=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), primary_key=True)

    game = relationship("Game", back_populates="categories")
    category = relationship("Category", back_populates="games")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(Integer, primary_key=True, autoincrement=True)
    wp_tag_id = Column(Integer, unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    slug = Column(String(200), nullable=False)
    post_count = Column(Integer, default=0)

    games = relationship("GameTag", back_populates="tag")


class GameTag(Base):
    __tablename__ = "game_tags"

    game_id = Column(Integer, ForeignKey("games.id", ondelete="CASCADE"), primary_key=True)
    tag_id = Column(Integer, ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True)

    game = relationship("Game", back_populates="tags")
    tag = relationship("Tag", back_populates="games")


class MagnetLink(Base):
    __tablename__ = "magnet_links"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(Integer, ForeignKey("games.id", ondelete="CASCADE"), nullable=False)
    magnet_uri = Column(Text, nullable=False)
    info_hash = Column(String(40), default="")
    source = Column(String(100), default="")
    tracker_count = Column(Integer, default=0)
    index_order = Column(Integer, default=0)

    game = relationship("Game", back_populates="magnet_links")


class TorrentFile(Base):
    __tablename__ = "torrent_files"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(Integer, ForeignKey("games.id", ondelete="CASCADE"), nullable=False)
    torrent_url = Column(String(500), nullable=False)
    source = Column(String(100), default="")
    index_order = Column(Integer, default=0)

    game = relationship("Game", back_populates="torrent_files")


class DownloadMirror(Base):
    __tablename__ = "download_mirrors"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(Integer, ForeignKey("games.id", ondelete="CASCADE"), nullable=False)
    url = Column(String(500), nullable=False)
    mirror_type = Column(String(50), default="")
    filename = Column(String(300), default="")
    index_order = Column(Integer, default=0)

    game = relationship("Game", back_populates="download_mirrors")


class GameScreenshot(Base):
    __tablename__ = "game_screenshots"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(Integer, ForeignKey("games.id", ondelete="CASCADE"), nullable=False)
    thumbnail_url = Column(String(500), default="")
    full_url = Column(String(500), default="")
    index_order = Column(Integer, default=0)

    game = relationship("Game", back_populates="screenshots")


class GameVideo(Base):
    __tablename__ = "game_videos"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(Integer, ForeignKey("games.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(300), default="")
    thumbnail_url = Column(String(500), default="")
    mp4_url = Column(String(500), default="")
    webm_url = Column(String(500), default="")
    dash_url = Column(String(500), default="")
    hls_url = Column(String(500), default="")
    is_highlight = Column(Boolean, default=False)
    index_order = Column(Integer, default=0)

    game = relationship("Game", back_populates="videos")


class GameSystemRequirement(Base):
    __tablename__ = "game_system_requirements"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(Integer, ForeignKey("games.id", ondelete="CASCADE"), nullable=False)
    req_type = Column(String(20), default="minimum")
    os = Column(String(200), default="")
    processor = Column(String(300), default="")
    memory = Column(String(100), default="")
    graphics = Column(String(300), default="")
    directx = Column(String(50), default="")
    storage = Column(String(100), default="")
    notes = Column(String(500), default="")

    game = relationship("Game", back_populates="system_requirements")


class SteamGenre(Base):
    __tablename__ = "steam_genres"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), unique=True, nullable=False)
    slug = Column(String(200), nullable=False)

    games = relationship("GameSteamGenre", back_populates="genre")


class GameSteamGenre(Base):
    __tablename__ = "game_steam_genres"

    game_id = Column(Integer, ForeignKey("games.id", ondelete="CASCADE"), primary_key=True)
    genre_id = Column(Integer, ForeignKey("steam_genres.id", ondelete="CASCADE"), primary_key=True)

    game = relationship("Game", back_populates="steam_genres")
    genre = relationship("SteamGenre", back_populates="games")


class SteamCategory(Base):
    __tablename__ = "steam_categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    steam_category_id = Column(Integer, nullable=False)
    name = Column(String(200), nullable=False)

    games = relationship("GameSteamCategory", back_populates="category")


class GameSteamCategory(Base):
    __tablename__ = "game_steam_categories"

    game_id = Column(Integer, ForeignKey("games.id", ondelete="CASCADE"), primary_key=True)
    category_id = Column(Integer, ForeignKey("steam_categories.id", ondelete="CASCADE"), primary_key=True)

    game = relationship("Game", back_populates="steam_categories")
    category = relationship("SteamCategory", back_populates="games")


class IgdbGenre(Base):
    __tablename__ = "igdb_genres"

    id = Column(Integer, primary_key=True, autoincrement=True)
    igdb_genre_id = Column(Integer, unique=True, nullable=False)
    name = Column(String(200), nullable=False)
    slug = Column(String(200), nullable=False)

    games = relationship("GameIgdbGenre", back_populates="genre")


class GameIgdbGenre(Base):
    __tablename__ = "game_igdb_genres"

    game_id = Column(Integer, ForeignKey("games.id", ondelete="CASCADE"), primary_key=True)
    genre_id = Column(Integer, ForeignKey("igdb_genres.id", ondelete="CASCADE"), primary_key=True)

    game = relationship("Game", back_populates="igdb_genres")
    genre = relationship("IgdbGenre", back_populates="games")


class QbitTorrentSync(Base):
    __tablename__ = "qbittorrent_sync"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(Integer, ForeignKey("download_clients.id", ondelete="CASCADE"), nullable=True)
    game_id = Column(Integer, ForeignKey("games.id", ondelete="CASCADE"), nullable=False)
    info_hash = Column(String(40), nullable=False)
    torrent_name = Column(String(500), default="")
    status = Column(String(50), default="unknown")
    progress = Column(Float, default=0.0)
    size = Column(Integer, default=0)
    dlspeed = Column(Integer, default=0)
    upspeed = Column(Integer, default=0)
    eta = Column(Integer, default=0)
    added_at = Column(DateTime, nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    game = relationship("Game", back_populates="qbit_torrents")
    client = relationship("DownloadClient", back_populates="torrents")


class DownloadClient(Base):
    __tablename__ = "download_clients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    client_type = Column(String(50), nullable=False, default="qbittorrent")
    host = Column(String(500), nullable=False)
    username = Column(String(200), default="")
    password = Column(Text, default="")
    is_enabled = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    extra_config = Column(Text, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    torrents = relationship("QbitTorrentSync", back_populates="client", cascade="all, delete-orphan")


class ProtonDBData(Base):
    __tablename__ = "protondb_data"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(Integer, ForeignKey("games.id", ondelete="CASCADE"), unique=True)
    steam_app_id = Column(Integer, nullable=False)
    deck_tier = Column(String(20), default="unknown")
    proton_tier = Column(String(20), default="")
    confidence = Column(String(20), default="")
    score = Column(Float, nullable=True)
    total_reports = Column(Integer, default=0)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    game = relationship("Game", back_populates="protondb_data")


class HowLongToBeatData(Base):
    __tablename__ = "hltb_data"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(Integer, ForeignKey("games.id", ondelete="CASCADE"), unique=True)
    hltb_game_id = Column(Integer, nullable=True)
    game_name = Column(String(500), default="")
    time_main = Column(Float, nullable=True)
    time_plus = Column(Float, nullable=True)
    time_100 = Column(Float, nullable=True)
    time_all = Column(Float, nullable=True)
    count_main = Column(Integer, nullable=True)
    count_plus = Column(Integer, nullable=True)
    count_100 = Column(Integer, nullable=True)
    count_all = Column(Integer, nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    game = relationship("Game", back_populates="hltb_data")


class EnrichmentSourceLog(Base):
    __tablename__ = "enrichment_source_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(Integer, ForeignKey("games.id", ondelete="CASCADE"), nullable=False)
    source = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False)
    error_message = Column(Text, default="")
    attempted_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    game = relationship("Game", back_populates="enrichment_sources")


class SteamGridImage(Base):
    __tablename__ = "steamgrid_images"

    id = Column(Integer, primary_key=True, autoincrement=True)
    game_id = Column(Integer, ForeignKey("games.id", ondelete="CASCADE"), nullable=False)
    sgdb_game_id = Column(Integer, nullable=True)
    image_type = Column(String(20), nullable=False)
    url = Column(String(500), nullable=False)
    thumbnail_url = Column(String(500), default="")
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    style = Column(String(50), default="")
    is_nsfw = Column(Boolean, default=False)
    is_humor = Column(Boolean, default=False)
    index_order = Column(Integer, default=0)

    game = relationship("Game", back_populates="steamgrid_images")


class ScrapeLog(Base):
    __tablename__ = "scrape_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_date = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    run_type = Column(String(20), default="full")
    pages_scraped = Column(Integer, default=0)
    new_games = Column(Integer, default=0)
    updated_games = Column(Integer, default=0)
    status = Column(String(20), default="running")
    error_message = Column(Text, default="")


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String(100), primary_key=True)
    value = Column(Text, default="")
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class LocalLibraryEntry(Base):
    __tablename__ = "local_library"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(500), default="")
    title = Column(String(500), default="")
    original_name = Column(String(500), default="")
    folder_path = Column(String(1000), default="")
    folder_size = Column(Integer, default=0)
    file_count = Column(Integer, default=0)
    format = Column(String(20), default="unknown")

    game_id = Column(Integer, ForeignKey("games.id", ondelete="SET NULL"), nullable=True)

    steam_app_id = Column(Integer, nullable=True)
    steam_name = Column(String(500), default="")
    igdb_id = Column(Integer, nullable=True)
    description = Column(Text, default="")
    description_full = Column(Text, default="")
    header_image = Column(String(500), default="")
    capsule_image = Column(String(500), default="")
    background_image = Column(String(500), default="")
    metacritic_score = Column(Integer, nullable=True)
    igdb_rating = Column(Float, nullable=True)
    release_date = Column(String(50), default="")

    enrichment_status = Column(String(20), default="none")
    enrichment_matched_at = Column(DateTime, nullable=True)
    igdb_status = Column(String(20), default="none")
    steam_status = Column(String(20), default="none")
    steamgrid_status = Column(String(20), default="none")
    protondb_status = Column(String(20), default="none")
    hltb_status = Column(String(20), default="none")

    sgdb_grid_url = Column(String(500), default="")
    sgdb_hero_url = Column(String(500), default="")
    sgdb_logo_url = Column(String(500), default="")
    sgdb_icon_url = Column(String(500), default="")

    source = Column(String(20), default="scanner")
    is_available = Column(Boolean, default=True)
    notes = Column(Text, default="")

    client_id = Column(Integer, ForeignKey("download_clients.id", ondelete="SET NULL"), nullable=True)
    download_info_hash = Column(String(40), default="")
    download_status = Column(String(20), default="complete")
    download_progress = Column(Float, default=1.0)

    date_added = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    date_scanned = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    date_updated = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    game = relationship("Game", backref="library_entry")
    client = relationship("DownloadClient", backref="library_entries")
    user_entries = relationship("UserLibraryEntry", back_populates="library_entry", cascade="all, delete-orphan")
    system_requirements = relationship("LocalSystemRequirement", back_populates="entry", cascade="all, delete-orphan")
    steam_genres = relationship("LocalSteamGenre", back_populates="entry", cascade="all, delete-orphan")
    igdb_genres = relationship("LocalIgdbGenre", back_populates="entry", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False)
    display_name = Column(String(200), default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    library_entries = relationship("UserLibraryEntry", back_populates="user", cascade="all, delete-orphan")


class UserLibraryEntry(Base):
    __tablename__ = "user_library"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    library_entry_id = Column(Integer, ForeignKey("local_library.id", ondelete="CASCADE"), nullable=False)
    date_added = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="library_entries")
    library_entry = relationship("LocalLibraryEntry", back_populates="user_entries")


class LocalSystemRequirement(Base):
    __tablename__ = "local_system_requirements"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entry_id = Column(Integer, ForeignKey("local_library.id", ondelete="CASCADE"), nullable=False)
    req_type = Column(String(20), default="minimum")
    os = Column(String(200), default="")
    processor = Column(String(300), default="")
    memory = Column(String(100), default="")
    graphics = Column(String(300), default="")
    directx = Column(String(50), default="")
    storage = Column(String(100), default="")
    notes = Column(String(500), default="")

    entry = relationship("LocalLibraryEntry", back_populates="system_requirements")


class LocalSteamGenre(Base):
    __tablename__ = "local_steam_genres"

    entry_id = Column(Integer, ForeignKey("local_library.id", ondelete="CASCADE"), primary_key=True)
    genre_id = Column(Integer, ForeignKey("steam_genres.id", ondelete="CASCADE"), primary_key=True)

    entry = relationship("LocalLibraryEntry", back_populates="steam_genres")
    genre = relationship("SteamGenre", backref="local_entries")


class LocalIgdbGenre(Base):
    __tablename__ = "local_igdb_genres"

    entry_id = Column(Integer, ForeignKey("local_library.id", ondelete="CASCADE"), primary_key=True)
    genre_id = Column(Integer, ForeignKey("igdb_genres.id", ondelete="CASCADE"), primary_key=True)

    entry = relationship("LocalLibraryEntry", back_populates="igdb_genres")
    genre = relationship("IgdbGenre", backref="local_entries")
