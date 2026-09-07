# Architecture

kr8bit — self-hosted game library manager. Docker-first. "Jellyfin for games".

Primary targets: Unraid, Docker Compose, Portainer, Proxmox, TrueNAS SCALE.

## Stack

| Layer      | Choice                          |
|------------|---------------------------------|
| Runtime    | Node 20 ESM (`"type": "module"`)|
| HTTP       | Fastify 4 + `@fastify/cors`, `@fastify/static` (SSE hand-written via `reply.hijack()`) |
| DB         | Prisma 5 + SQLite (`@prisma/client`) |
| Validation | Zod (env; request DTOs pending) |
| Logging    | Pino (pretty in dev, JSON in prod) |
| HTTP client| `undici` via shared `src/shared/http-client.ts` (retry + typed errors) |
| Fuzzy      | `fuse.js` (Scanner ↔ Steam index) |
| Process    | `tini` as PID 1                 |
| Dev        | tsx, TypeScript 5.5, vitest, eslint 9 |

## Layering

Strict, never skip:

```
Route → Controller → Service → Repository / Provider → Database
```

- Routes: Fastify plugins under `src/http/routes/`, prefix `/api/`.
- Controllers: thin glue — parse request, delegate to a service, shape the response envelope.
- Services: business logic. Repositories only persist (all Prisma calls wrapped with `mapPrismaError`).
- Providers: external API adapters. Normalize to kr8bit DTOs. Never leak provider model.

## Source Layout

```
src/
├── main.ts              # entrypoint, signal handlers, graceful drain
├── prisma-client.ts     # singleton PrismaClient (datasource url derived from DB_PATH)
├── app-version.ts       # reads version from package.json at runtime
├── config/index.ts      # Zod-validated env → frozen config
├── logger/index.ts      # Pino instance
├── http/
│   ├── server.ts        # buildServer() — error handler, API routes, web dist
│   ├── controllers/     # thin request/response glue
│   └── routes/*.routes.ts
├── shared/
│   ├── errors.ts        # AppError hierarchy (400/404/409/500…)
│   ├── http-client.ts   # undici wrapper: retry, typed HttpError, USER_AGENT
│   ├── batch-job.ts     # BatchJob base for background jobs
│   ├── types.ts         # Provider/Source contracts + DTOs
│   └── enums.ts         # EntryType, MatchStatus, ScanStatus, provider names
└── modules/
    ├── scanner/         # folder walk, match pipeline (match-game.ts), SSE events
    ├── library/         # Game domain, repository, service
    ├── metadata/        # providers (steam/igdb/steamgriddb), match, jobs, steam index
    ├── artwork/         # cache + serving
    ├── settings/        # env snapshot + Setting KV
    └── database/        # reset gate, reset/cleanup service
```

Banned names: Helper, Utils, Manager, Generic, Misc, Data. Good: `MetadataService`, `SteamProvider`, `ScannerService`, `ArtworkService`.

## Runtime & Process

- `tini` as PID 1 → clean SIGINT/SIGTERM forwarding.
- `src/main.ts`: starts the server, drains in-flight background work (10s budget) on shutdown, then `prisma.$disconnect()`.
- Stale `RUNNING` scan rows are recovered (marked failed) at boot.
- Imports use explicit `.js` specifiers in TS source (NodeNext ESM style).

## Config (env vars)

Validated by Zod, fail-fast at boot (`src/config/index.ts`). On validation error: prints each issue, `process.exit(1)`.

| Env var                              | Type   | Constraint | Default |
|--------------------------------------|--------|------------|---------|
| `NODE_ENV`                            | string | —          | development |
| `LIBRARY_ROOT`                        | string | min 1      | required |
| `CACHE_DIR`                           | string | min 1      | required |
| `DB_PATH`                             | string | min 1      | required |
| `PORT`                                | number | int > 0    | 8080    |
| `HOST`                                | string | —          | 0.0.0.0 |
| `LOG_LEVEL`                           | enum   | fatal\|error\|warn\|info\|debug\|trace | info |
| `STEAM_INDEX_REFRESH_INTERVAL_HOURS`  | number | int > 0    | 24      |
| `SCAN_MAX_DEPTH`                      | number | int > 0    | 1       |

`DATABASE_URL` is not a user-facing variable: the app derives `file:${DB_PATH}` and passes it as the Prisma datasource at runtime; the docker entrypoint exports it only for the Prisma CLI (see ADR-030).

## Persistence

- Prisma + SQLite. DB file at `${DB_PATH}` (container default `/data/kr8bit.db`).
- Migrations applied at every container start (`docker-entrypoint.sh` → `prisma migrate deploy`). Idempotent — applies pending only.
- Migrations ship inside the image.
- `src/prisma-client.ts`: singleton `PrismaClient` with datasource url from config; forwards `warn`/`error` events to logger; `query` events logged at `LOG_LEVEL=debug`.
- Repositories must be thin — services hold business logic.

## Models (current)

- **Game** — central entity. Linkage via `steamAppId` (Steam) and `ProviderMatch` rows (any provider). `matchStatus` drives the match pipeline. `sizeBytes` is `BigInt` (serialized via a `BigInt.prototype.toJSON` patch, `src/shared/bigint.ts`).
- **ScanRun** — scan audit record + counters (`found/added/updated/failed`) + `errors[]`.
- **Setting** — generic key/value (internal keys reserved).
- **ProviderMatch** — per-provider linkage, one `isPrimary` per game.
- **SteamAppIndex** — cached Steam app list for fuzzy lookup (`appId` + `name`).

Enums (`EntryType`, `MatchStatus`, `ScanStatus`): canonical TS source in `src/shared/enums.ts` via `as const` objects. Prisma stores as plain strings ("enum mirror").

## Background Jobs

- `BatchJob` base (`src/shared/batch-job.ts`): collect → process (bounded concurrency + delay) → onDone. Shared by `MetadataRefreshJob` and `RetryMatchJob`.
- Scanner runs fire-and-forget with an in-memory flag set synchronously before the first await (no double-start race); a `resetGate` blocks jobs during database resets.
- Job start endpoints return `202 {started:true}`; a second start returns `409` (see ADR-031).

## HTTP API

- Prefix: `/api/*`, lowercase plural resources.
- CORS: permissive (`origin: true`) — frontend is a separate origin in dev.
- Fastify built-in logger disabled; uses shared Pino logger.
- Custom error handler maps `AppError` → envelope:
  ```json
  { "statusCode": 404, "code": "NOT_FOUND", "error": "NotFoundError", "message": "..." }
  ```
- SSE for scan progress is written directly on the hijacked raw reply (heartbeat comments every 15s).

See `api.md` for endpoints.

## Docker

Multi-stage Dockerfile (3 stages):

1. `web-builder` — builds the `web/` frontend (Vite).
2. `server-builder` — `npm ci`, `prisma generate`, `tsc` build.
3. `runtime` — `node:20-slim`, installs `p7zip-full` (archive inspection), `ca-certificates`, `tini`. Runs as the base image `node` user.

Volumes: `/data` (state), `/games` (library). `EXPOSE 8080`. Entrypoint: tini → `docker-entrypoint.sh` (mkdir, derive `DATABASE_URL` from `DB_PATH`, `prisma migrate deploy`, idempotent video-url data migration, `exec node dist/main.js`).

Never assume localhost. Never hardcode paths/ports/URLs. Everything via env.

## CI

`.github/workflows/ci.yml` runs lint, web lint, typecheck, web typecheck, tests, and web build on PRs and (via `workflow_call`) before every image publish — `docker-publish.yml` gates the GHCR push on it (see ADR-032).

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