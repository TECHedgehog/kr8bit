import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/prisma-client.js';
import { repackCatalogRepository } from '../src/modules/repack-catalog/repack-catalog.repository.js';
import { fitGirlGameTitle, normalizeFitGirlGameTitle } from '../src/modules/repack-catalog/sources/fitgirl/fitgirl.source.js';
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

  it('merges version and DLC variants under one base game, retaining best match', async () => {
    const matched = await repackCatalogRepository.upsertPost({
      ...post('https://fitgirl.test/gta-v-1/', 'GTA V v1'), gameTitle: 'GTA V', normalizedTitle: 'gta v',
    });
    await repackCatalogRepository.acceptMatch(matched.gameId!, {
      providerName: 'steam', remoteId: '271590', title: 'Grand Theft Auto V', score: 99,
    }, { remoteId: '271590', title: 'Grand Theft Auto V', developers: [], publishers: [], genres: [] });
    await repackCatalogRepository.upsertPost({
      ...post('https://fitgirl.test/gta-v-dlcs/', 'GTA V v2 + 10 DLCs'),
      gameTitle: 'GTA V 10', normalizedTitle: 'gta v 10', postKind: 'DLC',
    });

    await repackCatalogRepository.regroupGames((title) => ({
      gameTitle: fitGirlGameTitle(title), normalizedTitle: normalizeFitGirlGameTitle(title),
    }));

    const page = await repackCatalogRepository.listGames({ offset: 0, limit: 20 });
    expect(page.total).toBe(1);
    expect(page.items[0].id).toBe(matched.gameId);
    expect(page.items[0].title).toBe('GTA V');
    expect(page.items[0].matchStatus).toBe('MATCHED');
    expect(page.items[0].posts).toHaveLength(2);

    const beforeRepeat = await prisma.repackGame.findUnique({ where: { id: matched.gameId! }, select: { updatedAt: true } });
    await repackCatalogRepository.regroupGames((title) => ({
      gameTitle: fitGirlGameTitle(title), normalizedTitle: normalizeFitGirlGameTitle(title),
    }));
    const afterRepeat = await prisma.repackGame.findUnique({ where: { id: matched.gameId! }, select: { updatedAt: true } });
    expect(afterRepeat?.updatedAt).toEqual(beforeRepeat?.updatedAt);
  });
});
