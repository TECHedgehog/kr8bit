from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class CategoryOut(BaseModel):
    id: int
    name: str
    slug: str
    post_count: int

    class Config:
        from_attributes = True


class TagOut(BaseModel):
    id: int
    name: str
    slug: str
    post_count: int

    class Config:
        from_attributes = True


class MagnetLinkOut(BaseModel):
    id: int
    magnet_uri: str
    info_hash: str
    source: str

    class Config:
        from_attributes = True


class TorrentFileOut(BaseModel):
    id: int
    torrent_url: str
    source: str

    class Config:
        from_attributes = True


class DownloadMirrorOut(BaseModel):
    id: int
    url: str
    mirror_type: str
    filename: str

    class Config:
        from_attributes = True


class GameScreenshotOut(BaseModel):
    id: int
    thumbnail_url: str
    full_url: str

    class Config:
        from_attributes = True


class GameVideoOut(BaseModel):
    id: int
    name: str
    thumbnail_url: str
    mp4_url: str
    webm_url: str
    dash_url: str
    hls_url: str
    is_highlight: bool

    class Config:
        from_attributes = True


class SystemRequirementOut(BaseModel):
    id: int
    req_type: str
    os: str
    processor: str
    memory: str
    graphics: str
    directx: str
    storage: str
    notes: str

    class Config:
        from_attributes = True


class SteamGenreOut(BaseModel):
    id: int
    name: str
    slug: str

    class Config:
        from_attributes = True


class IgdbGenreOut(BaseModel):
    id: int
    name: str
    slug: str

    class Config:
        from_attributes = True


class SteamCategoryOut(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True


class SteamGridImageOut(BaseModel):
    id: int
    image_type: str
    url: str
    thumbnail_url: str
    width: int | None = None
    height: int | None = None
    style: str = ""
    is_nsfw: bool = False
    is_humor: bool = False

    class Config:
        from_attributes = True


class EnrichmentSourceStatus(BaseModel):
    igdb: str = "none"
    steam: str = "none"
    steamgrid: str = "none"
    protondb: str = "none"
    hltb: str = "none"


class QbitTorrentSyncOut(BaseModel):
    client_id: int | None = None
    info_hash: str
    torrent_name: str
    status: str
    progress: float
    size: int
    dlspeed: int
    upspeed: int
    eta: int

    class Config:
        from_attributes = True


class ProtonDBOut(BaseModel):
    steam_app_id: int
    deck_tier: str
    proton_tier: str
    confidence: str
    score: float | None = None
    total_reports: int
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class HowLongToBeatOut(BaseModel):
    time_main: float | None = None
    time_plus: float | None = None
    time_100: float | None = None
    time_all: float | None = None
    count_main: int | None = None
    count_plus: int | None = None
    count_100: int | None = None
    count_all: int | None = None
    hltb_url: str = ""
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class GameListItem(BaseModel):
    id: int
    title: str
    title_original: str = ""
    slug: str
    version: str
    repack_version: str = ""
    edition: str = ""
    dlc_info: str = ""
    group_key: str = ""
    image_url: str
    header_image: str
    capsule_image: str
    sgdb_grid_url: str = ""
    sgdb_hero_url: str = ""
    sgdb_logo_url: str = ""
    sgdb_icon_url: str = ""
    repack_size: str
    original_size: str
    date_published: datetime
    enrichment: EnrichmentSourceStatus = EnrichmentSourceStatus()
    igdb_status: str = "none"
    steam_status: str = "none"
    steamgrid_status: str = "none"
    protondb_status: str = "none"
    hltb_status: str = "none"
    metacritic_score: Optional[int] = None
    igdb_rating: Optional[float] = None
    platforms_windows: bool
    platforms_mac: bool
    platforms_linux: bool
    categories: list[CategoryOut] = []
    tags: list[TagOut] = []
    steam_genres: list[SteamGenreOut] = []
    igdb_genres: list[IgdbGenreOut] = []
    qbit_torrents: list[QbitTorrentSyncOut] = []
    steam_deck_status: str = ""
    protondb_data: ProtonDBOut | None = None
    in_library: bool = False
    library_entry_id: int | None = None

    class Config:
        from_attributes = True


class GameDetail(GameListItem):
    title_clean: str
    companies: str
    languages: str
    selective_download: str
    content_html: str
    description: str
    description_full: str
    background_image: str
    steam_app_id: Optional[int] = None
    steam_name: str
    igdb_id: Optional[int] = None
    rawg_id: Optional[int] = None
    release_date_steam: str = ""
    website: str = ""
    date_updated: Optional[datetime] = None
    steam_rating_percent: Optional[int] = None
    steam_rating_count: Optional[int] = None
    igdb_rating_count: Optional[int] = None
    steam_deck_status: str = ""
    magnet_links: list[MagnetLinkOut] = []
    torrent_files: list[TorrentFileOut] = []
    download_mirrors: list[DownloadMirrorOut] = []
    screenshots: list[GameScreenshotOut] = []
    videos: list[GameVideoOut] = []
    system_requirements: list[SystemRequirementOut] = []
    steam_categories: list[SteamCategoryOut] = []
    hltb_data: HowLongToBeatOut | None = None
    steamgrid_images: list[SteamGridImageOut] = []

    class Config:
        from_attributes = True


class GameSearchResult(BaseModel):
    id: int
    title: str
    slug: str
    header_image: str
    date_published: datetime
    enrichment: EnrichmentSourceStatus = EnrichmentSourceStatus()

    class Config:
        from_attributes = True


class GameGroupInfo(BaseModel):
    group_key: str
    display_title: str
    game_count: int
    best_image: str = ""
    enrichment: EnrichmentSourceStatus = EnrichmentSourceStatus()
    metacritic_score: Optional[int] = None
    igdb_rating: Optional[float] = None

    class Config:
        from_attributes = True


class GameListResponse(BaseModel):
    items: list[GameListItem]
    total: int
    page: int
    per_page: int
    total_pages: int


class StatsOut(BaseModel):
    total_games: int
    total_enriched: int
    total_unmatched: int
    total_failed: int
    total_categories: int
    total_tags: int
    last_scrape: Optional[datetime] = None
    qbit_connected: bool = False
    qbit_torrent_count: int = 0
    qbit_active_count: int = 0


class ScrapeStatusOut(BaseModel):
    is_running: bool
    last_run: Optional[datetime] = None
    last_status: Optional[str] = None
    last_pages: Optional[int] = None
    total_games: int


class EnrichmentModuleStatus(BaseModel):
    igdb: dict[str, int]
    steam: dict[str, int]
    steamgrid: dict[str, int]
    protondb: dict[str, int]
    hltb: dict[str, int]
    pending: int


class EnrichmentStatusOut(BaseModel):
    is_running: bool
    modules: dict[str, bool] = {}
    sources: dict[str, bool] = {}
    total_games: int
    metadata: EnrichmentModuleStatus


class EnrichmentRunRequest(BaseModel):
    module: str | None = None
    sources: list[str] = []


class EnrichmentSourceLogOut(BaseModel):
    game_id: int
    source: str
    status: str
    error_message: str = ""
    attempted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FailedEnrichmentItem(BaseModel):
    game_id: int
    title: str
    enrichment: EnrichmentSourceStatus = EnrichmentSourceStatus()
    igdb_id: Optional[int] = None
    steam_app_id: Optional[int] = None
    error_message: str = ""
    attempted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class QbitStatusOut(BaseModel):
    connected: bool
    torrent_count: int
    active_count: int
    paused_count: int
    completed_count: int
    downloading_speed: float
    uploading_speed: float


class EnrichmentLogOut(BaseModel):
    game_id: int
    title: str
    clean_title: str = ""
    status: str
    matched_via: str = "none"
    igdb_id: Optional[int] = None
    steam_app_id: Optional[int] = None
    search_variants: str = ""
    error_message: str = ""
    attempted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FailedEnrichmentItem(BaseModel):
    game_id: int
    title: str
    clean_title: str = ""
    status: str
    matched_via: str = "none"
    igdb_id: Optional[int] = None
    steam_app_id: Optional[int] = None
    search_variants: str = ""
    error_message: str = ""
    attempted_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FailedEnrichmentResponse(BaseModel):
    items: list[FailedEnrichmentItem]
    total: int
    page: int
    per_page: int
    total_pages: int


class EnrichmentLogFileResponse(BaseModel):
    content: str
    line_count: int


class ManualMatchRequest(BaseModel):
    game_id: int
    igdb_id: Optional[int] = None
    steam_app_id: Optional[int] = None


class DownloadClientTestRequest(BaseModel):
    client_type: str = "qbittorrent"
    host: str
    username: str = ""
    password: str = ""


class DownloadClientCreate(BaseModel):
    name: str
    client_type: str = "qbittorrent"
    host: str
    username: str = ""
    password: str = ""
    is_enabled: bool = True
    is_default: bool = False


class DownloadClientUpdate(BaseModel):
    name: str | None = None
    client_type: str | None = None
    host: str | None = None
    username: str | None = None
    password: str | None = None
    is_enabled: bool | None = None
    is_default: bool | None = None


class DownloadClientOut(BaseModel):
    id: int
    name: str
    client_type: str
    host: str
    username: str
    is_enabled: bool
    is_default: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None

    class Config:
        from_attributes = True


class DownloadClientStatusOut(BaseModel):
    client_id: int
    name: str
    client_type: str
    connected: bool
    torrent_count: int
    active_count: int
    paused_count: int
    completed_count: int
    downloading_speed: float
    uploading_speed: float
    error: str | None = None


class AggregateDownloadStatusOut(BaseModel):
    clients: list[DownloadClientStatusOut]
    total_torrent_count: int
    total_active_count: int
    total_downloading_speed: float
    total_uploading_speed: float


class LocalSystemRequirementOut(BaseModel):
    id: int
    req_type: str
    os: str
    processor: str
    memory: str
    graphics: str
    directx: str
    storage: str
    notes: str

    class Config:
        from_attributes = True


class LocalGenreOut(BaseModel):
    id: int
    name: str
    slug: str

    class Config:
        from_attributes = True


class LocalLibraryEntryOut(BaseModel):
    id: int
    name: str
    title: str
    original_name: str = ""
    folder_path: str
    folder_size: int
    file_count: int
    format: str
    game_id: int | None = None
    steam_app_id: int | None = None
    steam_name: str = ""
    igdb_id: int | None = None
    description: str = ""
    header_image: str = ""
    capsule_image: str = ""
    background_image: str = ""
    sgdb_grid_url: str = ""
    sgdb_hero_url: str = ""
    sgdb_logo_url: str = ""
    sgdb_icon_url: str = ""
    metacritic_score: int | None = None
    igdb_rating: float | None = None
    release_date: str = ""
    enrichment: EnrichmentSourceStatus = EnrichmentSourceStatus()
    source: str
    is_available: bool
    notes: str = ""
    client_id: int | None = None
    download_info_hash: str = ""
    download_status: str
    download_progress: float
    date_added: datetime | None = None
    date_scanned: datetime | None = None
    date_updated: datetime | None = None

    class Config:
        from_attributes = True


class LocalLibraryEntryDetail(LocalLibraryEntryOut):
    description_full: str = ""
    system_requirements: list[LocalSystemRequirementOut] = []
    steam_genres: list[LocalGenreOut] = []
    igdb_genres: list[LocalGenreOut] = []
    game: GameSearchResult | None = None
    steamgrid_images: list[SteamGridImageOut] = []

    class Config:
        from_attributes = True


class UserLibraryEntryOut(BaseModel):
    id: int
    user_id: int | None = None
    library_entry_id: int
    date_added: datetime | None = None
    library_entry: LocalLibraryEntryOut | None = None

    class Config:
        from_attributes = True


class LibraryStatsOut(BaseModel):
    total_library_games: int
    total_user_games: int
    total_size: int
    downloading_count: int
    matched_count: int
    unmatched_count: int
    available_count: int
    unavailable_count: int


class FileEntryOut(BaseModel):
    name: str
    path: str
    size: int
    is_dir: bool
    modified: datetime | None = None


class LibraryListResponse(BaseModel):
    items: list[LocalLibraryEntryOut]
    total: int
    page: int
    per_page: int
    total_pages: int


class UserLibraryListResponse(BaseModel):
    items: list[UserLibraryEntryOut]
    total: int
    page: int
    per_page: int
    total_pages: int


class DownloadItemOut(BaseModel):
    info_hash: str
    torrent_name: str
    status: str
    progress: float
    size: int
    dlspeed: int
    upspeed: int
    eta: int
    client_id: int | None = None
    client_name: str = ""
    game_id: int | None = None


class DownloadListResponse(BaseModel):
    items: list[DownloadItemOut]
    total: int
    active_count: int
    completed_count: int
    total_dl_speed: float
    total_ul_speed: float


class SmartAddRequest(BaseModel):
    game_id: int
    client_id: int | None = None


class ManualMatchRequest(BaseModel):
    game_id: int
    igdb_id: int | None = None
    steam_app_id: int | None = None

