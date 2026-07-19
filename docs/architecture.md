# Architecture

kr8bit — self-hosted game library manager. Docker-first. "Jellyfin for games".

Primary targets: Unraid, Docker Compose, Portainer, Proxmox, TrueNAS SCALE.

## Stack

| Layer      | Choice                          |
|------------|---------------------------------|
| Runtime    | Node 20 ESM (`"type": "module"`)|
| HTTP       | Fastify 4 + `@fastify/cors`, `@fastify/static`, `fastify-sse-v2` |
| DB         | Prisma 5 + SQLite (`@prisma/client`) |
| Validation | Zod (env + future request DTOs) |
| Logging    | Pino (pretty in dev, JSON in prod) |
| HTTP client| `undici` (provider calls)       |
| Fuzzy      | `fuse.js` (Scanner ↔ Steam index) |
| Process    | `tini` as PID 1                 |
| Dev        | tsx, TypeScript 5.5, vitest, eslint 9 |

## Layering

Strict, never skip:

```
Route → Controller → Service → Repository / Provider → Database
```

- Routes: Fastify plugins under `src/http/routes/`, prefix `/api/`.
- Services: business logic. Repositories only persist.
- Providers: external API adapters. Normalize to kr8bit DTOs. Never leak provider model.
- Controllers: optional thin glue (not yet implemented).

Current state: only Route + cross-cutting infra (config, logger, prisma, errors, types, enums) exist. Domain services/repositories pending.

## Source Layout

```
src/
├── main.ts              # entrypoint, signal handlers
├── prisma-client.ts     # singleton PrismaClient + event logging
├── prisma-env.ts        # derives DATABASE_URL from config
├── config/index.ts      # Zod-validated env → frozen config
├── logger/index.ts      # Pino instance
├── http/
│   ├── server.ts        # buildServer(), startServer()
│   └── routes/*.routes.ts
└── shared/
    ├── errors.ts        # AppError hierarchy (404/400/409)
    ├── types.ts        # Provider/Source contracts + DTOs
    └── enums.ts        # EntryType, MatchStatus, ScanStatus
```

Domain modules will live under `src/<domain>/` (e.g. `src/library/`, `src/metadata/`). Banned names: Helper, Utils, Manager, Generic, Misc, Data. Good: `GameMetadataService`, `SteamProvider`, `LibraryScanner`, `ArtworkCache`.

## Runtime & Process

- `tini` as PID 1 → clean SIGINT/SIGTERM forwarding.
- `src/main.ts`: calls `startServer()`, fatal → `process.exit(1)`, signal → log + `exit(0)`.
- No graceful in-flight drain yet (roadmap).
- Imports use explicit `.js` specifiers in TS source (NodeNext ESM style).

## Config (env vars)

Validated by Zod, fail-fast at boot (`src/config/index.ts`). On validation error: prints each issue, `process.exit(1)`.

| Env var                              | Type   | Constraint | Default |
|--------------------------------------|--------|------------|---------|
| `LIBRARY_ROOT`                        | string | min 1      | required |
| `CACHE_DIR`                           | string | min 1      | required |
| `DB_PATH`                             | string | min 1      | required |
| `PORT`                                | number | int > 0    | 8080    |
| `HOST`                                | string | —          | 0.0.0.0 |
| `LOG_LEVEL`                           | enum   | fatal\|error\|warn\|info\|debug\|trace | info |
| `STEAM_INDEX_REFRESH_INTERVAL_HOURS`  | number | int > 0    | 168     |
| `SCAN_MAX_DEPTH`                      | number | int > 0    | 1       |

`DATABASE_URL` is derived: `file:${DB_PATH}` (consumed by Prisma).

## Persistence

- Prisma + SQLite. DB file at `${DB_PATH}` (container default `/data/kr8bit.db`).
- Migrations applied at every container start (`docker-entrypoint.sh` → `npx prisma migrate deploy`). Idempotent — applies pending only.
- Migrations ship inside the image.
- `src/prisma-client.ts`: singleton `PrismaClient`, forwards `warn`/`error` events to logger. `query` event enabled but unconsumed (reserved for verbose logging).
- Repositories must be thin — services hold business logic.

## Models (current)

- **Game** — central entity. Linkage via `steamAppId`. `matchStatus` drives match pipeline. `sizeBytes` is `BigInt`.
- **ScanRun** — scan audit record + counters (`found/added/updated/failed`) + `errors[]`.
- **Setting** — generic key/value.
- **SteamAppIndex** — cached Steam app list for fuzzy lookup; indexed on `name`.

Enums (`EntryType`, `MatchStatus`, `ScanStatus`): canonical TS source in `src/shared/enums.ts` via `as const` objects. Prisma stores as plain strings ("enum mirror").

## HTTP API

- Prefix: `/api/*`, lowercase plural resources.
- CORS: permissive (`origin: true`) — frontend is a separate origin.
- Fastify built-in logger disabled; uses shared Pino logger.
- Custom error handler maps `AppError` → envelope:
  ```json
  { "statusCode": 404, "code": "NOT_FOUND", "error": "NotFoundError", "message": "..." }
  ```
- SSE via `fastify-sse-v2` reserved for job/scan/match progress streaming.

See `api.md` for endpoints.

## Docker

Multi-stage Dockerfile (3 stages):

1. `web-builder` — builds `web/` frontend (dir not yet present → roadmap).
2. `server-builder` — `npm ci`, `prisma generate`, `tsc` build.
3. `runtime` — `node:20-slim`, installs `p7zip-full` (archive inspection), `ca-certificates`, `tini`. Non-root user `kr8bit` (uid 1000).

Volumes: `/data` (state), `/games` (library). `EXPOSE 8080`. Entrypoint: tini → `docker-entrypoint.sh` (mkdir, `prisma migrate deploy`, `exec node dist/main.js`).

Never assume localhost. Never hardcode paths/ports/URLs. Everything via env.

## Logging

- Pino, JSON to stdout in prod, `pino-pretty` in dev (`NODE_ENV !== 'production'`).
- Default level `info`; override via `LOG_LEVEL`.
- Prisma events forwarded to logger with `{ prisma: message }` context.

## Logging Conventions (per `AGENTS.md`)

Log:

- Scanning
- Imports
- Metadata
- Artwork
- Provider failures
- Retries