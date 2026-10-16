import { basename, dirname } from 'node:path';
import { config } from '../../config/index.js';
import { logger } from '../../logger/index.js';
import { MatchStatus } from '../../shared/enums.js';
import { normalizeForMatch, normalizeGameName } from '../../shared/normalize.js';
import type { GameMetadata, MetadataProvider } from '../../shared/types.js';
import { isDemoSessionRoot, LEGACY_DEMO_SESSION_ROOT } from '../../http/demo-session.js';
import { libraryRepository } from '../library/library.repository.js';
import { steamProvider } from '../metadata/steam/steam.provider.js';
import type { DirectoryReader } from '../scanner/folder-scanner.js';
import type { ScannerDeps } from '../scanner/scanner.service.js';
import { DEMO_GAMES } from './demo-data.js';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

let seededGames = DEMO_GAMES;
let metadataByAppId = new Map<number, GameMetadata>();

async function fetchDemoMetadata(
  games: typeof DEMO_GAMES,
  provider: MetadataProvider,
): Promise<Array<{ seed: (typeof DEMO_GAMES)[number]; metadata: GameMetadata }>> {
  const results: Array<{ seed: (typeof DEMO_GAMES)[number]; metadata: GameMetadata }> = [];
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (nextIndex < games.length) {
      const seed = games[nextIndex++];
      if (provider === steamProvider && nextIndex > 1) await sleep(config.demoSteamDelayMs);
      const metadata = await provider.getGame(String(seed.appId));
      if (metadata) results.push({ seed, metadata });
      else logger.warn({ appId: seed.appId }, 'demo game skipped; Steam metadata unavailable');
    }
  };
  await Promise.all(Array.from({ length: provider === steamProvider ? 1 : Math.min(4, games.length) }, () => worker()));
  return results;
}

export async function seedDemoCatalog(provider: MetadataProvider = steamProvider): Promise<void> {
  const candidates = DEMO_GAMES.slice(0, config.demoGameCount);
  const available = provider === steamProvider ? [] : await fetchDemoMetadata(candidates, provider);
  seededGames = candidates;
  metadataByAppId = new Map(available.map(({ seed, metadata }) => [seed.appId, metadata]));
}

export async function refreshDemoMetadata(provider: MetadataProvider = steamProvider): Promise<void> {
  const available = await fetchDemoMetadata(seededGames, provider);
  metadataByAppId = new Map(available.map(({ seed, metadata }) => [seed.appId, metadata]));
  logger.info({ games: available.length }, 'demo metadata refreshed');
}

async function applyDemoMetadata(gameId: string, metadata: GameMetadata): Promise<void> {
  await libraryRepository.update(gameId, {
    title: metadata.title,
    releaseYear: metadata.releaseYear ?? null,
    description: metadata.description ?? null,
    developers: [...metadata.developers],
    publishers: [...metadata.publishers],
    genres: [...metadata.genres],
    coverUrl: metadata.coverUrl ?? null,
    headerUrl: metadata.headerUrl ?? null,
    heroUrl: metadata.heroUrl ?? null,
    logoUrl: metadata.logoUrl ?? null,
    screenshots: metadata.screenshots ?? [],
    videos: metadata.videos ?? [],
    steamDeckCategory: metadata.steamDeckCompat?.category ?? null,
    steamDeckItems: metadata.steamDeckCompat?.items ?? [],
    matchStatus: MatchStatus.ACCEPTED,
    matchScore: 100,
    matchedAt: new Date(),
  });
}

const reader: DirectoryReader = {
  async readdir(path) {
    if (!isDemoSessionRoot(path)) throw new Error(`ENOENT: ${path}`);
    return seededGames.map(({ entryName }) => `${entryName}.7z`);
  },
  async stat(path) {
    const seed = seededGames.find(({ entryName }) =>
      `${entryName}.7z` === basename(path) && isDemoSessionRoot(`${dirname(path)}/`),
    );
    if (!seed) throw new Error(`ENOENT: ${path}`);
    return { size: seed.sizeBytes, isDirectory: () => false, isFile: () => true };
  },
};

const provider: MetadataProvider = {
  name: 'steam',
  async search(query) {
    const normalizedQuery = normalizeForMatch(query);
    return seededGames.flatMap((seed) => {
      const metadata = metadataByAppId.get(seed.appId);
      if (!metadata || normalizeForMatch(normalizeGameName(seed.entryName).query) !== normalizedQuery) return [];
      return [{
        providerName: 'steam',
        remoteId: String(seed.appId),
        title: metadata.title,
        releaseYear: metadata.releaseYear,
        score: 100,
      }];
    });
  },
  async getGame(remoteId) {
    return metadataByAppId.get(Number(remoteId)) ?? null;
  },
};

export function demoScannerDeps(): ScannerDeps {
  return {
    providers: [provider],
    reader,
    now: () => new Date(),
    libraryRoot: LEGACY_DEMO_SESSION_ROOT,
    metadataRefresh: {
      async refresh(gameId) {
        const game = await libraryRepository.findById(gameId);
        if (game.steamAppId === null) return;
        const metadata = metadataByAppId.get(game.steamAppId);
        if (metadata) await applyDemoMetadata(gameId, metadata);
      },
    },
    pace: () => sleep(config.demoScanStepDelayMs),
  };
}
