# Decisions

ADR-style log. Each entry: context + decision + consequences. Open issues at the bottom.

## ADR-001 — SQLite via Prisma

**Context:** Self-hosted, single-instance, Docker-first. Users run on Unraid / Proxmox / TrueNAS — no managed Postgres expected.

**Decision:** SQLite as the database, accessed via Prisma 5. Single DB file at `${DB_PATH}` (container default `/data/kr8bit.db`).

**Consequences:**
- Single file persistence — easy backup, volume mount suffices.
- No concurrent-write scaling beyond what SQLite allows (OK for home scale).
- Prisma migration tooling required at runtime.
- `BigInt` columns (e.g. `Game.sizeBytes`) — must serialize manually.

## ADR-002 — Enums in TypeScript, not Prisma

**Context:** Prisma enum support on SQLite is limited; keeping two enum definitions risks drift.

**Decision:** Canonical enums live in `src/shared/enums.ts` as `as const` objects. Prisma columns store plain `String` ("enum mirror"). DB strings are not validated by Prisma; only the TS layer enforces.

**Consequences:**
- Single source of truth in TS.
- Adding an enum value requires a code change but no migration.
- DB remains queryable by string without joins on lookup tables.
- A future value not present in TS enum will compile-fail at consumer.

## ADR-003 — `as const` Objects over TS `enum` Keyword

**Context:** TS `enum` emits a runtime object + has edge cases (const enum, isolatedModules, `export enum`).

**Decision:** Use `as const` plain objects + derived union types (e.g. `typeof EntryType[keyof typeof EntryType]`).

**Consequences:**
- Tree-shakeable; minimal runtime cost.
- Works cleanly with `isolatedModules` and `verbatimModuleSyntax`.
- No reverse mapping noise.

## ADR-004 — Fastify over Express

**Context:** Need modern HTTP server with plugin model, integrated SSE, and low per-request overhead.

**Decision:** Fastify 4 with `@fastify/cors`, `@fastify/static`, `fastify-sse-v2`. Disable built-in logger; use shared Pino.

**Consequences:**
- Native plugin-style route grouping (`FastifyPluginAsync`).
- SSE throws out via `fastify-sse-v2` once jobs land.
- Schema-based validation hooks available where Zod may be plugged in.

## ADR-005 — Pino for Structured Logging

**Context:** Need log ingestion friendly output in prod, readable output in dev.

**Decision:** Pino. `pino-pretty` transport when `NODE_ENV !== 'production'`; raw JSON to stdout in prod.

**Consequences:**
- Forward Prisma `warn`/`error` events to logger for observability.
- Stdout-only output (container-friendly).

## ADR-006 — Zod-Validated Env, Fail-Fast at Boot

**Context:** Misconfigured env should surface immediately, not at first failure.

**Decision:** `src/config/index.ts` loads dotenv, validates everything via Zod, exits with `1` printing each issue on failure. Config object is frozen `as const`.

**Consequences:**
- All env contracts in one file.
- No runtime config reads scattered across modules.
- Adds manual singleton (no DI container yet — watch).

## ADR-007 — No DI Container (Yet)

**Context:** Early bootstrap. Manual singletons (`config`, `logger`, `prisma`) suffice.

**Decision:** No DI framework. Modules export singleton instances; services/providers import them directly.

**Consequences:**
- Simple and explicit today.
- Will need revisiting when providers/services need runtime-injected deps (e.g. API keys). Prefer factory functions over adding a framework.

## ADR-008 — `remoteId: string` Abstraction at Provider Boundary

**Context:** Provider IDs differ (Steam `appId: number`, IGDB `id: number` with different namespace, etc.). Avoid leaking provider models into services.

**Decision:** All DTOs use `remoteId: string`. Providers stringify their native IDs at the boundary.

**Consequences:**
- Services never see provider-specific shape.
- Easy to add new providers without touching service signatures.
- DB column `steamAppId` currently breaks this abstraction — see ADR-009.

## ADR-009 — Single `steamAppId` Column (Interim)

**Context:** Steam is the only concrete metadata provider planned short-term.

**Decision:** `Game.steamAppId Int?` is the linkage column. No polymorphic match table yet.

**Consequences:**
- Simple schema today; one index on `steamAppId`.
- Adding a second provider requires either per-provider nullable columns or — preferred — a `ProviderMatch` table (`gameId, providerName, remoteId, matchScore, matchedAt`).
- Decision Point: open (see Open Issues).

## ADR-010 — Migrations Run at Container Start

**Context:** Docker-only target. No external migration runner.

**Decision:** `docker-entrypoint.sh` runs `npx prisma migrate deploy` on every boot before `node dist/main.js`. Migrations ship inside the image.

**Consequences:**
- Idempotent — only pending migrations applied.
- Image + DB must agree on migration history; no downgrade path in production.
- Requires `DATABASE_URL` to be in process env at entry (see Open Issues).

## ADR-011 — ESM with `.js` Specifiers in TS Source

**Context:** Node 20 ESM, no transpiler in prod.

**Decision:** Write `import './x.js'` in `.ts` source. `moduleResolution: Bundler`, `tsx` for dev, `tsc` for build.

**Consequences:**
- No runtime ambiguity.
- Breaking convention causes silent broken imports — see Open Issues for current bugs.

## ADR-012 — `p7zip-full` in Runtime Image

**Context:** Scanner must inspect/extract `.7z` installers found in the library.

**Decision:** Install `p7zip-full` in the runtime Docker stage.

**Consequences:**
- Image slightly larger; scanner can handle `.7z`.
- Other archive formats may require additional packages later (TBD).

## ADR-013 — `tini` as PID 1

**Context:** Need proper signal forwarding in containers.

**Decision:** `ENTRYPOINT ["/usr/bin/tini", "--"]`, entry script uses `exec node ...` to replace shell.

**Consequences:**
- Clean SIGINT/SIGTERM reaching Node.
- `main.ts` still just `exit(0)` on signal — graceful drain is Roadmap Phase 13.

## ADR-014 — Frontend as Separate `web/` Package

**Context:** UI must be a separate build pipeline.

**Decision:** `web/` is a separate npm package (`npm --prefix web` scripts). Built in its own Docker stage, served via `@fastify/static`.

**Consequences:**
- Independent dependency trees.
- `web/` directory referenced in Dockerfile/scripts but does not exist yet (Open Issue).

## ADR-015 — API Prefix `/api/*`, Plural Lowercase Resources

**Context:** Consistency, REST-ish surface.

**Decision:** All routes under `/api/`. Resources plural lowercase (`/api/games`, `/api/scans`, etc.). CORS `origin: true`.

**Consequences:**
- Static frontend assets served at root (`/static/...`) without clash.
- No versioning in URL (no `/api/v1/`); version exposed via `/api/health` and negotiated if/when needed.

## ADR-016 — Second Metadata Provider: IGDB

**Context:** Steam alone is insufficient for non-Steam titles. IGDB (Twitch) offers broad coverage and a stable public API.

**Decision:** Add `src/modules/metadata/igdb/` implementing the existing `MetadataProvider` contract. OAuth client-credentials flow, token cached in-memory with 60s refresh margin. Credentials via env vars (`IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`); provider disabled at boot when missing.

**Consequences:**
- Provider benefits are gated by user registering a Twitch app — fair trade-off.
- Failure modes are soft: provider errors degrade to empty search results / null metadata, never break the request.
- `SearchResult` gained a `providerName` field so the UI can pass it back to `assign`.

## ADR-017 — `ProviderMatch` Table for Non-Steam Providers

**Context:** `Game.steamAppId Int?` is Steam-only. With a second provider, linkage must generalize.

**Decision:** Add a `ProviderMatch` table (`gameId`, `providerName`, `remoteId`, `matchScore`, `matchedAt`, `isPrimary`), unique on `(gameId, providerName)`. Only non-Steam providers write rows for now — Steam keeps writing `Game.steamAppId` (minimal-scope migration, ADR-009 storage remains Steam's source of truth). `MetadataService.refresh` checks `ProviderMatch` primary first, falls back to `steamAppId`.

**Consequences:**
- Two storage mechanisms coexist (debt). A future migration will backfill Steam into `ProviderMatch` and drop `steamAppId`.
- `MetadataService.assign(gameId, providerName, remoteId)` clears `steamAppId` when assigning a non-Steam provider — the primary switch is recorded in `ProviderMatch`.
- Only one `ProviderMatch` per game may be `isPrimary=true`; `upsert` demotes prior primary rows in a transaction.

## ADR-018 — First-Match-Wins Provider Ordering

**Context:** Multiple providers may return matches for the same query. Need a deterministic precedence for default (unscoped) search and auto-match.

**Decision:** `ProviderRegistry` returns providers in fixed insertion order: `['steam', 'igdb']`. `MetadataService.searchForGame` without a `providerName` returns concatenated results in registry order. Manual assignment is explicit — the UI passes the chosen `providerName` back.

**Consequences:**
- Auto-match (when added) will walk providers in order and stop on first acceptable score.
- Adding a third provider requires only appending to the registry; no negotiation logic.
- Users can always scope search/assign to a specific provider via the `?provider` body param.

## ADR-019 — Generic Artwork Cache Path for Non-Steam Providers

**Context:** `ArtworkService` keyed cache by `appId: number` — Steam-specific.

**Decision:** Add parallel generic methods (`downloadToCacheGeneric`, `readWithContentTypeGeneric`, `removeGeneric`, `cachePathGeneric`) keyed by `providerName/remoteId` strings. Steam methods untouched to preserve minimal scope (ADR-017 coexistence principle).

**Consequences:**
- Two API surfaces on `ArtworkService`. A future refactor will fold both into a single `cacheKey`-based API once Steam is also migrated to `ProviderMatch`.
- `artwork.controller` dispatches by primary `ProviderMatch` first, falls back to `steamAppId` — single URL serves both.

---

## Open Issues

Track here before they become closed decisions or roadmap tasks.

### O-1 — Incorrect Import Paths

- `src/http/server.ts` imports `'./config/index.js'` — resolves to `src/http/config/` (does not exist). Should be `'../config/index.js'` (matches `health.routes.ts`).
- `src/prisma-client.ts` imports `'../logger/index.js'` — from `src/`, resolves to `/logger/` (project root). Should be `'./logger/index.js'`.
- Symptom: build (`tsc`) would fail; dev (`tsx`) would fail at runtime on first import.
- Owner: Phase 1.

### O-2 — `DATABASE_URL` Not Seeded in Entrypoint

- `prisma/schema.prisma` reads `env("DATABASE_URL")`. `src/prisma-env.ts` exports `DATABASE_URL` programmatically, but Prisma CLI (`npx prisma migrate deploy` in `docker-entrypoint.sh`) reads `process.env.DATABASE_URL` — never set.
- Dockerfile sets `ENV DB_PATH` only; `DATABASE_URL` is not derived in the entry script.
- Symptom: first container start will fail at the `migrate deploy` step.
- Fix: `export DATABASE_URL="file:${DB_PATH}"` in `docker-entrypoint.sh` before `prisma migrate deploy`.
- Owner: Phase 1.

### O-3 — `web/` Referenced but Absent

- `Dockerfile` `COPY web/ web/` and `package.json` scripts `web:dev` / `web:build` reference a `web/` directory that does not exist.
- Symptom: production image build fails at `web-builder` stage.
- Decision needed: scaffold `web/` now or guard the `COPY web/` until scaffolding lands.
- Owner: Phase 11, but Dockerfile must not break in the interim — Phase 1 mitigation.

### O-4 — Version Hardcoded in `health.routes.ts`

- `GET /api/health` returns `version: '0.1.0'` literal. Should read from `package.json` (build-time injection or runtime import).
- Owner: Phase 1.

### O-5 — `BigInt` Serialization

- `Game.sizeBytes` is `BigInt`. `JSON.stringify` throws on BigInt. Services must `.toString()` or use a custom replacer before responses.
- Not a bug yet (no game endpoints implemented), but the contract is in place.
- Owner: surfaced at first game route (Phase 2 / Phase 4).

### O-6 — `DownloadSource` Returns `unknown[]`

- Contract in `src/shared/types.ts` left as `unknown[]`. Must be modeled before any concrete download source is implemented.
- Owner: Phase 7 (Download Sources).

### O-7 — `ImageSet.screenshots` Has No Storage

- Type exists; no Prisma model for screenshot rows.
- Owner: Phase 5 (Artwork).

### O-8 — Single-Provider Schema (resolved by ADR-017)

- Closed: `ProviderMatch` table added; IGDB writes rows. Steam still uses `Game.steamAppId`; future migration to consolidate is tracked as new debt.

### O-9 — No Auth

- `shared/errors.ts` lacks `UnauthorizedError` / `ForbiddenError`. No User/Session models. Endpoints are unauthenticated by design today.
- Owner: Phase 10.

### O-10 — No Tests

- vitest configured (`package.json`, `tsconfig.json` excludes `tests`). No test files exist.
- Owner: Phase 12.