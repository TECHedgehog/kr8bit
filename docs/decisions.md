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

## ADR-020 — UI Rework: Netflix-like Library with Glassmorphism

**Context:** Initial UI was functional but utilitarian — dark-only, text buttons, no icons, no routing, no light mode. User requested a Netflix/Basement-like experience: uncluttered, minimalist, icon-based actions with tooltips, light/dark mode.

**Decision:** Full frontend visual rework. Tech stack: React 18 + `react-router-dom` (replacing state-based tab nav), `lucide-react` for icons, `@fontsource/onest` for typography. Single `styles.css` rewritten with dual-theme CSS custom properties (`[data-theme="dark"]` / `[data-theme="light"]`), 4px-base spacing scale, typography scale, shadow scale, radius scale.

**Design tokens (dark):**
- `--bg: #08090c`, `--surface-1: #121419`, `--surface-2: #1a1d24`, `--surface-3: #252932`
- `--accent: #8288fe` (indigo, Basement-inspired), `--accent-glow: rgba(130,136,254,0.25)`
- `--glass-bg: rgba(18,20,25,0.7)`, `--glass-blur: blur(20px) saturate(160%)`
- Shadows: `--shadow-md` includes `inset 0 1px rgba(255,255,255,0.04)` hairline
- Card hover: `perspective(900px) scale(1.04) rotateX(1.5deg) rotateY(-1.5deg)` + accent glow + inset shine, `cubic-bezier(.16,1,.3,1)` easing

**Design tokens (light):**
- `--bg: #f6f7f9`, `--surface-1: #ffffff`, `--accent: #6366f1`

**Typography:** Onest (weights 400/500/600/700), `--text-xs` through `--text-3xl` scale, 1.5 line-height body / 1.2 headings.

**Layout:**
- TopBar: glassmorphic (`backdrop-filter`), sticky, logo + nav links + theme toggle
- Library page: icon toolbar (sort dropdown, filter dropdown, grid/list toggle, scan link), search bar, query-param URL state for all filters (`?view=&sort=&search=&status=&limit=&offset=`)
- Game grid: `repeat(auto-fill, minmax(170px, 1fr))`, `gap: 24px 16px` (generous, Basement-style)
- Game detail: full-width hero backdrop with gradient overlay, icon-only toolbar, metadata in 2-col grid sections
- Modal: glass panel with blurred backdrop

**Components:**
- `IconButton` — icon + tooltip + `aria-label`, variants: default/ghost/danger
- `Tooltip` — CSS-only, positioned above trigger, fade-in on hover
- `ToastContext` — `useToast({success, error, info})`, errors persist until dismissed, success/info 3s auto-dismiss
- `ThemeContext` — localStorage > `prefers-color-scheme` > dark default, `matchMedia` listener for system changes
- `ErrorBoundary` — catches runtime errors, displays message + stack
- `GameCard` — full-brightness cover, hover overlay with title + status badge fade-in, image error placeholder
- `GameListRow` — list view: 40px thumb, title, status, size, hover highlight

**Frozen (not modified this pass):**
- `PageHeader.tsx`, `StatusBadge.tsx` — CSS class names preserved for ScanPage compatibility
- `ScanPage.tsx`, `ScanProgress.tsx` — layout deferred, will inherit new tokens visually
- `api/*`, `format.ts` — no changes

**Consequences:**
- Scan page visually changes from token updates but layout/structure untouched — acknowledged scope boundary.
- `App.tsx` `Page` type removed (was frontend-internal, not exported).
- `styles.css` fully rewritten — all existing class names preserved for frozen components.
- Sort dropdown stores selection in URL but client-side sort logic not yet implemented (backend sort params or client-side sort needed).
- BrowserRouter works in Docker — Fastify `setNotFoundHandler` already serves `index.html` for non-API GET routes (SPA fallback).

**New dependencies:**
- `@fontsource/onest` (replaced `@fontsource/inter`)
- `lucide-react`
- `react-router-dom`

---

## ADR-021 — Semantic Versioning with Single Source of Truth

**Context:** Version `0.1.0` was hardcoded in `health.routes.ts` and duplicated across `package.json` + `web/package.json`. No git tags, no changelog, no release process. Risk of silent desync on every bump.

**Decision:** Semantic Versioning (`MAJOR.MINOR.PATCH`). Pre-1.0 (`0.x.x`): MINOR bump = feature, PATCH bump = fix. No stability guarantees until `1.0`.

Single source of truth: root `package.json` `version` field. One version for the whole monorepo. `web/package.json` version field removed. `health.routes.ts` reads version at runtime via `src/app-version.ts` (`fs.readFileSync` + `import.meta.url` — avoids `TS6059` rootDir conflict from JSON import).

Every release tagged `vX.Y.Z` in git. `CHANGELOG.md` maintained at repo root in Keep-a-Changelog format.

Manual release process (no CI/CD yet):
1. Bump `version` in root `package.json`
2. Add new section to `CHANGELOG.md`
3. Commit `chore(config): bump version to X.Y.Z`
4. `git tag vX.Y.Z`
5. Docker build/push — later when CI lands

**Consequences:**
- One edit site for version — no desync risk.
- `app-version.ts` works in both dev (`tsx` from `src/`) and prod (`node` from `dist/`) — `../package.json` resolves to repo root or `/app/` respectively.
- Runtime read adds negligible I/O (single `readFileSync` at module load).
- Release process is manual until CI/CD is added (future roadmap item).

## ADR-022 — Floating Glass Pill TopBar with Sliding Lens Indicator

**Context:** ADR-020 established the initial glassmorphic TopBar — full-width sticky bar, 56px tall, flush to viewport edges. User requested an iPhone/iOS-26-style floating centered pill with a sliding "liquid glass" lens indicator (not a segmented control fill). Referenced WWDC25 "Meet Liquid Glass" session for design principles: lensing (light bending, not scattering), clear variant (no color filter), materialize (not fade), grow-then-settle motion.

**Decision:**

Restyle TopBar to a centered floating pill (max 720px, `border-radius: 999px`, 12px float gap). Replace the active link fill with a separate `.topbar-indicator` div that slides between links via the CSS `translate` property (React measures active link offset/width via refs + `useLayoutEffect`).

**Liquid glass lens effect:**
- Clear (non-tinted) background: `rgba(255,255,255,0.03)` dark / `0.06` light
- `backdrop-filter: blur(10px) saturate(160%)` resting → `blur(20px) saturate(220%)` while moving (heavier distortion mid-slide)
- Chromatic aberration edges: inset red (left) + blue (right) box-shadow hairlines
- Rainbow refraction: `::before` pseudo with 5-stop iridescent gradient, `mix-blend-mode: overlay`
- Glass edges: inset top highlight + bottom shadow hairlines

**Animation:**
- Slide: CSS `transition` on `translate` + `width` — `0.6s cubic-bezier(0.34, 1.56, 0.64, 1)` (bouncy spring overshoot)
- Vertical bounce: `@keyframes lens-pulse` using `transform: scaleY()` — grow to 1.4x, slight undershoot to 0.92, settle to 1
- Animation restart on rapid clicks: direct DOM class toggle (`remove` → `void offsetWidth` → `add`) instead of React state — the standard CSS animation restart trick
- First-render suppression: `suppressTransition` state + `--no-transition` CSS class prevents the indicator from sliding in on page load/refresh; removed via `requestAnimationFrame` after first paint
- `onAnimationEnd` handler reverts heavier moving blur to resting state (replaces `setTimeout`)

**Tokens added:**
- `--topbar-top-gap: 12px`, `--topbar-max-w: 720px`, `--topbar-side-gap: 16px`
- `--lens-bg`, `--lens-blur`, `--lens-blur-moving`, `--lens-edge` (dark + light)
- `--seg-track-bg` for the segmented control track behind links

**Files modified:**
- `web/src/styles.css` — new tokens + restyled `.topbar`, `.topbar-nav`, `.topbar-indicator` + `::before`, `.topbar-indicator--moving`, `@keyframes lens-pulse`, `.topbar-indicator--no-transition`
- `web/src/components/layout/TopBar.tsx` — ref-based indicator measurement, `useLayoutEffect` for positioning, animation restart via DOM, first-render suppression via `requestAnimationFrame`
- `docs/tweak-reference.md` — new file documenting all animation/transition knobs
- `AGENTS.md` — rule 7 added: document tweakable behaviors in `docs/tweak-reference.md`

**Consequences:**
- TopBar class names preserved — no frozen-component breakage (PageHeader, StatusBadge, ScanPage).
- Pure CSS animation; no animation library dependency added.
- `translate` and `transform` are independent CSS properties — slide and bounce run simultaneously without conflict.
- `backdrop-filter` performance: two stacked blur layers (pill + indicator) — acceptable for a 52px bar, monitor on low-end devices.
- Safari requires `-webkit-backdrop-filter` prefix — included.
- Animation timing constant (600ms) must stay in sync between CSS (`animation-duration` + `transition-duration`) and React (currently just the `onAnimationEnd` handler — no hardcoded timeout).
- All tweakable values documented in `docs/tweak-reference.md` per AGENTS.md rule 7.

---

## ADR-023 — Liquid Glass as General Design Feature

**Context:** ADR-022 established the iOS 26 floating glass pill TopBar with a sliding liquid glass lens indicator. The liquid glass aesthetic needed to become a general feature of the program — game cards, search boxes, menus, buttons, tooltips, toasts, modals, and the view-toggle all needed to follow the same visual language. Unraid/Docker targets mean performance matters: `backdrop-filter: blur()` on 50+ game cards in a grid would be too expensive.

**Decision:**

Three-tier glass system driven by CSS custom properties, applied across all UI surfaces:

| Tier | Blur | Tokens | Elements |
|---|---|---|---|
| 1 — Liquid Glass | 32px saturate(180%) | `--liquid-glass-*` (existing) | Dropdowns, tooltip, toast, modal |
| 2 — Glass Surface | 20px saturate(160%) | `--glass-*` (existing) + new `--glass-edge` | Search box, `.card`, `.scan-progress`, view-toggle track, game-card overlay |
| 3 — Glass Tint | none | new `--glass-tint-bg`, `--glass-tint-hover-bg`, `--glass-tint-edge` | Buttons, icon-buttons, inputs, status-badge, error banner, game-list-row hover, theme-toggle hover, dropdown item hover |

Tier 3 preserves the visual language (translucency + edge highlights + hairline borders) without `backdrop-filter` cost — safe for grid of 50+ game cards.

**Game card overlay (iOS 26 media tile):** Card container becomes transparent (cover art is the surface). The bottom title/status strip gets tier 2 glass (`--glass-blur` + `--glass-bg` + gradient fade + `--glass-edge`), layered behind the existing gradient overlay.

**View-toggle sliding lens:** The segmented grid/list control gets a `.view-toggle-indicator` div mirroring the TopBar's `.topbar-indicator` — same `--lens-*` tokens, `lens-pulse` keyframe, chromatic `::before` gradient, spring easing (`cubic-bezier(0.34, 1.56, 0.64, 1)`), first-render suppression via `requestAnimationFrame`, and `onAnimationEnd` cleanup. Duration 0.4s (shorter than TopBar's 0.6s — smaller travel distance).

**Frozen components unfrozen:** ADR-020's freeze on ScanProgress, PageHeader, and StatusBadge is lifted for glass treatment. ScanProgress gets tier 2 glass. StatusBadge gets tier 3 tint. PageHeader remains layout-only (no surface).

**Tokens added:**
- `--glass-edge` (dark + light) — tier 2 edge highlights
- `--glass-tint-bg` (dark + light) — tier 3 translucent fill, no blur
- `--glass-tint-hover-bg` (dark + light) — tier 3 stronger hover fill
- `--glass-tint-edge` (dark + light) — tier 3 edge hairline

**Files modified:**
- `web/src/styles.css` — new tokens + restyled: `button`, `.icon-button`, `input/select/textarea`, `.error`, `.status-badge`, `.library-search`, `.card`, `.scan-progress`, `.search-result`, `.sort-menu-dropdown`, `.sort-menu-item`, `.filter-menu-dropdown`, `.filter-menu-item`, `.tooltip`, `.toast` (+ variants), `.modal`, `.game-card`, `.game-card-overlay`, `.game-list-row`, `.theme-toggle`, `.modal-close`, `.view-toggle` + new `.view-toggle-indicator` (+ `::before`, `--no-transition`, `--moving`)
- `web/src/pages/GamesPage.tsx` — view-toggle lens indicator: `useLayoutEffect` measurement, `viewIsFirstRender` ref, `viewSuppressTransition` state, `viewToggleRef`/`viewToggleIndicatorRef`, `onAnimationEnd` handler
- `docs/tweak-reference.md` — new sections: glass tier tokens, tier→element mapping, tweak guide, view-toggle lens knobs
- `docs/decisions.md` — this ADR

**Consequences:**
- ADR-020 freeze on ScanProgress/StatusBadge lifted — these now visually change with glass tokens.
- All glass properties centralized in tokens — theme switching stays single-point.
- Tier 3 (no blur) on high-count elements (game cards, buttons, rows) keeps GPU cost minimal on Unraid/Docker.
- Two stacked blur layers on game-card overlay (gradient + backdrop-filter) — acceptable for a single hovered card, monitor on very low-end devices.
- `lens-pulse` keyframe is now shared between TopBar and view-toggle — changes to the keyframe affect both.
- View-toggle lens duration (0.4s) intentionally shorter than TopBar (0.6s) — smaller travel distance, same easing.
- Safari requires `-webkit-backdrop-filter` — included on all tier 1/tier 2 elements.
- `--glass-bg` / `--glass-blur` (tier 2, from ADR-020) remain for backward compat; `.modal` upgraded from tier 2 to tier 1 (`--liquid-glass-*`).

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

### O-4 — Version Hardcoded in `health.routes.ts` (resolved by ADR-021)

- Closed: `health.routes.ts` now imports version from `src/app-version.ts`, which reads `package.json` at runtime. Single source of truth established. `web/package.json` version field removed.

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

### O-11 — Sort Dropdown Not Wired to Backend

- GamesPage sort menu (`?sort=title-asc|title-desc|newest|oldest|largest|smallest`) updates URL params but the API fetch does not pass sort params to `GET /api/games`. Client-side sorting not implemented either.
- Fix: either add sort params to the backend `/api/games` endpoint, or sort client-side after fetch.
- Owner: future UI task.

### O-12 — Scan Page Layout Not Reworked

- ScanPage and ScanProgress use shared CSS class names (`.scan-progress`, `.scan-run`, `.card`, `.page-header`) which now reference new token values — visual appearance changed but layout/structure is frozen.
- Scan page should get the same treatment as Library + Detail pages: icon buttons, glassmorphism, toolbars, toast integration.
- Owner: future UI task.

### O-13 — Static Asset Serving in Docker

- Backend `@fastify/static` with `wildcard: false` does not serve files under `/assets/` — returns `index.html` for all non-API GET routes (SPA fallback). The JS/CSS bundles at `/assets/index-*.js` return HTML instead of the actual file.
- Dev server (`:5173`) works fine; issue only affects production/Docker.
- Fix: likely need `@fastify/static` `wildcard: true` or configure `decorateReply` + prefix properly, or use a separate route for `/assets/`.
- Owner: blocking for Docker deployment.

- vitest configured (`package.json`, `tsconfig.json` excludes `tests`). No test files exist.
- Owner: Phase 12.

---

## ADR-024: Pointer-Driven 3D Tilt and Subtle Glow

### Context
User requested Apple TV-style interactions: 3D tilt following pointer position, plus a localized glassy light spot that tracks the cursor. Search bar should get a border-only glow (no 3D tilt). Disabled on touch and respects `prefers-reduced-motion`.

### Decision
Implement as a single reusable React hook `useTiltGlow` + CSS custom properties. No animation library added (vanilla, consistent with ADR-022 precedent). The hook computes normalized pointer offset and writes `--tilt-rx`, `--tilt-ry`, `--glow-x`, `--glow-y`, `--glow-on`, `--tilt-active-scale` directly onto the element.

- **Tilt**: `perspective(900px) rotateX(var(--tilt-rx)) rotateY(var(--tilt-ry)) scale(var(--tilt-active-scale))` on `.game-card` and `.topbar`
- **Specular glow**: `::before` radial-gradient offset by tilt direction (radius 400px, strength 0.15) so glow is on the tilted edge, not the cursor
- **Search bar halo glow**: `.library-search.tilt-glow` overrides `::before` with `inset: -4px; z-index: -1` for a soft behind-border halo
- **Grow/leave animations**: JS `requestAnimationFrame` lerp on both enter (250ms) and leave (400ms)
- **Safety**: early return when `pointer: coarse` or `prefers-reduced-motion: reduce`

### Consequences
- One hook reused across all target surfaces (GameCard, library-search, TopBar). Adding to a new surface = add class + ref.
- Touch devices pay zero cost (no listeners, no pseudos visible).
- No CSS `transition` conflicts because JS drives the animation entirely via RAF.
- `overflow: hidden` on `.game-card` clips the glow at card edges — acceptable by design.
- Existing `.game-card:hover` static tilt removed and replaced by pointer-driven tilt (user-approved).

### Tokens added
- Shared: `--tilt-max`, `--tilt-perspective`, `--tilt-active-scale`, `--tilt-settle-ms`, `--glow-radius`, `--glow-strength`
- Theme-dependent: `--glow-color` (dark `0.35`, light `0.65`)

### Files modified
- `web/src/hooks/useTiltGlow.ts` (new)
- `web/src/styles.css`
- `web/src/components/GameCard.tsx`
- `web/src/components/IconButton.tsx`
- `web/src/components/layout/TopBar.tsx`
- `web/src/pages/GamesPage.tsx`

### Frozen list
- Existing box-shadow/border-color/z-index hover behavior on `.game-card` preserved.
- `.game-card-overlay` opacity transition preserved.
- `.topbar-indicator` lens system untouched.
- `.view-toggle` lens system untouched.
- No other hover styles modified.

---

## ADR-025 — TopBar Indicator Measurement Corrections

### Context
ADR-022 established the sliding lens indicator on the TopBar, using `getBoundingClientRect()` to measure the active link's position and width. Two bugs emerged in practice:

1. **Transform double-scaling:** `.topbar` carries `tilt-glow` (ADR-024), which applies `transform: scale(var(--tilt-active-scale))`. When the user hovers over the topbar to click a nav link, `--tilt-active-scale` ramps up to 1.06×. `getBoundingClientRect()` returns the **rendered** (scaled) box, but the indicator is also a child of the scaled `.topbar`, so it receives the scale a second time. The result is an indicator that is visually oversized and shifted to the right — worse on the rightmost link because the absolute offset is larger.
2. **Font-load race:** The Onest webfont is loaded via `@fontsource/onest` with `font-display: swap`. The initial `useLayoutEffect` measures with fallback system-font metrics. When the webfont swaps in, text reflows but the indicator is never re-measured. Shorter labels (e.g. "Scan") shift proportionally more than longer ones.

### Decision

Switch the measurement API from `getBoundingClientRect()` to `offsetLeft` / `offsetWidth`. These return **layout box** dimensions, which are immune to ancestor `transform` scale. The topbar's scale now applies equally to both the link and the indicator, keeping them visually aligned.

Add a one-shot `document.fonts.ready` listener that flips a `fontReady` state. A separate `useLayoutEffect [fontReady]` re-measures the indicator **silently** (`suppressTransition = true`, snap to new position, re-enable transitions on next `requestAnimationFrame`) when the font finally settles.

Also tighten the link padding (`var(--space-3)` → `var(--space-2)`, 12px → 8px horizontal) and add `justify-content: center` so the icon+text group sits in the middle of the padded pill, making the full-width indicator feel naturally centered.

### Files modified
- `web/src/components/layout/TopBar.tsx` — measurement switched to `offsetLeft`/`offsetWidth`; `fontReady` state + `document.fonts.ready` listener + silent re-measurement `useLayoutEffect`; `justify-content: center` on `.topbar-link`
- `web/src/styles.css` — `.topbar-link` padding reduced; added categorizing banner comments above `.topbar-indicator`, `.topbar-indicator--moving`, `@keyframes lens-pulse`, `.view-toggle-indicator`, `.view-toggle-indicator--moving`, `.tilt-glow`
- `docs/tweak-reference.md` — updated measurement description

### Consequences
- Indicator now correctly tracks links during hover (when `.topbar` is scaled) and after font swap.
- `offsetLeft` is relative to `offsetParent` (`.topbar-nav`). If `.topbar-nav` ever gains padding or border, the arithmetic must be adjusted.
- `document.fonts.ready` fires once per page lifetime. The `fontReady` effect runs exactly once; navigation transitions are not disturbed.

---

## ADR-026 — TopBar Floating Fix + Light Mode Visibility

### Context
Two issues reported on the TopBar:
1. **Bar scrolls away when scrolling down.** The CSS had `position: sticky` on `.topbar` (styles.css:194), but the element also carries the `.tilt-glow` class. The base `.tilt-glow` rule sets `position: relative` (styles.css:1106) and appears later in the cascade, silently overriding `position: sticky` (and later `position: fixed`) so the bar never actually stuck or floated.
2. **Light mode glass is too subtle.** The selector lens (`--lens-bg: rgba(255,255,255,0.04)`) is nearly invisible on an already-light bar (`--liquid-glass-bg: rgba(230,232,240,0.35)`). The bar itself also felt weak against bright backgrounds.

### Decision

**Floating:** Switch `.topbar` to `position: fixed` and add `position: fixed` to the more-specific `.topbar.tilt-glow` override so the base `.tilt-glow` `position: relative` is defeated. Center the fixed pill with `left: 50%` plus `transform: translateX(-50%)` merged into the existing `.topbar.tilt-glow` transform string. Add `width: 100%` so the fixed element still stretches to its `max-width: 720px` (without this, fixed elements shrink to content width). Compensate for the removed flow space by adding `padding-top: var(--topbar-flow-offset)` to `.app-content` and introducing the `--topbar-flow-offset: 80px` token (12px top gap + 52px height + 16px bottom margin).

Convert `.app-layout` from `display: flex; flex-direction: column` to plain block flow so the fixed bar's containing block is the simple document viewport, not a flex container.

**Light mode visibility:** Add scoped light-only overrides that do NOT touch shared tokens:
- `.topbar`: `background: rgba(230,232,240,0.5)` (up from 0.35), stronger shadow `0 10px 30px rgba(0,0,0,0.16)`, and border `rgba(0,0,0,0.08)`.
- `.topbar-indicator`: `background: rgba(30,32,40,0.08)` — a neutral dark glass tint that reads clearly on the light bar while keeping the blur+edge system intact.

### Files modified
- `web/src/styles.css` — `.topbar` switched to `position: fixed` + `left: 50%` + `width: 100%` + `margin: 0`; `.topbar.tilt-glow` override adds `position: fixed` and `translateX(-50%)`; `.app-layout` flex removed; `.app-content` gets `padding-top` + `min-height`; new `--topbar-flow-offset` token; scoped light-mode `.topbar` and `.topbar-indicator` overrides.
- `docs/tweak-reference.md` — documented `--topbar-flow-offset`, light-mode override knobs, and the fixed-positioning note.

### Consequences
- Bar now truly floats and stays pinned at `top: 12px` for the entire scroll.
- Light mode bar and lens are noticeably more prominent without touching dark mode or other liquid-glass surfaces.
- `.app-layout` is no longer a flex container; `.app-content` uses `min-height` to preserve the "fill viewport when short" behavior.
- The fixed bar relies on `.app-content` padding for layout compensation. Any future page that bypasses `.app-content` would sit under the bar.