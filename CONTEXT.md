# Kr8bit - Project Context

## Overview

Self-hosted game library manager that scrapes game repacks from WordPress sites (e.g. FitGirl Repacks), enriches them with metadata (IGDB, Steam), manages a local game library on your NAS, and provides a web UI to browse/search/filter games with qBittorrent integration for one-click magnet downloads. Replaces GameVault as your personal game library. Designed to expand to ROM libraries for retro consoles in the future.

## Tech Stack

- **Backend**: Python 3.12, FastAPI, SQLAlchemy (async + aiosqlite), Pydantic v2, httpx, BeautifulSoup4, thefuzz, qbittorrent-api, APScheduler
- **Frontend**: React 19, TypeScript, Vite 8, TanStack Query v5, React Router v7, TailwindCSS v4, Axios, Lucide React icons
- **Database**: SQLite with FTS5 (async via aiosqlite)
- **Deployment**: Docker Compose (backend + frontend nginx + qbittorrent)

## Directory Structure

```
/Users/eric/Documents/Projects/FitGirl Repacks/
├── .env.example
├── .gitignore
├── README.md
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── data/
│   └── app/
│       ├── __init__.py
│       ├── main.py
│       ├── config.py
│       ├── database.py
│       ├── models.py
│       ├── schemas.py
    │       ├── routers/
    │       │   ├── __init__.py
    │       │   ├── games.py
    │       │   ├── categories.py
    │       │   ├── tags.py
    │       │   ├── enrichment.py
    │       │   ├── qbittorrent.py
    │       │   ├── download_clients.py
    │       │   ├── library.py
    │       │   ├── user_library.py
    │       │   ├── downloads.py
    │       │   ├── scraper.py
    │       │   └── settings.py
    │       └── services/
    │           ├── __init__.py
    │           ├── scraper.py
    │           ├── parser.py
    │           ├── enrichment.py
    │           ├── steam_client.py
    │           ├── rawg_client.py
    │           ├── title_matcher.py
    │           ├── qbittorrent.py
    │           └── library_scanner.py
├── frontend/
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── types/index.ts
│       ├── api/
│       ├── components/
│       │   ├── games/
│       │   ├── layout/
│       │   ├── qbittorrent/
│       │   ├── settings/
│       │   └── ui/
    │       └── pages/
    │           ├── LocalLibrary.tsx
    │           ├── LibraryDetailPage.tsx
    │           ├── DownloadsPage.tsx
    │           ├── GameCatalog.tsx
    │           ├── GameDetailPage.tsx
    │           └── SettingsPage.tsx
```

## Database Schema

Core tables:
- **games**: id, wp_post_id, title, title_clean, title_original, slug, version, repack_version (was fitgirl_version), edition, dlc_info, group_key, companies, languages, original_size, repack_size, selective_download, image_url, content_html, content_text, date_published, steam_app_id, steam_name, igdb_id, rawg_id, description, description_full, header_image, capsule_image, background_image, metacritic_score, steam_rating_percent, igdb_rating, release_date_steam, website, platforms_windows/mac/linux, enrichment_status
- **categories**: id, wp_category_id, name, slug, post_count
- **tags**: id, wp_tag_id, name, slug, post_count
- **magnet_links**: id, game_id, magnet_uri, info_hash, source, tracker_count, index_order
- **torrent_files**: id, game_id, torrent_url, source, index_order
- **download_mirrors**: id, game_id, url, mirror_type, filename, index_order
- **game_screenshots**: id, game_id, thumbnail_url, full_url, index_order
- **game_videos**: id, game_id, name, thumbnail_url, mp4_url, webm_url, dash_url, hls_url, is_highlight, index_order
- **game_system_requirements**: id, game_id, req_type, os, processor, memory, graphics, directx, storage, notes
- **steam_genres**, **game_steam_genres**, **steam_categories**, **game_steam_categories**
- **igdb_genres**, **game_igdb_genres**
- **protondb_data**, **hltb_data**, **enrichment_logs**
- **qbittorrent_sync**: id, client_id, game_id, info_hash, torrent_name, status, progress, size, dlspeed, upspeed, eta
- **download_clients**: id, name, client_type, host, username, password, is_enabled, is_default
- **local_library**: id, name, title, original_name, folder_path, folder_size, file_count, format, game_id, steam_app_id, steam_name, igdb_id, description, description_full, header_image, capsule_image, background_image, metacritic_score, igdb_rating, release_date, enrichment_status, source, is_available, notes, client_id, download_info_hash, download_status, download_progress, date_added, date_scanned, date_updated
- **users**: id, username, display_name, created_at
- **user_library**: id, user_id, library_entry_id, date_added
- **local_system_requirements**: id, entry_id, req_type, os, processor, memory, graphics, directx, storage, notes
- **local_steam_genres**: entry_id, genre_id
- **local_igdb_genres**: entry_id, genre_id
- **scrape_logs**: id, run_date, run_type, pages_scraped, new_games, updated_games, status, error_message
- **settings**: key, value, updated_at

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/games` | Paginated list with filters |
| GET | `/api/games/{id}` | Full game detail |
| GET | `/api/games/group/{group_key}` | Games in a group |
| GET | `/api/search?q=` | Text search |
| GET | `/api/stats` | Dashboard stats |
| GET | `/api/categories` | All categories |
| GET | `/api/tags?search=` | Tags with search |
| GET | `/api/enrichment/status` | Enrichment progress |
| POST | `/api/enrichment/run` | Run enrichment |
| POST | `/api/enrichment/run/{game_id}` | Enrich single game |
| POST | `/api/enrichment/match` | Manual match |
| GET | `/api/qbittorrent/status` | Connection status |
| POST | `/api/qbittorrent/add?magnet_uri=` | Add magnet |
| GET | `/api/download-clients` | List download clients |
| GET | `/api/library` | List local library entries |
| GET | `/api/library/stats` | Library stats |
| GET | `/api/library/{id}` | Library entry detail |
| GET | `/api/library/{id}/files` | File browser |
| GET | `/api/library/{id}/download` | Download file |
| POST | `/api/library/scan` | Trigger scan |
| PUT | `/api/library/{id}` | Edit library entry |
| DELETE | `/api/library/{id}` | Remove from library |
| POST | `/api/library/{id}/match` | Match to FitGirl game |
| POST | `/api/library/{id}/move` | Move to permanent library |
| GET | `/api/user/library` | User's library |
| POST | `/api/user/library/add` | Add to user library |
| POST | `/api/user/library/add-from-catalog` | Smart add from catalog |
| DELETE | `/api/user/library/{id}` | Remove from user library |
| GET | `/api/downloads` | Active downloads |
| GET | `/api/scraper/status` | Scraper status |
| POST | `/api/scraper/run` | Trigger full scrape |
| POST | `/api/scraper/reset` | Reset all data |

## Scraping Pipeline

1. Fetch categories, tags, posts from WordPress REST API
2. Parse each post HTML to extract: title, version, companies, languages, sizes, magnets, torrents, mirrors
3. Compute group_key for grouping related editions
4. Upsert to DB, create/update related entities

## Enrichment Pipeline

1. clean_title() strips version numbers, editions, DLC counts from titles
2. Search IGDB for matches
3. Fetch IGDB metadata (screenshots, videos, descriptions, genres, ratings)
4. Fallback to Steam Store API
5. Mark failed if no match found

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./data/kr8bit.db` | SQLite DB path |
| `SCRAPER_BASE_URL` | `https://fitgirl-repacks.site` | WP site URL |
| `SCRAPER_POSTS_PER_PAGE` | `100` | Posts per API request |
| `SCRAPER_DELAY_SECONDS` | `1.0` | Delay between requests |
| `SCRAPE_INTERVAL_HOURS` | `6` | Auto-scrape interval (0 to disable) |
| `QBITTORRENT_HOST` | `http://localhost:8090` | qBit WebUI URL |
| `QBITTORRENT_USER` | `admin` | qBit username |
| `QBITTORRENT_PASS` | `adminadmin` | qBit password |
| `QBIT_SYNC_INTERVAL_SECONDS` | `30` | qBit sync interval |
| `ENRICHMENT_ENABLED` | `true` | Enable enrichment |
| `STEAM_MATCH_THRESHOLD` | `0.7` | Fuzzy match confidence |
| `ENRICHMENT_BATCH_SIZE` | `50` | Games per batch |
| `ENRICHMENT_DELAY_SECONDS` | `2.0` | Rate limit |
| `ENRICHMENT_CONCURRENCY` | `10` | Concurrent enrichment tasks |
| `IGDB_RATE_LIMIT` | `4` | IGDB requests per second |
| `TWITCH_CLIENT_ID` | `` | Twitch client ID |
| `TWITCH_CLIENT_SECRET` | `` | Twitch client secret |
| `LIBRARY_PATH` | `/library` | NAS library mount path |
| `DOWNLOADS_PATH` | `/downloads` | qBit download zone path |
| `LIBRARY_SCAN_INTERVAL_HOURS` | `0` | Auto-scan interval (0=manual) |
| `CORS_ORIGINS` | `["*"]` | Allowed CORS origins |

## Running in Development

```bash
# Backend
cd backend && source ../venv/bin/activate && uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev
```

## Running with Docker

```bash
docker compose up -d
```

- Frontend: http://localhost:8080
- Backend API: http://localhost:8000
- qBittorrent WebUI: http://localhost:8090