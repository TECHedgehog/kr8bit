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

| `statusCode` | `code`            | `error`           | When                                                       |
|--------------|-------------------|-------------------|------------------------------------------------------------|
| 400          | `VALIDATION_ERROR`| `ValidationError` | Invalid input (Zod or service-level check).                |
| 404          | `NOT_FOUND`       | `NotFoundError`   | Resource lookup returned null (constructed with `resource, id`). |
| 409          | `CONFLICT`        | `ConflictError`   | Duplicate / state conflict.                                |
| 500          | `INTERNAL_ERROR`  | (any)             | Unhandled — default fallback.                              |

Error classes live in `src/shared/errors.ts`.

## Conventions

- `GET` list endpoints return arrays (pagination TBD).
- `GET` single endpoints return object or `404`.
- `POST` create / action endpoints return created resource or action result.
- `PATCH` partial update. `PUT` full replace.
- Time fields: ISO 8601 strings.

---

## Implemented

### `GET /api/health`

Health check.

**Response** `200 OK`

```json
{
  "status": "ok",
  "version": "0.1.0",
  "libraryRoot": "/games"
}
```

Notes:
- `version` currently hardcoded — see `decisions.md` O-4.
- `libraryRoot` reflects resolved `LIBRARY_ROOT` env var.

Source: `src/http/routes/health.routes.ts`.

---

## Planned / Not yet implemented

Derived from current models and provider contracts. URLs are provisional until implemented and tested.

### Games (Library)

| Method   | Path                          | Purpose                                              |
|----------|-------------------------------|------------------------------------------------------|
| `GET`    | `/api/games`                  | List games. Filters TBD (`matchStatus`, `genre`, etc.). |
| `GET`    | `/api/games/:id`              | Get one game.                                        |
| `PATCH`  | `/api/games/:id`              | Update editable fields (title, metadata, etc.).     |
| `DELETE` | `/api/games/:id`              | Remove game (and linkages).                          |
| `PATCH`  | `/api/games/:id/match`        | Set `matchStatus` (`ACCEPTED` / `MANUAL` / `REJECTED`). |

### Scans

| Method | Path                  | Purpose                                                              |
|--------|-----------------------|---------------------------------------------------------------------|
| `POST` | `/api/scans`          | Start a scan run (creates `ScanRun`, walks `LIBRARY_ROOT`).         |
| `GET`  | `/api/scans`          | List scan runs.                                                     |
| `GET`  | `/api/scans/:id`      | Get one scan run (status + counters + `errors`).                    |
| `GET`  | `/api/scans/:id/events`| SSE stream of scan progress (`fastify-sse-v2`). Phase 6.           |

### Metadata

| Method | Path                                        | Purpose                                              |
|--------|---------------------------------------------|-----------------------------------------------------|
| `POST` | `/api/games/:id/metadata/search`            | Run provider search for a game (returns `SearchResult[]`). |
| `POST` | `/api/games/:id/metadata/apply`             | Apply chosen `remoteId` — fetch `GameMetadata` + write to `Game`. |

### Steam Index

| Method | Path                            | Purpose                                        |
|--------|---------------------------------|------------------------------------------------|
| `POST` | `/api/steam/index/refresh`      | Force refresh of `SteamAppIndex` from Steam.   |
| `GET`  | `/api/steam/search?q=`          | Fuzzy lookup (`fuse.js`) against `SteamAppIndex`. |

### Artwork

| Method | Path                                | Purpose                                          |
|--------|-------------------------------------|--------------------------------------------------|
| `POST` | `/api/games/:id/artwork/refresh`    | Re-fetch `ImageSet`, cache under `CACHE_DIR`, update URLs. |
| `GET`  | `/static/...`                       | Static artwork files served via `@fastify/static`. |

### Settings

| Method | Path                  | Purpose                                        |
|--------|-----------------------|------------------------------------------------|
| `GET`  | `/api/settings`       | Get all settings (from `Setting` table).       |
| `PUT`  | `/api/settings/:key`  | Upsert one setting.                            |

### Download Sources

| Method | Path                                       | Purpose                                       |
|--------|--------------------------------------------|-----------------------------------------------|
| `GET`  | `/api/downloads/search?q=`                 | Search across registered download sources.    |
| `GET`  | `/api/downloads/:source/:remoteId`         | Get downloads for a source/remoteId.          |

### Collections

| Method   | Path                                 | Purpose                              |
|----------|--------------------------------------|-------------------------------------|
| `GET`    | `/api/collections`                   | List collections.                   |
| `POST`   | `/api/collections`                   | Create collection.                  |
| `GET`    | `/api/collections/:id`               | Get one.                            |
| `PUT`    | `/api/collections/:id`               | Update.                             |
| `DELETE` | `/api/collections/:id`               | Delete.                             |
| `POST`   | `/api/collections/:id/games`         | Add game(s).                        |
| `DELETE` | `/api/collections/:id/games/:gameId` | Remove game.                        |

### Auth & Users

| Method | Path                  | Purpose                              |
|--------|-----------------------|------------------------------------|
| `POST` | `/api/auth/login`     | Login (credentials TBD).           |
| `POST` | `/api/auth/logout`    | Logout.                            |
| `GET`  | `/api/me`             | Current user.                      |

Requires new error classes (`UnauthorizedError`, `ForbiddenError`). See `decisions.md` O-9.