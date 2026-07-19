# Roadmap

Current state: foundation only. Cross-cutting infra (config, logger, prisma, errors, types, enums) + a single `GET /api/health` route. No domain code implemented. No frontend.

Phases are ordered by dependency. No dates.

## Phase 1 — Fix Foundation Bugs

- Correct `src/http/server.ts` import: `'./config/index.js'` → `'../config/index.js'`.
- Correct `src/prisma-client.ts` import: `'../logger/index.js'` → `'./logger/index.js'`.
- Seed `DATABASE_URL=file:${DB_PATH}` in `docker-entrypoint.sh` before `prisma migrate deploy` (otherwise migration fails inside container).
- Decide scope of `web/` references: either scaffold `web/` or guard the `COPY web/` stage in Dockerfile.
- Source `version` in `health.routes.ts` from `package.json` (not hardcoded `0.1.0`).

## Phase 2 — Library Scanner

- `LibraryScanner` service (walks `LIBRARY_ROOT`, respects `SCAN_MAX_DEPTH`).
- Classify entries into `EntryType` (ARCHIVE / DIRECTORY).
- Persist `Game` rows with `matchStatus = PENDING`.
- Create `ScanRun` records with counters and `errors[]`.
- `POST /api/scans` (start), `GET /api/scans`, `GET /api/scans/:id`.
- Use `p7zip-full` for `.7z` inspection.

## Phase 3 — Steam App Index

- Indexer job: fetch Steam app list → `SteamAppIndex` rows.
- Refresh cadence per `STEAM_INDEX_REFRESH_INTERVAL_HOURS`.
- `POST /api/steam/index/refresh`, `GET /api/steam/search?q=` (uses `fuse.js`).
- Persist `lastRefreshedAt` in `Setting`.

## Phase 4 — Metadata Match

- `SteamProvider` implementing `MetadataProvider`.
- `GameMetadataService` orchestrates search + accept.
- Fuzzy match: scanner entry name → `SteamAppIndex` → `SteamProvider.getGame()`.
- Apply `matchScore` thresholds: high → `ACCEPTED`, low → `FLAGGED`.
- `POST /api/games/:id/metadata/search`, `POST /api/games/:id/metadata/apply`.
- `PATCH /api/games/:id/match` (set `matchStatus` to `ACCEPTED` / `MANUAL` / `REJECTED`).
- Manual metadata override path (`matchStatus = MANUAL`).

## Phase 5 — Artwork

- `ArtworkCache` service — download to `CACHE_DIR`, persist URLs on `Game`.
- Serve cached artwork via `@fastify/static` (likely `/static/...`).
- `POST /api/games/:id/artwork/refresh`.
- `ImageSet.screenshots` storage (Prisma model needed — roadmap item).

## Phase 6 — Jobs

- Job abstraction (status, progress, cancellation).
- SSE via `fastify-sse-v2`:
  - `GET /api/scans/:id/events`
  - `GET /api/jobs/:id/events`
- Idempotent restart on container boot (mark RUNNING jobs as FAILED).

## Phase 7 — Download Sources

- Model `DownloadSource` result DTOs (replace `unknown[]`).
- First concrete source: TBD (provider chosen per business needs).
- `GET /api/downloads/search?q=`, `GET /api/downloads/:source/:remoteId`.
- Scraping stays inside the source implementation.

## Phase 8 — Settings

- `GET /api/settings`, `PUT /api/settings/:key`.
- Surface `Setting` table via typed schema (avoid freeform string sprawl).
- Validate values with Zod.

## Phase 9 — Collections

- Prisma models: `Collection`, `CollectionGame`.
- `GET/POST/PUT/DELETE /api/collections`, `POST /api/collections/:id/games`.

## Phase 10 — Users & Auth

- Prisma models: `User` (credentials), `Session` (or JWT).
- `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/me`.
- Add `UnauthorizedError` / `ForbiddenError` to `shared/errors.ts`.
- First user becomes admin; subsequent require invitation/token.

## Phase 11 — Frontend (`web/`)

- Scaffold `web/` (Vite + framework TBD by decision).
- Wire to `/api/*` endpoints; SSE consumers for scan/match progress.
- Build pipeline integrated into Dockerfile `web-builder` stage.

## Phase 12 — Tests

- vitest configured; no tests exist.
- Add unit tests for services and providers (mock undici).
- Add route/integration tests via Fastify `inject()`.
- Cover `LibraryScanner`, `GameMetadataService`, match pipeline, fuzzy lookup.

## Phase 13 — Operations

- Graceful in-flight drain on SIGINT/SIGTERM.
- `BigInt` (`Game.sizeBytes`) JSON serialization in service layer (use `.toString()` or a custom replacer).
- Verbose Prisma query logging gated behind `LOG_LEVEL=debug`.
- Backfill `INDEX.md` / README pointing at `docs/`.