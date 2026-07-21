# Providers

Providers are adapters for external APIs. They normalize responses into kr8bit DTOs. They never leak provider-specific models.

## Contracts

Defined in `src/shared/types.ts`.

### MetadataProvider

```ts
interface MetadataProvider {
  readonly name: string;
  search(query: string): Promise<SearchResult[]>;
  getGame(remoteId: string): Promise<GameMetadata | null>;
}
```

- `getGame` is nullable — a remote may return no match.
- `remoteId` is a stringified handle; provider-specific IDs (e.g. Steam `appId: number`) are stringified at the provider boundary.
- Artwork URLs ride inside `GameMetadata` (`coverUrl`, `headerUrl`); a separate `getImages` method was originally described here but was never implemented — the metadata fetch returns URLs which `ArtworkService` downloads.

### DownloadSource

```ts
interface DownloadSource {
  readonly name: string;
  search(query: string): Promise<unknown[]>;
  getDownloads(remoteId: string): Promise<unknown[]>;
}
```

- Result types are currently `unknown[]` — **need modeling** before implementing any download source (see `decisions.md`).
- Scraping belongs inside download sources only. No provider-scraping logic in services.

## DTOs

| DTO           | Fields                                                                                  |
|---------------|-----------------------------------------------------------------------------------------|
| `SearchResult`| `providerName`, `remoteId`, `title`, `releaseYear?`, `coverUrl?`, `score?`              |
| `GameMetadata`| `remoteId`, `title`, `releaseYear?`, `description?`, `developers[]`, `publishers[]`, `genres[]`, `coverUrl?`, `headerUrl?` |
| `ImageSet`    | `coverUrl?`, `headerUrl?`, `screenshots?[]`                                             |

Notes:
- `GameMetadata` fields align 1:1 with `Game` Prisma columns — provider output maps directly.
- `ImageSet.screenshots` is modeled but no screenshots storage table exists yet (roadmap).

## Extensibility Rule

Adding a new provider = creating a new provider file. Do **not** modify existing providers. Avoid editing implementations wherever possible.

- Good: `SteamProvider`, `IgdbProvider`, `GogProvider`.
- Banned names: `SteamHelper`, `MetadataManager`, `ProviderUtils`, `GenericData`, etc.

## Naming

- Must describe what it is: `SteamProvider`, `IgdbProvider`, `GogProvider`, `PcGwProvider`.

## Concrete Implementations

Two providers ship today:

### Steam (`src/modules/metadata/steam/`)

- `Game.steamAppId Int?` — Steam's linkage column (interim single-provider storage, kept for backward compatibility; see ADR-017).
- `SteamAppIndex` Prisma model — cached Steam app list, indexed on `name`.
- `STEAM_INDEX_REFRESH_INTERVAL_HOURS` env — app index refresh cadence (default 168h = 7 days).
- HTTP client: `undici`.
- Fuzzy: `fuse.js` to match scanner entry names to `SteamAppIndex.name`.
- Steam assignments do **not** write a `ProviderMatch` row — `Game.steamAppId` remains the source of truth.

### IGDB (`src/modules/metadata/igdb/`)

- Implements `MetadataProvider` against the IGDB v4 API (Twitch).
- OAuth client-credentials flow, token cached in-memory with 60s refresh margin.
- Fields mapped: `name` → title, `summary` → description, `first_release_date` → releaseYear (unix seconds → UTC year), `genres.name` → genres, `involved_companies.company.name` (filtered by `developer`/`publisher` flags) → developers/publishers, `cover.url` → coverUrl (resized to `t_1080p`), `artworks[0].url` → headerUrl.
- Image URL normalization: protocol-relative `//images.igdb.com/...` is upgraded to `https://`; the IGDB size segment (e.g. `/t_thumb/`) is replaced with the configured size.
- Credentials via env vars: `IGDB_CLIENT_ID`, `IGDB_CLIENT_SECRET`. When either is missing, `igdbProvider` is `null` and the registry omits it (logged at boot).
- IGDB assignments write a `ProviderMatch` row with `isPrimary=true` and clear `Game.steamAppId` (the primary switch is recorded in `ProviderMatch`).

## Provider Registry

`src/modules/metadata/provider-registry.ts` exports a `ProviderRegistry` with:

- `resolve(name): MetadataProvider | null`
- `order(): MetadataProvider[]` — insertion order: `['steam', 'igdb']`
- `has(name): boolean`
- `names(): string[]`

`MetadataService` consumes the registry; default registry is constructed at module load from `steamProvider` + `igdbProvider` (when enabled).

## Multi-Provider Storage

`ProviderMatch` table (see ADR-017):

| Field         | Type      | Notes                                  |
|---------------|-----------|----------------------------------------|
| `id`          | String    | UUID primary key                        |
| `gameId`      | String    | FK to `Game`                            |
| `providerName`| String    | e.g. `steam`, `igdb`                    |
| `remoteId`    | String    | stringified provider id                 |
| `matchScore`  | Float?    | optional match score                    |
| `matchedAt`   | DateTime  | when the match was made                 |
| `isPrimary`   | Boolean   | only one per game may be `true`         |

- Unique on `(gameId, providerName)` — a game may carry rows from multiple providers.
- Only one `isPrimary=true` per game; `upsert` demotes prior primary rows in a transaction.
- `MetadataService.refresh` checks primary `ProviderMatch` first, falls back to `Game.steamAppId`.
- `MetadataService.unlink` removes the primary provider's generic artwork cache + all `ProviderMatch` rows; if no `ProviderMatch` exists, removes Steam cache via `steamAppId`.
- Steam's `steamAppId` continues to function as legacy single-provider storage (debt tracked in ADR-017).

## Injection

No DI container. Providers are imported as singleton modules today. Watch as code grows — if a provider needs runtime config (e.g. API keys), pass it explicitly to a factory rather than reading env inside the provider.