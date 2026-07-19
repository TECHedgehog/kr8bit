# kr8bit

Self-hosted game library manager — kind of like Jellyfin for games.

Scans local installer folders, fetches Steam metadata + artwork, and lets you organize your library through a web UI. Runs in a single Docker container.

## Status

v1 (minimal). Built for Unraid, Docker Compose, Portainer, Proxmox, TrueNAS SCALE.

## What it does

- Scans a library root for:
  - `.7z` files (one game per archive)
  - Directories containing `setup.exe` (unpacked installers)
- Fuzzy-matches folder/archive names against the Steam app list
- Auto-accepts matches scored ≥ 90, flags 70-89, leaves < 70 pending for manual review
- Downloads metadata + artwork (cached locally on disk)
- Lets you manually search Steam and assign metadata to any unmatched game
- Serves a minimal web UI

## Quick start (Docker)

```bash
docker run -d \
  --name kr8bit \
  -p 8080:8080 \
  -v /path/to/your/games:/games:ro \
  -v ./kr8bit-data:/data \
  kr8bit:latest
```

Open `http://localhost:8080` and click **Start scan**.

## Unraid

1. Install the kr8bit template via Community Applications (or paste the GitHub URL into `Apps → Install from URL`).
2. Configure:
   - **HTTP Port**: defaults to `8080`
   - **Library Path**: path to your games folder (read-only is fine for v1)
   - **Data Path**: persistent storage for DB + artwork cache
3. Start the container, open the WebUI, scan, review matched games, manually pick unmatched ones.

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
| `DB_PATH` | `/data/kr8bit.db` | SQLite database file |
| `DATABASE_URL` | `file:/data/kr8bit.db` | Prisma datasource URL |
| `PORT` | `8080` | HTTP server port |
| `HOST` | `0.0.0.0` | HTTP server bind host |
| `LOG_LEVEL` | `info` | `fatal` \| `error` \| `warn` \| `info` \| `debug` \| `trace` |
| `STEAM_INDEX_REFRESH_INTERVAL_HOURS` | `168` | Steam app list refresh interval in hours |

## Match workflow

| Score | Status | Behaviour |
|---|---|---|
| ≥ 90 | `ACCEPTED` | Auto-accepted, metadata + artwork fetched |
| 70-89 | `FLAGGED` | Auto-accepted but flagged for manual review |
| < 70 | `PENDING` | Waits for manual search + assign |
| (manual pick) | `MANUAL` | User picked the game from search results |
| (explicit unlink) | `REJECTED` | Cleared back to `PENDING` |

## API

All endpoints under `/api/*`:

```
GET    /api/health
GET    /api/settings
PUT    /api/settings
POST   /api/scanner/run
GET    /api/scanner/status
GET    /api/scanner/progress          (SSE)
GET    /api/games                     (?status=, ?search=, ?limit=, ?offset=)
GET    /api/games/:id
PATCH  /api/games/:id
DELETE /api/games/:id
POST   /api/games/:id/metadata/search
POST   /api/games/:id/metadata/assign
POST   /api/games/:id/metadata/refresh
DELETE /api/games/:id/metadata
GET    /api/games/:id/artwork/:kind   (kind = header \\| cover)
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

## Architecture

```
Route → Controller → Service → Repository / Provider → Database
```

- **Services** own business logic.
- **Repositories** only persist data.
- **Providers** normalize external APIs (Steam for v1). Adding a new provider = new file.
- **Scanner** walks the library, normalizes names, matches via provider, applies match policy.
- **ArtworkService** keeps binaries cached at `CACHE_DIR/artwork/{steamAppId}/{header|cover}.jpg`.
- Originals on disk are never modified in v1.

## Roadmap (later milestones)

- Background metadata refresh
- Collections
- Multi-user / authentication
- Multiple metadata providers (IGDB, TGDB, GiantBomb)
- Decompression / "normalize library" (rename from metadata)
- Downloadable installer discovery sources

## License

MIT