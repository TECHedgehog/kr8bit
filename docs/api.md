# API

HTTP API for kr8bit. All routes under `/api/*`, plural lowercase resources.

CORS: permissive (`origin: true`). Content-Type: `application/json` unless noted.

## Error Envelope

All errors use a single shape (produced by the Fastify error handler in `src/http/server.ts`):

```json
{
  "statusCode": 404,
  "code": "NOT_FOUND",
  "error": "NotFoundError",
  "message": "Game abc123 not found"
}
```

| `statusCode` | `code`                     | When                                                        |
|--------------|----------------------------|-------------------------------------------------------------|
| 400          | `VALIDATION_ERROR`         | Invalid input (service-level check).                        |
| 404          | `NOT_FOUND`                | Resource lookup returned null.                              |
| 409          | `CONFLICT` / `SCAN_RUNNING` / `RESET_RUNNING` | Duplicate or state conflict (job already running, reset in progress). |
| 502          | `STEAM_INDEX_REFRESH_FAILED` | Upstream Steam failure during index refresh.              |
| 503          | `STEAM_INDEX_DISABLED`     | `STEAM_API_KEY` not set.                                    |
| 500          | `INTERNAL_ERROR`           | Unhandled — default fallback.                              |

Error classes live in `src/shared/errors.ts`.

## Conventions

- `GET` list endpoints return `{ items, total }` (paginated) or bare arrays.
- `POST` action endpoints that start background jobs return `202 { "started": true }`; a second call while the job runs returns `409`.
- `PATCH` partial update. `PUT` full replace.
- Time fields: ISO 8601 strings.

---

## Health

### `GET /api/health`

**Response** `200 OK`

```json
{ "status": "ok", "version": "0.1.0", "libraryRoot": "/games" }
```

`version` is read from `package.json` at runtime (`src/app-version.ts`).

## Settings

### `GET /api/settings`

**Response** `200 OK` — `{ env: {...}, kv: [{ key, value }] }`. `env` reflects resolved env-var config; `kv` lists persisted `Setting` rows.

### `PUT /api/settings`

Upsert one or more settings.

**Body** — flat `{ "key": "value" }` map, e.g. `{ "someKey": "someValue" }`.

**Response** `200 OK` — `{ updated: n }`.

Internal keys (e.g. `steamIndexLastRefresh`) are rejected with `400`. Keys capped at 100 chars, values at 10k chars.

## Scanner

### `POST /api/scanner/run`

Starts a scan run. **Response** `202 Accepted` — the created `ScanRun`. Returns `409 SCAN_RUNNING` if a scan is already active, `409 RESET_RUNNING` if a database reset is in progress.

### `GET /api/scanner/status`

**Response** `200 OK`

```json
{
  "runningRun": { "...ScanRun": "or null" },
  "latest": { "...ScanRun": "or null" },
  "isRunning": false,
  "currentScanRunId": null
}
```

`runningRun` is the most recent `RUNNING` row from the DB; `isRunning` is the in-memory scanner flag.

### `GET /api/scanner/progress`

SSE stream (`text/event-stream`). Emits `data:` frames with `ScanProgressEvent`:

```json
{
  "scanRunId": "...",
  "phase": "start | candidate | matched | failed | done",
  "found": 0, "added": 0, "updated": 0, "failed": 0,
  "currentEntry": "Some Game",
  "message": "optional error text"
}
```

Comment heartbeats (`:ping`) are sent every 15s.

## Games (Library)

| Method   | Path               | Purpose                                                                                                    |
|----------|--------------------|------------------------------------------------------------------------------------------------------------|
| `GET`    | `/api/games`       | List games. Filters: `?search=`, `?genre=`, `?deck=`, `?sort=`, `?limit=`, `?offset=`. `genre`/`deck` accept comma-separated values (multi-select OR). `deck`: 0=Unknown, 1=Unsupported, 2=Playable, 3=Verified. `sort`: `title-asc` (default), `title-desc`, `newest`, `oldest`, `largest`, `smallest`. `limit` capped at 200. |
| `GET`    | `/api/games/genres`| Distinct genres (sorted) for the filter UI. Returns `{ genres: string[] }`.                                |
| `GET`    | `/api/games/:id`   | One game (includes screenshots, videos, deck compat). `404` if missing.                                     |
| `PATCH`  | `/api/games/:id`   | Update editable fields (title, releaseYear, description, developers, publishers, genres).                   |
| `DELETE` | `/api/games/:id`   | Remove game + linkages. Returns `{ deleted: true }`.                                                        |

`GET /api/games` returns `{ items: Game[], total: number }`.

## Metadata

| Method   | Path                                  | Purpose                                                                 |
|----------|---------------------------------------|-------------------------------------------------------------------------|
| `POST`   | `/api/games/:id/metadata/search`      | Provider search. Body `{ query, provider? }`. Returns `SearchResult[]`. |
| `POST`   | `/api/games/:id/metadata/assign`      | Assign a match. Body `{ remoteId, provider? }` (default `steam`). Fetches + applies metadata. |
| `POST`   | `/api/games/:id/metadata/refresh`     | Re-fetch metadata from the primary provider.                            |
| `DELETE` | `/api/games/:id/metadata`             | Unlink: clears match, metadata, artwork cache reference.                |

### Steam index

| Method | Path                             | Purpose                                                                 |
|--------|----------------------------------|-------------------------------------------------------------------------|
| `POST` | `/api/metadata/index/refresh`    | Force refresh of `SteamAppIndex`. `503` when `STEAM_API_KEY` missing, `409` while a refresh is in progress, `502` on upstream failure. |
| `GET`  | `/api/metadata/search-steam?q=`  | Fuzzy lookup (`fuse.js`) against `SteamAppIndex`. Returns `{ results: [...] }`, max 20. |

## Artwork

| Method | Path                            | Purpose                                                                       |
|--------|---------------------------------|-------------------------------------------------------------------------------|
| `GET`  | `/api/games/:id/artwork/:kind`  | Serve artwork. `kind` = `header` \| `cover` \| `hero` \| `logo`. Serves cached bytes with long-lived `Cache-Control`, or `302` redirects to the provider CDN when not cached. `404` when the game has no artwork of that kind. |

## Repack Catalog

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/repack-catalog?offset=&limit=&q=&sort=&genre=&deck=&match=` | Paginated catalog `{ items, total }`; `q` searches title; optional sort (`title-asc`, `title-desc`, `newest`, `oldest`), comma-separated genre, Deck category (0-3), and match status filters. `limit` defaults to 24, max 100. |
| `GET` | `/api/repack-catalog/genres` | Distinct genres from accepted metadata snapshots. |
| `GET` | `/api/repack-catalog/settings` | Source settings: enabled, base URL, sync/audit intervals, full-import state. |
| `GET` | `/api/repack-catalog/status` | Current job status: phase, running, processed, skipped, failed, total, startedAt. |
| `GET` | `/api/repack-catalog/review?offset=&limit=` | Paginated `REVIEW` match queue `{ items, total }`. |
| `POST` | `/api/repack-catalog/sync` | Sync recent posts. Body `{ "fullArchive": true }` requests full archive crawl. |
| `POST` | `/api/repack-catalog/audit` | Re-fetch up to 50 oldest posts to refresh stored FitGirl fields. |
| `GET` | `/api/repack-catalog/:id` | Catalog game detail: provider-only `metadataSnapshot`, aggregate FitGirl `tags`, posts with selected details/tags/downloadOptions. Full article text is not stored or returned. |
| `GET` | `/api/repack-catalog/:id/artwork/:kind` | Serve cached provider artwork or redirect to provider CDN; `kind` = `header`, `cover`, `hero`, or `logo`. |
| `POST` | `/api/repack-catalog/:id/candidates/search` | Search metadata providers. Body `{ "query"?: string }`; omitted/blank query uses catalog title. Returns `{ candidates: RepackMatchCandidate[] }`. |
| `POST` | `/api/repack-catalog/:id/candidates/preview` | Fetch candidate metadata for comparison. Body `{ "providerName", "remoteId" }`. |
| `POST` | `/api/repack-catalog/:id/match` | Accept `{ "action":"accept", "providerName", "remoteId" }` or reject/unmatch with `{ "action":"reject" }`. Accept stores provider metadata; FitGirl post data remains independent. |

Accepted `metadataSnapshot` retains provider `remoteId`, title, year, description, developers, publishers, genres, artwork URLs, screenshots/videos, and Steam Deck compatibility. FitGirl post data retains selected size, based-on, installation, language, feature details, source tags, and download links; version/DLC posts group under base game title.

## Database

| Method | Path                    | Purpose                                                                                          |
|--------|-------------------------|--------------------------------------------------------------------------------------------------|
| `POST` | `/api/database/reset`   | Destructive wipe of all data. Body `{ "confirm": "RESET" }` required, else `400`. `409 RESET_RUNNING` if a scan/job is active. |
| `POST` | `/api/database/cleanup`  | Remove orphaned rows (games whose entry no longer exists on disk).                               |

---

## Planned / Not yet implemented

### Collections

| Method   | Path                                 | Purpose                              |
|----------|--------------------------------------|--------------------------------------|
| `GET`    | `/api/collections`                   | List collections.                   |
| `POST`   | `/api/collections`                   | Create collection.                  |
| `GET`    | `/api/collections/:id`               | Get one.                            |
| `PUT`    | `/api/collections/:id`               | Update.                             |
| `DELETE` | `/api/collections/:id`               | Delete.                             |
| `POST`   | `/api/collections/:id/games`         | Add game(s).                        |
| `DELETE` | `/api/collections/:id/games/:gameId` | Remove game.                        |

### Auth & Users

| Method | Path                  | Purpose                              |
|--------|-----------------------|--------------------------------------|
| `POST` | `/api/auth/login`     | Login (credentials TBD).            |
| `POST` | `/api/auth/logout`    | Logout.                              |
| `GET`  | `/api/me`             | Current user.                        |

Requires new error classes (`UnauthorizedError`, `ForbiddenError`). See `decisions.md` O-9.

### Download Sources

| Method | Path                               | Purpose                                       |
|--------|------------------------------------|-----------------------------------------------|
| `GET`  | `/api/downloads/search?q=`         | Search across registered download sources.    |
| `GET`  | `/api/downloads/:source/:remoteId` | Get downloads for a source/remoteId.         |
