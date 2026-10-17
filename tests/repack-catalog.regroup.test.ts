import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../src/prisma-client.js';
import { regroupRepackGames } from '../src/modules/repack-catalog/repack-catalog.regroup.js';
import { repackCatalogRepository } from '../src/modules/repack-catalog/repack-catalog.repository.js';
import { fitGirlGameTitle, normalizeFitGirlGameTitle } from '../src/modules/repack-catalog/sources/fitgirl/fitgirl.source.js';
import type { RepackPostInput } from '../src/modules/repack-catalog/repack-catalog.types.js';

beforeEach(async () => {
  await prisma.repackPost.deleteMany({});
  await prisma.repackGame.deleteMany({});
});

afterAll(async () => { await prisma.$disconnect(); });

function post(sourceUrl: string, title: string, normalizedTitle = 'shared game'): RepackPostInput {
  return {
    source: 'fitgirl', sourceUrl, title, gameTitle: 'Shared Game', normalizedTitle,
    tags: [], details: {}, downloadOptions: [], postKind: 'GAME', contentHash: `hash-${sourceUrl}`,
  };
}

const normalizeSimpleTitle = (title: string) => ({ gameTitle: title, normalizedTitle: title.toLowerCase() });

describe('regroupRepackGames', () => {
  it('merges version and DLC variants under one base game, retaining best match and skipping repeat writes', async () => {
    const matched = await repackCatalogRepository.upsertPost({
      ...post('https://fitgirl.test/gta-v-1/', 'GTA V v1', 'gta v'), gameTitle: 'GTA V',
    });
    await repackCatalogRepository.acceptMatch(matched.gameId!, {
      providerName: 'steam', remoteId: '271590', title: 'Grand Theft Auto V', score: 99,
    }, { remoteId: '271590', title: 'Grand Theft Auto V', developers: [], publishers: [], genres: [] });
    await repackCatalogRepository.upsertPost({
      ...post('https://fitgirl.test/gta-v-dlcs/', 'GTA V v2 + 10 DLCs', 'gta v 10'),
      gameTitle: 'GTA V 10', postKind: 'DLC',
    });

    await regroupRepackGames((title) => ({
      gameTitle: fitGirlGameTitle(title), normalizedTitle: normalizeFitGirlGameTitle(title),
    }));

    const page = await repackCatalogRepository.listGames({ offset: 0, limit: 20 });
    expect(page.total).toBe(1);
    expect(page.items[0].id).toBe(matched.gameId);
    expect(page.items[0].title).toBe('GTA V');
    expect(page.items[0].matchStatus).toBe('MATCHED');
    expect(page.items[0].posts).toHaveLength(2);

    const beforeRepeat = await prisma.repackGame.findUnique({ where: { id: matched.gameId! }, select: { updatedAt: true } });
    await regroupRepackGames((title) => ({
      gameTitle: fitGirlGameTitle(title), normalizedTitle: normalizeFitGirlGameTitle(title),
    }));
    const afterRepeat = await prisma.repackGame.findUnique({ where: { id: matched.gameId! }, select: { updatedAt: true } });
    expect(afterRepeat?.updatedAt).toEqual(beforeRepeat?.updatedAt);
  });

  it('creates a winner when one existing game spans multiple groups', async () => {
    await repackCatalogRepository.upsertPost(post('https://fitgirl.test/alpha/', 'Alpha Game'));
    await repackCatalogRepository.upsertPost(post('https://fitgirl.test/beta/', 'Beta Game'));

    await regroupRepackGames(normalizeSimpleTitle);

    const games = await prisma.repackGame.findMany({ include: { posts: { select: { title: true } } }, orderBy: { normalizedTitle: 'asc' } });
    expect(games).toHaveLength(2);
    expect(games.map((game) => game.normalizedTitle)).toEqual(['alpha game', 'beta game']);
    expect(games.map((game) => game.posts[0].title)).toEqual(['Alpha Game', 'Beta Game']);
  });

  it('regroups games without posts from their game title', async () => {
    const orphan = await prisma.repackGame.create({ data: { title: 'Orphan Game', normalizedTitle: 'old orphan' } });

    await regroupRepackGames(normalizeSimpleTitle);

    await expect(prisma.repackGame.findUniqueOrThrow({ where: { id: orphan.id } })).resolves.toMatchObject({
      title: 'Orphan Game', normalizedTitle: 'orphan game',
    });
  });
});
