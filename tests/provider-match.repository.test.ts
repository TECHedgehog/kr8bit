import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/prisma-client.js';
import { libraryRepository } from '../src/modules/library/library.repository.js';
import { providerMatchRepository } from '../src/modules/metadata/provider-match.repository.js';
import { EntryType, MatchStatus } from '../src/shared/enums.js';

const NOW = new Date('2024-06-01T00:00:00Z');
const LATER = new Date('2024-06-02T00:00:00Z');

async function makeGame(suffix = 'g.7z'): Promise<string> {
  const game = await libraryRepository.create({
    entryPath: `/games/${suffix}`,
    entryType: EntryType.ARCHIVE,
    entryName: suffix,
    sizeBytes: 1,
    matchStatus: MatchStatus.PENDING,
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

describe('providerMatchRepository.upsert', () => {
  it('inserts a new match on first call', async () => {
    const gameId = await makeGame('a.7z');
    const match = await providerMatchRepository.upsert({
      gameId,
      providerName: 'igdb',
      remoteId: '620',
      matchScore: 95,
      isPrimary: true,
      matchedAt: NOW,
    });

    expect(match.id).toMatch(/^[0-9a-f-]+$/);
    expect(match.gameId).toBe(gameId);
    expect(match.providerName).toBe('igdb');
    expect(match.remoteId).toBe('620');
    expect(match.matchScore).toBe(95);
    expect(match.isPrimary).toBe(true);
    expect(match.matchedAt).toEqual(NOW);
  });

  it('updates remoteId, score, and matchedAt on subsequent call', async () => {
    const gameId = await makeGame('b.7z');
    await providerMatchRepository.upsert({
      gameId,
      providerName: 'igdb',
      remoteId: '620',
      matchScore: 95,
      isPrimary: true,
      matchedAt: NOW,
    });

    const updated = await providerMatchRepository.upsert({
      gameId,
      providerName: 'igdb',
      remoteId: '9999',
      matchScore: 70,
      isPrimary: true,
      matchedAt: LATER,
    });

    expect(updated.remoteId).toBe('9999');
    expect(updated.matchScore).toBe(70);
    expect(updated.isPrimary).toBe(true);
    expect(updated.matchedAt).toEqual(LATER);
  });

  it('demotes prior primary row in same game when a new primary is upserted', async () => {
    const gameId = await makeGame('c.7z');
    await providerMatchRepository.upsert({
      gameId,
      providerName: 'steam',
      remoteId: '620',
      matchScore: 90,
      isPrimary: true,
      matchedAt: NOW,
    });
    await providerMatchRepository.upsert({
      gameId,
      providerName: 'igdb',
      remoteId: '620',
      matchScore: 88,
      isPrimary: true,
      matchedAt: LATER,
    });

    const matches = await providerMatchRepository.findByGame(gameId);
    expect(matches).toHaveLength(2);
    const steam = matches.find((m) => m.providerName === 'steam');
    const igdb = matches.find((m) => m.providerName === 'igdb');
    expect(steam?.isPrimary).toBe(false);
    expect(igdb?.isPrimary).toBe(true);
  });

  it('does not demote other rows when isPrimary is false', async () => {
    const gameId = await makeGame('d.7z');
    await providerMatchRepository.upsert({
      gameId,
      providerName: 'steam',
      remoteId: '620',
      matchScore: 90,
      isPrimary: true,
      matchedAt: NOW,
    });
    await providerMatchRepository.upsert({
      gameId,
      providerName: 'igdb',
      remoteId: '620',
      matchScore: 88,
      isPrimary: false,
      matchedAt: LATER,
    });

    const matches = await providerMatchRepository.findByGame(gameId);
    const steam = matches.find((m) => m.providerName === 'steam');
    const igdb = matches.find((m) => m.providerName === 'igdb');
    expect(steam?.isPrimary).toBe(true);
    expect(igdb?.isPrimary).toBe(false);
  });
});

describe('providerMatchRepository.findPrimaryByGame', () => {
  it('returns the primary match and null when none', async () => {
    const gameId = await makeGame('e.7z');
    expect(await providerMatchRepository.findPrimaryByGame(gameId)).toBeNull();

    await providerMatchRepository.upsert({
      gameId,
      providerName: 'igdb',
      remoteId: '620',
      matchScore: 95,
      isPrimary: true,
      matchedAt: NOW,
    });
    const primary = await providerMatchRepository.findPrimaryByGame(gameId);
    expect(primary?.providerName).toBe('igdb');
    expect(primary?.remoteId).toBe('620');
  });
});

describe('providerMatchRepository.findByProviderAndRemoteId', () => {
  it('looks up by provider + remoteId', async () => {
    const gameId = await makeGame('f.7z');
    await providerMatchRepository.upsert({
      gameId,
      providerName: 'igdb',
      remoteId: '1234',
      matchScore: 90,
      isPrimary: true,
      matchedAt: NOW,
    });

    const found = await providerMatchRepository.findByProviderAndRemoteId('igdb', '1234');
    expect(found?.gameId).toBe(gameId);
    expect(await providerMatchRepository.findByProviderAndRemoteId('igdb', 'nope')).toBeNull();
  });
});

describe('providerMatchRepository.deleteByGameAndProvider', () => {
  it('removes one provider row and leaves others', async () => {
    const gameId = await makeGame('g.7z');
    await providerMatchRepository.upsert({
      gameId,
      providerName: 'steam',
      remoteId: '7',
      matchScore: 90,
      isPrimary: true,
      matchedAt: NOW,
    });
    await providerMatchRepository.upsert({
      gameId,
      providerName: 'igdb',
      remoteId: '7',
      matchScore: 70,
      isPrimary: false,
      matchedAt: LATER,
    });

    await providerMatchRepository.deleteByGameAndProvider(gameId, 'igdb');

    const remaining = await providerMatchRepository.findByGame(gameId);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].providerName).toBe('steam');
  });
});

describe('providerMatchRepository.deleteByGame', () => {
  it('removes all rows for a game', async () => {
    const gameId = await makeGame('h.7z');
    await providerMatchRepository.upsert({
      gameId,
      providerName: 'steam',
      remoteId: '7',
      matchScore: 90,
      isPrimary: true,
      matchedAt: NOW,
    });
    await providerMatchRepository.upsert({
      gameId,
      providerName: 'igdb',
      remoteId: '7',
      matchScore: 70,
      isPrimary: false,
      matchedAt: LATER,
    });

    await providerMatchRepository.deleteByGame(gameId);

    expect(await providerMatchRepository.findByGame(gameId)).toEqual([]);
  });
});

describe('providerMatchRepository.findById', () => {
  it('returns the row by id and throws NotFoundError when missing', async () => {
    const gameId = await makeGame('i.7z');
    const created = await providerMatchRepository.upsert({
      gameId,
      providerName: 'igdb',
      remoteId: '1',
      matchScore: 50,
      isPrimary: true,
      matchedAt: NOW,
    });

    const found = await providerMatchRepository.findById(created.id);
    expect(found.id).toBe(created.id);

    await expect(providerMatchRepository.findById('nonexistent')).rejects.toThrow(/ProviderMatch/);
  });
});