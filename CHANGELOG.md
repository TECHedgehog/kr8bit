# Changelog

All notable changes to kr8bit are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- **O-13** — Static asset serving broken in Docker (`/assets/` returns `index.html`)