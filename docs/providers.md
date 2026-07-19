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
  getImages(remoteId: string): Promise<ImageSet>;
}
```

- `getGame` is nullable — a remote may return no match.
- `remoteId` is a stringified handle; provider-specific IDs (e.g. Steam `appId: number`) are stringified at the provider boundary.

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
| `SearchResult`| `remoteId`, `title`, `releaseYear?`, `coverUrl?`, `score?`                             |
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

## Concrete Implementation

Currently implied: **Steam** only.

- `Game.steamAppId Int?` — linkage column.
- `SteamAppIndex` Prisma model — cached Steam app list, indexed on `name`.
- `STEAM_INDEX_REFRESH_INTERVAL_HOURS` env — app index refresh cadence (default 168h = 7 days).
- HTTP client: `undici` (dep present).
- Fuzzy: `fuse.js` to match scanner entry names to `SteamAppIndex.name`.

No provider filesystem module exists yet — see `roadmap.md`.

## Multi-Provider Constraint

Today's schema is single-provider by design (`steamAppId` column on `Game`). Extending to other providers will require either:

- per-provider nullable columns (`igdbId`, `gogId`, ...), or
- a `ProviderMatch` table (`gameId`, `providerName`, `remoteId`, `matchScore`, `matchedAt`).

The latter is the recommended path once a second provider is added. Track in `decisions.md`.

## Injection

No DI container. Providers are imported as singleton modules today. Watch as code grows — if a provider needs runtime config (e.g. API keys), pass it explicitly to a factory rather than reading env inside the provider.