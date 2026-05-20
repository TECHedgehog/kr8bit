# Kr8bit

Self-hosted game library manager that scrapes, indexes, and enriches game repacks with metadata and qBittorrent integration.

## Features

- **Scraping** - Fetches all game posts via the configured WordPress REST API
- **Search** - Full-text search across game titles and descriptions
- **Filtering** - By category, tags, platform, metacritic score, ratings
- **Metadata Enrichment** - Automatically matches games to IGDB/Steam and fetches images, videos, descriptions, system requirements, genres, ratings
- **qBittorrent Integration** - Two-way sync: send magnets to qBit, see download progress in the UI
- **Dockerized** - Ready for Unraid deployment

## Quick Start

### Prerequisites
- Docker & Docker Compose
- qBittorrent (optional - can use existing installation)

### Configuration

1. Copy `.env.example` to `.env` and edit:
```bash
cp .env.example .env
```

2. Set your qBittorrent credentials:
```
QBITTORRENT_HOST=http://your-unraid-ip:8090
QBITTORRENT_USER=admin
QBITTORRENT_PASS=yourpassword
```

### Run

```bash
docker compose up -d
```

Access: http://localhost:8080

### First Run

1. Open the **Scraper** page (`/scraper`)
2. Click **"Start Initial Scrape"** - this downloads all game entries (~1-2 minutes)
3. Click **"Run Enrichment"** - this matches games against IGDB/Steam (throttled)
4. Browse games at `/games`

## Unraid Deployment

### Method 1: Docker Compose (recommended)

Add this as a "Docker Compose" stack in Unraid's Docker section, or use the CLI:

```bash
# On the Unraid server
git clone https://github.com/yourusername/kr8bit
cd kr8bit
docker compose up -d
```

### Method 2: Individual containers

Create a container for the backend using the Dockerfile in `/backend`:

- Repository: `https://github.com/yourusername/kr8bit`
- Container path: `/app/data`
- Host path: `/mnt/user/appdata/kr8bit/data`
- Port: `8000`

Create a container for the frontend using the Dockerfile in `/frontend`:

- Port: `8080`

Set environment variables for the backend container (see `.env.example`).

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/games` | Paginated game list with filters |
| GET | `/api/games/{id}` | Full game detail |
| GET | `/api/search?q=` | Text search |
| GET | `/api/categories` | All categories |
| GET | `/api/tags` | Tags with optional search |
| GET | `/api/stats` | Dashboard statistics |
| GET | `/api/enrichment/status` | Enrichment progress |
| POST | `/api/enrichment/run` | Run enrichment on all unmatched |
| POST | `/api/enrichment/run/{game_id}` | Enrich single game |
| POST | `/api/enrichment/match` | Manual IGDB/Steam match |
| GET | `/api/qbittorrent/status` | qBit connection status |
| POST | `/api/qbittorrent/add?magnet_uri=` | Add magnet to qBit |
| GET | `/api/scraper/status` | Scraper status |
| POST | `/api/scraper/run` | Trigger full scrape |
| POST | `/api/scraper/full` | Full scrape with logging |

## Project Structure

```
├── backend/           # Python FastAPI backend
│   ├── app/
│   │   ├── main.py           # App entry, CORS, lifespan
│   │   ├── config.py         # Settings via env vars
│   │   ├── database.py       # SQLAlchemy async setup
│   │   ├── models.py         # All ORM models
│   │   ├── schemas.py        # Pydantic request/response schemas
│   │   ├── routers/          # API endpoints
│   │   │   ├── games.py
│   │   │   ├── scraper.py
│   │   │   ├── enrichment.py
│   │   │   └── qbittorrent.py
│   │   └── services/         # Business logic
│   │       ├── scraper.py    # WP REST API client
│   │       ├── parser.py     # HTML parsing for magnets/links
│   │       ├── enrichment.py # IGDB/Steam enrichment pipeline
│   │       ├── title_matcher.py
│   │       └── qbittorrent.py
│   └── requirements.txt
├── frontend/          # React + Vite + Tailwind frontend
│   ├── src/
│   │   ├── api/        # API client + React Query hooks
│   │   ├── components/ # UI components
│   │   ├── pages/      # Dashboard, Catalog, Detail, Scraper
│   │   └── types/      # TypeScript interfaces
│   └── Dockerfile
├── docker-compose.yml
└── .env.example
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./data/kr8bit.db` | SQLite database path |
| `SCRAPER_BASE_URL` | `https://fitgirl-repacks.site` | WordPress site URL |
| `SCRAPER_DELAY_SECONDS` | `1.0` | Delay between API calls during scrape |
| `SCRAPE_INTERVAL_HOURS` | `6` | Auto-scrape interval (0 to disable) |
| `QBITTORRENT_HOST` | `http://localhost:8090` | qBittorrent WebUI URL |
| `QBITTORRENT_USER` | `admin` | qBittorrent username |
| `QBITTORRENT_PASS` | `adminadmin` | qBittorrent password |
| `ENRICHMENT_ENABLED` | `true` | Enable metadata enrichment |
| `STEAM_MATCH_THRESHOLD` | `0.7` | Fuzzy match confidence (0-1) |
| `IGDB_RATE_LIMIT` | `4` | IGDB API rate limit |
| `TWITCH_CLIENT_ID` | `` | Twitch client ID (for IGDB) |
| `TWITCH_CLIENT_SECRET` | `` | Twitch client secret (for IGDB) |

## License

MIT