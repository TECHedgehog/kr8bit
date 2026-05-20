export interface Category {
  id: number
  name: string
  slug: string
  post_count: number
}

export interface Tag {
  id: number
  name: string
  slug: string
  post_count: number
}

export interface MagnetLink {
  id: number
  magnet_uri: string
  info_hash: string
  source: string
}

export interface TorrentFile {
  id: number
  torrent_url: string
  source: string
}

export interface DownloadMirror {
  id: number
  url: string
  mirror_type: string
  filename: string
}

export interface GameScreenshot {
  id: number
  thumbnail_url: string
  full_url: string
}

export interface GameVideo {
  id: number
  name: string
  thumbnail_url: string
  mp4_url: string
  webm_url: string
  dash_url: string
  hls_url: string
  is_highlight: boolean
}

export interface SystemRequirement {
  id: number
  req_type: string
  os: string
  processor: string
  memory: string
  graphics: string
  directx: string
  storage: string
  notes: string
}

export interface SteamGenre {
  id: number
  name: string
  slug: string
}

export interface IgdbGenre {
  id: number
  name: string
  slug: string
}

export interface SteamCategory {
  id: number
  name: string
}

export interface SteamGridImage {
  id: number
  image_type: 'grid' | 'hero' | 'logo' | 'icon'
  url: string
  thumbnail_url: string
  width: number | null
  height: number | null
  style: string
  is_nsfw: boolean
  is_humor: boolean
}

export interface EnrichmentSourceStatus {
  igdb: string
  steam: string
  steamgrid: string
  protondb: string
  hltb: string
}

export interface EnrichmentModuleStatus {
  igdb: { matched: number; failed: number }
  steam: { matched: number; failed: number }
  steamgrid: { matched: number; failed: number }
  protondb: { matched: number; failed: number }
  hltb: { matched: number; failed: number }
  pending: number
}

export interface EnrichmentStatus {
  is_running: boolean
  modules: Record<string, boolean>
  sources: Record<string, boolean>
  total_games: number
  metadata: EnrichmentModuleStatus
}

export interface QbitTorrent {
  client_id: number | null
  info_hash: string
  torrent_name: string
  status: string
  progress: number
  size: number
  dlspeed: number
  upspeed: number
  eta: number
}

export interface DownloadClient {
  id: number
  name: string
  client_type: 'qbittorrent'
  host: string
  username: string
  is_enabled: boolean
  is_default: boolean
  created_at: string | null
  updated_at: string | null
}

export interface DownloadClientCreate {
  name: string
  client_type: 'qbittorrent'
  host: string
  username: string
  password: string
  is_enabled: boolean
  is_default: boolean
}

export interface DownloadClientUpdate {
  name?: string
  client_type?: 'qbittorrent'
  host?: string
  username?: string
  password?: string
  is_enabled?: boolean
  is_default?: boolean
}

export interface DownloadClientTestRequest {
  client_type: string
  host: string
  username: string
  password: string
}

export interface DownloadClientStatus {
  client_id: number
  name: string
  client_type: string
  connected: boolean
  torrent_count: number
  active_count: number
  paused_count: number
  completed_count: number
  downloading_speed: number
  uploading_speed: number
  error?: string | null
}

export interface AggregateDownloadStatus {
  clients: DownloadClientStatus[]
  total_torrent_count: number
  total_active_count: number
  total_downloading_speed: number
  total_uploading_speed: number
}

export interface ProtonDBData {
  steam_app_id: number
  deck_tier: 'verified' | 'playable' | 'unsupported' | 'unknown'
  proton_tier: string
  confidence: string
  score: number | null
  total_reports: number
  updated_at: string | null
}

export interface HowLongToBeatData {
  time_main: number | null
  time_plus: number | null
  time_100: number | null
  time_all: number | null
  count_main: number | null
  count_plus: number | null
  count_100: number | null
  count_all: number | null
  hltb_url: string
  updated_at: string | null
}

export interface GameListItem {
  id: number
  title: string
  title_original: string
  slug: string
  version: string
  repack_version: string
  edition: string
  dlc_info: string
  group_key: string
  image_url: string
  header_image: string
  capsule_image: string
  sgdb_grid_url: string
  sgdb_hero_url: string
  sgdb_logo_url: string
  sgdb_icon_url: string
  repack_size: string
  original_size: string
  date_published: string
  enrichment: EnrichmentSourceStatus
  igdb_status: string
  steam_status: string
  steamgrid_status: string
  protondb_status: string
  hltb_status: string
  metacritic_score: number | null
  igdb_rating: number | null
  platforms_windows: boolean
  platforms_mac: boolean
  platforms_linux: boolean
  categories: Category[]
  tags: Tag[]
  steam_genres: SteamGenre[]
  igdb_genres: IgdbGenre[]
  qbit_torrents: QbitTorrent[]
  steam_deck_status: string
  protondb_data: ProtonDBData | null
  in_library: boolean
  library_entry_id: number | null
}

export interface GameDetail extends GameListItem {
  title_clean: string
  companies: string
  languages: string
  selective_download: string
  content_html: string
  description: string
  description_full: string
  background_image: string
  steam_app_id: number | null
  steam_name: string
  igdb_id: number | null
  rawg_id: number | null
  release_date_steam: string
  website: string
  date_updated: string
  magnet_links: MagnetLink[]
  torrent_files: TorrentFile[]
  download_mirrors: DownloadMirror[]
  screenshots: GameScreenshot[]
  videos: GameVideo[]
  system_requirements: SystemRequirement[]
  steam_categories: SteamCategory[]
  hltb_data: HowLongToBeatData | null
  steamgrid_images: SteamGridImage[]
}

export interface GameSearchResult {
  id: number
  title: string
  slug: string
  header_image: string
  date_published: string
  enrichment: EnrichmentSourceStatus
}

export interface GameListResponse {
  items: GameListItem[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface Stats {
  total_games: number
  total_enriched: number
  total_unmatched: number
  total_failed: number
  total_categories: number
  total_tags: number
  last_scrape: string | null
  qbit_connected: boolean
  qbit_torrent_count: number
  qbit_active_count: number
}

export interface ScrapeStatus {
  is_running: boolean
  last_run: string | null
  last_status: string | null
  last_pages: number | null
  total_games: number
}

export interface EnrichmentStatus {
  is_running: boolean
  total_games: number
  enriched_igdb: number
  enriched_steam: number
  unmatched: number
  failed: number
  last_run: string | null
}

export interface QbitStatus {
  connected: boolean
  torrent_count: number
  active_count: number
  paused_count: number
  completed_count: number
  downloading_speed: number
  uploading_speed: number
}

export interface IgdbSearchResult {
  igdb_id: number
  name: string
  cover_url: string
  first_release_date: number | null
}

export interface LocalLibraryEntry {
  id: number
  name: string
  title: string
  original_name: string
  folder_path: string
  folder_size: number
  file_count: number
  format: string
  game_id: number | null
  steam_app_id: number | null
  steam_name: string
  igdb_id: number | null
  description: string
  header_image: string
  capsule_image: string
  background_image: string
  sgdb_grid_url: string
  sgdb_hero_url: string
  sgdb_logo_url: string
  sgdb_icon_url: string
  metacritic_score: number | null
  igdb_rating: number | null
  release_date: string
  enrichment: EnrichmentSourceStatus
  source: string
  is_available: boolean
  notes: string
  client_id: number | null
  download_info_hash: string
  download_status: string
  download_progress: number
  date_added: string
  date_scanned: string
  date_updated: string
}

export interface LocalLibraryEntryDetail extends LocalLibraryEntry {
  description_full: string
  system_requirements: SystemRequirement[]
  steam_genres: SteamGenre[]
  igdb_genres: IgdbGenre[]
  game: GameSearchResult | null
  steamgrid_images: SteamGridImage[]
}

export interface UserLibraryEntry {
  id: number
  user_id: number | null
  library_entry_id: number
  date_added: string
  library_entry: LocalLibraryEntry | null
}

export interface LibraryStats {
  total_library_games: number
  total_user_games: number
  total_size: number
  downloading_count: number
  matched_count: number
  unmatched_count: number
  available_count: number
  unavailable_count: number
}

export interface FileEntry {
  name: string
  path: string
  size: number
  is_dir: boolean
  modified: string | null
}

export interface LibraryListResponse {
  items: LocalLibraryEntry[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface UserLibraryListResponse {
  items: UserLibraryEntry[]
  total: number
  page: number
  per_page: number
  total_pages: number
}

export interface DownloadItem {
  info_hash: string
  torrent_name: string
  status: string
  progress: number
  size: number
  dlspeed: number
  upspeed: number
  eta: number
  client_id: number | null
  client_name: string
  game_id: number | null
}

export interface DownloadListResponse {
  items: DownloadItem[]
  total: number
  active_count: number
  completed_count: number
  total_dl_speed: number
  total_ul_speed: number
}

export interface SmartAddRequest {
  game_id: number
  client_id?: number | null
}

