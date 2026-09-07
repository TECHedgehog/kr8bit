# Changelog

All notable changes to kr8bit are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- GitHub Actions workflow (`.github/workflows/docker-publish.yml`) publishing the image to GHCR (`linux/amd64`) on push to `main` and version tags
- Unraid Community Applications template pointing at `ghcr.io/techedgehog/kr8bit`
- CI workflow (`.github/workflows/ci.yml`) — lint, web lint, typecheck, web typecheck, tests, web build on PRs; image publishes are gated on it (ADR-032)
- Multi-provider scan pipeline with auto-assign, `displayName`, and background retry-match job for pending/flagged/rejected games
- SteamGridDB provider — hero/logo artwork, grid enrichment, cache-busting
- IGDB alternative names + screenshots; genres union-merged across providers; unified Steam + IGDB genre normalization
- Steam Deck compatibility badge (store-page structured data, ADR-029)
- Library: genre + Steam Deck filters, backend-wired sort, live debounced search, infinite scroll + scroll-to-top
- Game detail: vidstack-backed gallery with videos, media gallery controls, reworked layout
- Glass design system across UI: liquid-glass surfaces, topbar pill with sliding lens, selector pills, 3D tilt + glow, title marquee, floating detail card, grid size toggle, advanced panel as sticky sidebar
- Database: reset endpoint (confirm-gated) + orphan cleanup service + query indexes
- Metadata jobs: chunked concurrency with progress detail; shared retry HTTP client
- Artwork: TTL-based cache invalidation, eager download during scan
- Settings API reworked: `GET /api/settings` (env + KV), `PUT /api/settings` flat-map upsert with reserved-key and size caps
- Test suite expanded to 392 vitest tests; ESLint flat config

### Changed

- **Breaking:** `DB_PATH` is now the only database variable — `DATABASE_URL` removed from compose/Unraid/`.env.example`; the app derives the Prisma datasource and the entrypoint exports it for the CLI (ADR-030)
- **Breaking:** job-start endpoints (`/api/scanner/run`, `/api/metadata/refresh-all`, `/api/metadata/retry-matches`) return `202 {started:true}` and `409` when already running; scanner status field `running` renamed `runningRun` (ADR-031)
- Match threshold lowered: auto-accept ≥ 85, flag 70-84
- Steam index refresh default 24h (was 168h); `SteamAppIndex` slimmed (dropped `indexedAt` + `name` index)
- Scanner double-start race fixed (in-memory flag set synchronously); stale `RUNNING` scan rows recovered at boot; reset gate blocks jobs during database resets
- Graceful shutdown: in-flight drain + `prisma.$disconnect()`
- All Prisma calls wrapped with typed error mapping; `server.ts` split (error handler / routes / static); shared `http-client.ts` replaces four duplicated retry implementations
- Frontend: route-level code splitting, memoized cards, reduced-motion support, focus-trapped detail dialog, SSE error surfacing, param clamping

### Fixed

- Dockerfile `useradd` failed with `UID 1000 is not unique` against `node:20-slim`'s existing `node` user — now reuses the base image `node` user (UID 1000 preserved)
- O-13 — Static asset serving in Docker verified working (`/assets/*` returns correct `application/javascript` / `text/css` content-type); no code change required
- Prisma engine mismatch in Docker — `prisma generate` produced the `debian-openssl-1.1.x` engine but `node:20-slim` (Bookworm) runtime requires `debian-openssl-3.0.x`; added explicit `binaryTargets` to `schema.prisma` (image crashed at boot with `PrismaClientInitializationError`)
- IGDB 4X theme mapped to Strategy; IGDB screenshot sizes request `t_` prefix
- Steam `appdetails` retried and stale appIds re-resolved; punctuation normalized for storesearch scoring
- Artwork cache serving gated on DB URL presence; glass pill refraction + light-mode tonal issues

### Removed

- Dead code: `GameListRow`, `MetadataPicker` (to be reimplemented — see roadmap), `ToastContext`, `steamDeckTokens`, `scripts/dev.sh`, ~420 lines of unused CSS, unused API client methods and DTOs

## [0.1.0] - 2026-07-19

Initial foundation release.

### Added

- Core infrastructure: config (Zod-validated env), structured logging (Pino), Prisma + SQLite, error hierarchy, shared types/enums
- `GET /api/health` endpoint (status, version, library root)
- Library scanner — walks `LIBRARY_ROOT`, classifies entries, persists `Game` rows, creates `ScanRun` records with counters and error lists
- Steam app indexer — fetches Steam app list, fuzzy search via `fuse.js`, periodic refresh
- Metadata matching — `SteamProvider` (`MetadataProvider`), `GameMetadataService` orchestration, fuzzy match with score thresholds (`ACCEPTED` / `FLAGGED`), manual override path
- IGDB metadata provider — OAuth client-credentials flow, token caching, soft failure on missing credentials (ADR-016)
- `ProviderMatch` table for non-Steam provider linkage (ADR-017)
- First-match-wins provider ordering — deterministic precedence in `ProviderRegistry` (ADR-018)
- Artwork cache — downloads to `CACHE_DIR`, served via `@fastify/static`, generic cache paths for non-Steam providers (ADR-019)
- Frontend — React 18 + Vite, Netflix-like library grid with glassmorphism, light/dark themes, game detail page, scan page, toast notifications, error boundary, React Router (ADR-020)
- Docker setup — multi-stage build, `p7zip-full` runtime, `tini` as PID 1, migration-on-boot via `docker-entrypoint.sh`
- Settings API — `GET /api/settings`, `PUT /api/settings/:key`
- API tests via Fastify `inject()` (vitest)

### Known Issues

- **O-1** — Incorrect import paths in `src/http/server.ts` and `src/prisma-client.ts` (build fails)
- **O-2** — `DATABASE_URL` not seeded in `docker-entrypoint.sh` (first container start fails at migration)
- **O-3** — `web/` referenced in Dockerfile/scripts (resolved — frontend scaffolded)
- **O-5** — `BigInt` serialization for `Game.sizeBytes` not handled
- **O-6** — `DownloadSource` returns `unknown[]` — not modeled yet
- **O-7** — `ImageSet.screenshots` has no Prisma model
- **O-9** — No auth (no User/Session models, unauthenticated endpoints by design)
- **O-11** — Sort dropdown not wired to backend
- **O-12** — Scan page layout not reworked