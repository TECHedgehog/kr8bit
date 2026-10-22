import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/prisma-client.js';
import { repackCatalogRepository } from '../src/modules/repack-catalog/repack-catalog.repository.js';
import type { RepackPostInput } from '../src/modules/repack-catalog/repack-catalog.types.js';

beforeEach(async () => {
  await prisma.repackPost.deleteMany({});
  await prisma.repackGame.deleteMany({});
});

afterAll(async () => { await prisma.$disconnect(); });

function post(sourceUrl: string, title = 'Example Game'): RepackPostInput {
  return {
    source: 'fitgirl', sourceUrl, title, gameTitle: 'Example Game', normalizedTitle: 'example game',
    tags: ['Action'], details: { 'Repack Size': '12 GB' }, downloadOptions: [{ label: 'Mirror', url: 'https://example.test/file' }],
    postKind: 'GAME', contentHash: `hash-${sourceUrl}`,
  };
}

describe('repackCatalogRepository', () => {
  it('aggregates repeated source posts under one catalog game', async () => {
    const first = await repackCatalogRepository.upsertPost(post('https://fitgirl.test/game/'));
    const update = await repackCatalogRepository.upsertPost({ ...post('https://fitgirl.test/game-update/', 'Example Game Update'), postKind: 'UPDATE' });
    expect(first.gameId).toBe(update.gameId);
    const page = await repackCatalogRepository.listGames({ offset: 0, limit: 20 });
    expect(page.total).toBe(1);
    expect(page.items[0].posts).toHaveLength(2);
    expect(page.items[0].posts[0]).not.toHaveProperty('contentText');
  });

  it('returns selected FitGirl fields and tags without article text', async () => {
    const saved = await repackCatalogRepository.upsertPost(post('https://fitgirl.test/game/'));
    const detail = await repackCatalogRepository.getGame(saved.gameId!);
    expect(detail?.tags).toEqual(['Action']);
    expect(detail?.posts[0].tags).toEqual(['Action']);
    expect(detail?.posts[0]).not.toHaveProperty('contentText');
    expect(detail?.posts[0].details).toEqual({ 'Repack Size': '12 GB' });
  });

  it('persists candidate queue and accepted metadata snapshot', async () => {
    const saved = await repackCatalogRepository.upsertPost(post('https://fitgirl.test/game/'));
    const candidate = { providerName: 'steam', remoteId: '620', title: 'Portal 2', score: 82 };
    await repackCatalogRepository.saveCandidates(saved.gameId!, [candidate], 'REVIEW');
    expect((await repackCatalogRepository.listReview({ offset: 0, limit: 20 })).items[0].matchCandidates).toEqual([candidate]);
    await repackCatalogRepository.acceptMatch(saved.gameId!, candidate, {
      remoteId: '620', title: 'Portal 2', developers: [], publishers: [], genres: ['Puzzle'],
    });
    const detail = await repackCatalogRepository.getGame(saved.gameId!);
    expect(detail?.matchStatus).toBe('MATCHED');
    expect(detail?.metadataSnapshot).toMatchObject({ title: 'Portal 2' });
    expect(detail?.matchCandidates).toEqual([candidate]);
  });

  it('persists provisional metadata and filter fields for review games', async () => {
    const saved = await repackCatalogRepository.upsertPost(post('https://fitgirl.test/provisional/'));
    const candidate = { providerName: 'steam', remoteId: '620', title: 'Portal 2', score: 80 };
    await repackCatalogRepository.saveCandidates(saved.gameId!, [candidate], 'REVIEW', 80, {
      remoteId: '620', providerName: 'steam', fetchedAt: new Date().toISOString(), title: 'Portal 2',
      developers: ['Valve'], publishers: ['Valve'], genres: ['Puzzle'],
      steamDeckCompat: { category: 3, items: [] },
    });

    const detail = await repackCatalogRepository.getGame(saved.gameId!);
    expect(detail?.matchStatus).toBe('REVIEW');
    expect(detail?.metadataSnapshot).toMatchObject({ providerName: 'steam', title: 'Portal 2' });
    expect(detail?.genres).toBe(JSON.stringify(['Puzzle']));
    expect(detail?.steamDeckCategory).toBe(3);
    expect(await repackCatalogRepository.listGenres()).toContain('Puzzle');

    await repackCatalogRepository.saveCandidates(saved.gameId!, [candidate], 'PENDING', 0, null);
    const pending = await repackCatalogRepository.getGame(saved.gameId!);
    expect(pending?.metadataSnapshot).toBeNull();
    expect(pending?.genres).toBe('[]');
    expect(pending?.steamDeckCategory).toBeNull();
  });

  it('filters repacks by genre, Deck compatibility, and match status', async () => {
    const first = await repackCatalogRepository.upsertPost({
      ...post('https://fitgirl.test/filter-alpha/'), gameTitle: 'Alpha Game', normalizedTitle: 'alpha game',
      publishedAt: new Date('2024-01-01T00:00:00.000Z'),
    });
    const second = await repackCatalogRepository.upsertPost({
      ...post('https://fitgirl.test/filter-beta/'), gameTitle: 'Beta Game', normalizedTitle: 'beta game',
      publishedAt: new Date('2025-01-01T00:00:00.000Z'),
    });
    await repackCatalogRepository.acceptMatch(first.gameId!, {
      providerName: 'steam', remoteId: '1', title: 'Alpha Game', score: 95,
    }, {
      remoteId: '1', title: 'Alpha Game', developers: [], publishers: [], genres: ['RPG'],
      steamDeckCompat: { category: 3, items: [] },
    });
    await repackCatalogRepository.acceptMatch(second.gameId!, {
      providerName: 'steam', remoteId: '2', title: 'Beta Game', score: 95,
    }, {
      remoteId: '2', title: 'Beta Game', developers: [], publishers: [], genres: ['RPG'],
      steamDeckCompat: { category: 2, items: [] },
    });

    const filtered = await repackCatalogRepository.listGames({
      offset: 0, limit: 20, genres: ['RPG'], steamDeck: [3], matchStatus: ['MATCHED'],
    });
    expect(filtered.items.map((game) => game.id)).toEqual([first.gameId]);
    expect(await repackCatalogRepository.listGenres()).toEqual(['RPG']);
  });

  it('sorts by latest source post date and tracks latest date after upsert', async () => {
    const older = await repackCatalogRepository.upsertPost({
      ...post('https://fitgirl.test/older/'), gameTitle: 'Older Game', normalizedTitle: 'older game',
      publishedAt: new Date('2023-01-01T00:00:00.000Z'),
    });
    const newer = await repackCatalogRepository.upsertPost({
      ...post('https://fitgirl.test/newer/'), gameTitle: 'Newer Game', normalizedTitle: 'newer game',
      publishedAt: new Date('2025-01-01T00:00:00.000Z'),
    });

    const newest = await repackCatalogRepository.listGames({ offset: 0, limit: 20, sort: 'newest' });
    const oldest = await repackCatalogRepository.listGames({ offset: 0, limit: 20, sort: 'oldest' });
    expect(newest.items.map((game) => game.id)).toEqual([newer.gameId, older.gameId]);
    expect(oldest.items.map((game) => game.id)).toEqual([older.gameId, newer.gameId]);
    expect(newest.items[0].latestPostAt?.toISOString()).toBe('2025-01-01T00:00:00.000Z');
  });

  it('lists pending, review, and rejected games for retry', async () => {
    const pending = await repackCatalogRepository.upsertPost(post('https://fitgirl.test/pending/'));
    const review = await repackCatalogRepository.upsertPost({ ...post('https://fitgirl.test/review/'), normalizedTitle: 'review game' });
    const rejected = await repackCatalogRepository.upsertPost({ ...post('https://fitgirl.test/rejected/'), normalizedTitle: 'rejected game' });
    const matched = await repackCatalogRepository.upsertPost({ ...post('https://fitgirl.test/matched/'), normalizedTitle: 'matched game' });
    await repackCatalogRepository.saveCandidates(review.gameId!, [], 'REVIEW', 80);
    await repackCatalogRepository.saveCandidates(rejected.gameId!, [], 'REJECTED', 20);
    await repackCatalogRepository.acceptMatch(matched.gameId!, {
      providerName: 'steam', remoteId: '620', title: 'Portal 2', score: 98,
    }, { remoteId: '620', title: 'Portal 2', developers: [], publishers: [], genres: [] });

    const ids = (await repackCatalogRepository.findRematchableGames()).map((game) => game.id);
    expect(ids).toEqual(expect.arrayContaining([pending.gameId, review.gameId, rejected.gameId]));
    expect(ids).not.toContain(matched.gameId);
  });
});
