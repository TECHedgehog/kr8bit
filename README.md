# kr8bit

Self-hosted game library manager — kind of like Jellyfin for games.

Scans local installer folders, fetches Steam metadata + artwork, and lets you organize your library through a web UI. Runs in a single Docker container.

## Status

v1 (minimal). Built for Unraid, Docker Compose, Portainer, Proxmox, TrueNAS SCALE.

## What it does

- Scans a library root for:
  - `.7z` files (one game per archive)
  - Directories containing `setup.exe` (unpacked installers)
- Fuzzy-matches folder/archive names against the Steam app list (IGDB as a second provider when configured)
- Auto-accepts matches scored ≥ 85, flags 70-84, leaves < 70 pending
- Downloads metadata + artwork (cached locally on disk)
- Serves a web UI for browsing, filtering, and searching your library

## Quick start (Docker)

```bash
docker run -d \
  --name kr8bit \
  -p 8080:8080 \
  -v /path/to/your/games:/games:ro \
  -v ./kr8bit-data:/data \
  ghcr.io/techedgehog/kr8bit:latest
```

Open `http://localhost:8080` and click **Start scan**.

## Unraid

1. Install the kr8bit template via Community Applications (or paste the GitHub URL into `Apps → Install from URL`).
2. Configure:
   - **HTTP Port**: defaults to `8080`
   - **Library Path**: path to your games folder (read-only is fine)
   - **Data Path**: persistent storage for DB + artwork cache
3. Start the container, open the WebUI, and scan.

## Docker Compose

See `docker-compose.example.yml`:

```bash
cp docker-compose.example.yml docker-compose.yml
# edit game path + data path
docker compose up -d
```

## Configuration

All settings are environment variables. Defaults shown.

| Variable | Default | Description |
|---|---|---|
| `LIBRARY_ROOT` | `/games` | Path to scan for installer archives/folders |
| `CACHE_DIR` | `/data/cache` | Where artwork + Steam index live |
| `DB_PATH` | `/data/kr8bit.db` | SQLite database file (the Prisma URL is derived from this) |
| `PORT` | `8080` | HTTP server port |
| `HOST` | `0.0.0.0` | HTTP server bind host |
| `LOG_LEVEL` | `info` | `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace` |
| `STEAM_INDEX_REFRESH_INTERVAL_HOURS` | `24` | Steam app list refresh interval in hours |

Optional provider keys (`STEAM_API_KEY`, `STEAMGRIDDB_API_KEY`, `IGDB_CLIENT_ID`/`IGDB_CLIENT_SECRET`) and further tuning knobs are listed in [`.env.example`](./.env.example).

## Match workflow

| Score | Status | Behaviour |
|---|---|---|
| ≥ 85 | `ACCEPTED` | Auto-accepted, metadata + artwork fetched |
| 70-84 | `FLAGGED` | Auto-accepted but flagged for review |
| < 70 | `PENDING` | Picked up by the periodic retry-match job |
| (assign via API) | `MANUAL` | Match set explicitly through the assign endpoint |
| (explicit unlink) | `REJECTED` | Cleared back to `PENDING` |

## API

All endpoints under `/api/*`:

```
GET    /api/health
GET    /api/settings
PUT    /api/settings
POST   /api/scanner/run                       (202; 409 if already running)
GET    /api/scanner/status
GET    /api/scanner/progress                  (SSE)
GET    /api/games                             (?search=, ?genre=, ?deck=, ?sort=, ?limit=, ?offset=)
GET    /api/games/genres
GET    /api/games/:id
PATCH  /api/games/:id
DELETE /api/games/:id
POST   /api/games/:id/metadata/search
POST   /api/games/:id/metadata/assign
POST   /api/games/:id/metadata/refresh
DELETE /api/games/:id/metadata
GET    /api/games/:id/artwork/:kind            (kind = header | cover | hero | logo)
POST   /api/metadata/refresh-all               (202; 409 if already running)
GET    /api/metadata/refresh-all/status
POST   /api/metadata/retry-matches             (202; 409 if already running)
GET    /api/metadata/retry-matches/status
POST   /api/metadata/index/refresh
GET    /api/metadata/search-steam?q=
POST   /api/database/reset
POST   /api/database/cleanup
```

Error envelope:

```json
{
  "statusCode": 404,
  "code": "NOT_FOUND",
  "error": "NotFoundError",
  "message": "Game not found: abc"
}
```

## Local development

```bash
npm install
npx prisma generate
npx prisma migrate dev
cp .env.example .env       # adjust paths
npm run dev                # backend with hot reload via tsx watch

# separate shell for web ui
cd web
npm install
npm run dev                # vite dev server at :5173 (proxies /api → :8080)
```

### Testing

```bash
npm test                    # vitest run
npm run typecheck           # tsc --noEmit
npm run lint                # eslint
```

## Tech stack

- Backend: Node 20 / TypeScript / Fastify / Prisma / SQLite
- Frontend: Vite + React 18 + TypeScript, plain CSS
- Matching: Fuse.js fuzzy against cached Steam app list
- HTTP: undici
- Container: `node:20-slim` + `p7zip-full` + `tini`

## Documentation

Detailed docs live in [`docs/`](./docs):

- [`architecture.md`](./docs/architecture.md) — module layout, dependency flow, runtime model.
- [`api.md`](./docs/api.md) — HTTP endpoints (scan, library, metadata, settings, health).
- [`providers.md`](./docs/providers.md) — how metadata / download providers plug in.
- [`decisions.md`](./docs/decisions.md) — ADR-style log of significant choices.
- [`roadmap.md`](./docs/roadmap.md) — phased plan, ordered by dependency.

## Architecture

```
Route → Controller → Service → Repository / Provider → Database
```

- **Services** own business logic.
- **Repositories** only persist data.
- **Providers** normalize external APIs (Steam, IGDB, SteamGridDB). Adding a new provider = new file.
- **Scanner** walks the library, normalizes names, matches via providers, applies match policy.
- **ArtworkService** keeps binaries cached under `CACHE_DIR/artwork/` (kinds: `header`, `cover`, `hero`, `logo`).
- Originals on disk are never modified.

## Roadmap (later milestones)

- Manual match-assign UI (search + pick from results in the web UI)
- Collections
- Multi-user / authentication
- Decompression / "normalize library" (rename from metadata)
- Downloadable installer discovery sources

## License

MIT