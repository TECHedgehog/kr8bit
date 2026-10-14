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
    source: 'fitgirl', sourceUrl, title, normalizedTitle: 'example game', contentText: 'full visible post text',
    details: { 'Repack Size': '12 GB' }, downloadOptions: [{ label: 'Mirror', url: 'https://example.test/file' }],
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

  it('returns visible text and structured fields from game detail only', async () => {
    const saved = await repackCatalogRepository.upsertPost(post('https://fitgirl.test/game/'));
    const detail = await repackCatalogRepository.getGame(saved.gameId!);
    expect(detail?.posts[0].contentText).toBe('full visible post text');
    expect(detail?.posts[0].details).toEqual({ 'Repack Size': '12 GB' });
  });

  it('persists candidate queue and accepted metadata snapshot', async () => {
    const saved = await repackCatalogRepository.upsertPost(post('https://fitgirl.test/game/'));
    const candidate = { providerName: 'steam', remoteId: '620', title: 'Portal 2', score: 82 };
    await repackCatalogRepository.saveCandidates(saved.gameId!, [candidate], 'REVIEW');
    expect((await repackCatalogRepository.listReview({ offset: 0, limit: 20 })).items[0].matchCandidates).toEqual([candidate]);
    await repackCatalogRepository.acceptMatch(saved.gameId!, candidate, { title: 'Portal 2', genres: ['Puzzle'] });
    const detail = await repackCatalogRepository.getGame(saved.gameId!);
    expect(detail?.matchStatus).toBe('MATCHED');
    expect(detail?.metadataSnapshot).toMatchObject({ title: 'Portal 2' });
  });
});
