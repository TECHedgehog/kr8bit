import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/prisma-client.js';
import { libraryRepository } from '../src/modules/library/library.repository.js';
import { providerMatchRepository } from '../src/modules/metadata/provider-match.repository.js';
import {
  findOrphanedProviderMatches,
  cleanOrphanedProviderMatches,
  findStaleSteamAppIds,
  cleanStaleSteamAppIds,
} from '../src/modules/database/orphan-cleanup.js';
import { EntryType, MatchStatus } from '../src/shared/enums.js';

const NOW = new Date('2024-06-01T00:00:00Z');

async function makeGame(entryName: string, status = MatchStatus.PENDING): Promise<string> {
  const game = await libraryRepository.create({
    entryPath: `/games/${entryName}`,
    entryType: EntryType.ARCHIVE,
    entryName,
    sizeBytes: 1,
    matchStatus: status,
  });
  return game.id;
}

beforeEach(async () => {
  await prisma.providerMatch.deleteMany({});
  await prisma.game.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('cleanOrphanedProviderMatches', () => {
  it('deletes matches whose game no longer exists and keeps valid matches', async () => {
    const keptGameId = await makeGame('kept.7z', MatchStatus.PENDING);
    await providerMatchRepository.upsert({
      gameId: keptGameId,
      providerName: 'steam',
      remoteId: '1',
      matchScore: 90,
      isPrimary: true,
      matchedAt: NOW,
    });
    await providerMatchRepository.upsert({
      gameId: 'deleted-game-id',
      providerName: 'steam',
      remoteId: '2',
      matchScore: 90,
      isPrimary: true,
      matchedAt: NOW,
    });

    const count = await cleanOrphanedProviderMatches();

    expect(count).toBe(1);
    const remaining = await prisma.providerMatch.findMany({});
    expect(remaining).toHaveLength(1);
    expect(remaining[0].gameId).toBe(keptGameId);
  });

  it('returns 0 when there are no orphans', async () => {
    const gameId = await makeGame('solo.7z', MatchStatus.PENDING);
    await providerMatchRepository.upsert({
      gameId,
      providerName: 'steam',
      remoteId: '1',
      matchScore: 90,
      isPrimary: true,
      matchedAt: NOW,
    });

    const count = await cleanOrphanedProviderMatches();

    expect(count).toBe(0);
  });
});

describe('findOrphanedProviderMatches', () => {
  it('lists ids of provider matches without a game', async () => {
    await providerMatchRepository.upsert({
      gameId: 'orphan-1',
      providerName: 'steam',
      remoteId: '1',
      matchScore: 90,
      isPrimary: true,
      matchedAt: NOW,
    });
    await providerMatchRepository.upsert({
      gameId: 'orphan-2',
      providerName: 'steam',
      remoteId: '2',
      matchScore: 90,
      isPrimary: true,
      matchedAt: NOW,
    });

    const ids = await findOrphanedProviderMatches();

    expect(ids).toHaveLength(2);
  });
});

describe('cleanStaleSteamAppIds', () => {
  it('nulls steamAppId for non-accepted/non-manual statuses and keeps valid ones', async () => {
    const pending = await makeGame('pending.7z', MatchStatus.PENDING);
    const accepted = await makeGame('accepted.7z', MatchStatus.ACCEPTED);
    const manual = await makeGame('manual.7z', MatchStatus.MANUAL);
    const rejected = await makeGame('rejected.7z', MatchStatus.REJECTED);
    const flagged = await makeGame('flagged.7z', MatchStatus.FLAGGED);

    for (const id of [pending, accepted, manual, rejected, flagged]) {
      await libraryRepository.update(id, { steamAppId: 12345 });
    }

    const count = await cleanStaleSteamAppIds();

    expect(count).toBe(3);
    const rows = await prisma.game.findMany({ where: { id: { in: [pending, accepted, manual, rejected, flagged] } } });
    const byId = new Map(rows.map((r) => [r.id, r.steamAppId]));
    expect(byId.get(pending)).toBeNull();
    expect(byId.get(rejected)).toBeNull();
    expect(byId.get(flagged)).toBeNull();
    expect(byId.get(accepted)).toBe(12345);
    expect(byId.get(manual)).toBe(12345);
  });

  it('returns 0 when no stale steamAppIds exist', async () => {
    const gameId = await makeGame('clean.7z', MatchStatus.ACCEPTED);
    await libraryRepository.update(gameId, { steamAppId: 12345 });

    const count = await cleanStaleSteamAppIds();

    expect(count).toBe(0);
  });
});

describe('findStaleSteamAppIds', () => {
  it('lists games with stale steamAppIds', async () => {
    const stale = await makeGame('stale.7z', MatchStatus.REJECTED);
    await libraryRepository.update(stale, { steamAppId: 999 });

    const rows = await findStaleSteamAppIds();

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(stale);
    expect(rows[0].steamAppId).toBe(999);
  });
});
