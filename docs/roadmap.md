# Roadmap

Status: **v0.1 shipped** — scanner, multi-provider matching, artwork, web library UI, Docker/Unraid deployment, CI. This file tracks what remains.

## Done (v0.1 + follow-ups)

- Library scanner (`.7z` archives, `setup.exe` folders), fuzzy match vs Steam index (IGDB second provider)
- Match pipeline: auto-accept ≥ 85, flag 70-84, pending < 70; retry-match background job
- Metadata + artwork (header/cover/hero/logo, screenshots, videos) with on-disk cache
- Steam Deck compatibility badge (store-page structured data)
- Web UI: glass design system, library grid with filters/sort/search/infinite scroll, game detail card with gallery + video, scan page with SSE progress
- Settings API (env snapshot + KV), database reset/cleanup endpoints
- Docker (GHCR) + Unraid template; `DB_PATH` single-source config (ADR-030)
- CI: lint/typecheck/tests/web build on PRs, publish-gated (ADR-032)
- 392 vitest tests

## Next up

### Manual match-assign UI
Reimplement the deleted `MetadataPicker` flow in the current design system: from a pending game, search (`POST /api/games/:id/metadata/search`), pick a result, assign (`/metadata/assign`). Backend endpoints already exist and are tested; this is frontend-only.

### Collections
CRUD + game membership (see `api.md` planned endpoints). Needs Prisma models + routes + UI shelf/row treatment.

### Auth & users
`UnauthorizedError`/`ForbiddenError`, User/Session models, login flow (O-9). Decide single-user password vs multi-user before modeling.

### Download sources
Model `DownloadSource` contract (O-6), then concrete sources. Search + per-game downloads UI.

### Library normalization
Rename/move on-disk entries from metadata ("normalize library"). Destructive — needs dry-run preview + explicit confirm.

## Deferred / open questions

- Scan page visual rework to match Library/Detail polish (O-12)
- Consolidate `Game.steamAppId` into `ProviderMatch` (post-ADR-017 debt)
- Zod validation for route request bodies (currently service-level checks)
- Genre list caching; scanner/refresh job coordination; Steam app-list streaming ingest (audit findings W5/W10/W14/W19)
- Shared types package between `src/` and `web/` (currently duplicated DTOs)
