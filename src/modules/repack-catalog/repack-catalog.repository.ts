import { prisma } from '../../prisma-client.js';
import type { RepackCatalogQuery, RepackMatchCandidate, RepackMetadataSnapshot, RepackPostInput } from './repack-catalog.types.js';

function parseJson<T>(value: string, fallback: T): T {
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

const POST_SUMMARY = {
  id: true, title: true, sourceUrl: true, postKind: true,
  publishedAt: true, firstSeenAt: true,
};

export const repackCatalogRepository = {
  async knownUrls(source: string, urls: string[]): Promise<Set<string>> {
    if (!urls.length) return new Set();
    const known = new Set<string>();
    for (let start = 0; start < urls.length; start += 500) {
      const batch = urls.slice(start, start + 500);
      const rows = await prisma.repackPost.findMany({
        where: { source, sourceUrl: { in: batch } }, select: { sourceUrl: true },
      });
      for (const row of rows) known.add(row.sourceUrl);
    }
    return known;
  },

  async listAuditPosts(offset: number, limit: number) {
    return prisma.repackPost.findMany({
      select: { source: true, sourceUrl: true }, orderBy: { lastSeenAt: 'asc' }, skip: offset, take: limit,
    });
  },

  async markAuditSeen(source: string, sourceUrl: string) {
    await prisma.repackPost.update({
      where: { source_sourceUrl: { source, sourceUrl } }, data: { lastSeenAt: new Date() },
    });
  },

  async upsertPost(input: RepackPostInput) {
    return prisma.$transaction(async (tx) => {
      const game = await tx.repackGame.upsert({
        where: { normalizedTitle: input.normalizedTitle },
        create: { title: input.gameTitle, normalizedTitle: input.normalizedTitle },
        update: { title: input.gameTitle },
      });
      const previousPost = await tx.repackPost.findUnique({
        where: { source_sourceUrl: { source: input.source, sourceUrl: input.sourceUrl } },
        select: { gameId: true },
      });
      await tx.repackPost.upsert({
        where: { source_sourceUrl: { source: input.source, sourceUrl: input.sourceUrl } },
        create: {
          source: input.source, sourceUrl: input.sourceUrl, title: input.title,
          normalizedTitle: input.normalizedTitle, publishedAt: input.publishedAt,
          tags: JSON.stringify(input.tags), details: JSON.stringify(input.details),
          downloadOptions: JSON.stringify(input.downloadOptions), postKind: input.postKind,
          contentHash: input.contentHash, gameId: game.id,
        },
        update: {
          title: input.title, tags: JSON.stringify(input.tags), details: JSON.stringify(input.details),
          downloadOptions: JSON.stringify(input.downloadOptions), contentHash: input.contentHash,
          normalizedTitle: input.normalizedTitle, publishedAt: input.publishedAt,
          postKind: input.postKind, lastSeenAt: new Date(), gameId: game.id,
        },
      });
      const affectedGameIds = new Set([game.id, previousPost?.gameId].filter((id): id is string => Boolean(id)));
      for (const gameId of affectedGameIds) {
        const latest = await tx.repackPost.aggregate({ where: { gameId }, _max: { publishedAt: true } });
        await tx.repackGame.update({ where: { id: gameId }, data: { latestPostAt: latest._max.publishedAt } });
      }
      return tx.repackPost.findUniqueOrThrow({
        where: { source_sourceUrl: { source: input.source, sourceUrl: input.sourceUrl } },
        include: { game: true },
      });
    });
  },

  async findRematchableGames() {
    return prisma.repackGame.findMany({
      where: { matchStatus: { in: ['PENDING', 'REVIEW', 'REJECTED'] } },
      select: {
        id: true, title: true, normalizedTitle: true,
        posts: { select: { title: true }, orderBy: { lastSeenAt: 'desc' }, take: 1 },
      },
      orderBy: [{ metadataSnapshot: 'asc' }, { updatedAt: 'asc' }],
    });
  },

  async saveCandidates(
    id: string,
    candidates: RepackMatchCandidate[],
    status: string,
    score: number | null = null,
    metadataSnapshot?: RepackMetadataSnapshot | null,
  ) {
    const data: Record<string, unknown> = {
      matchCandidates: JSON.stringify(candidates), matchStatus: status, matchScore: score,
    };
    if (metadataSnapshot) {
      data.metadataSnapshot = JSON.stringify(metadataSnapshot);
      data.genres = JSON.stringify(metadataSnapshot.genres);
      data.steamDeckCategory = metadataSnapshot.steamDeckCompat?.category ?? null;
    } else if (metadataSnapshot === null || status !== 'REVIEW') {
      data.metadataSnapshot = null;
      data.genres = '[]';
      data.steamDeckCategory = null;
    }
    return prisma.repackGame.update({ where: { id }, data });
  },

  async listGames(options: RepackCatalogQuery) {
    const conditions: Record<string, unknown>[] = [];
    if (options.query) conditions.push({ title: { contains: options.query } });
    if (options.genres?.length) {
      conditions.push({ OR: options.genres.map((genre) => ({ genres: { contains: JSON.stringify(genre) } })) });
    }
    if (options.steamDeck?.length) {
      conditions.push({
        OR: options.steamDeck.map((category) => category === 0
          ? { OR: [{ steamDeckCategory: null }, { steamDeckCategory: 0 }] }
          : { steamDeckCategory: category }),
      });
    }
    if (options.matchStatus?.length) conditions.push({ matchStatus: { in: options.matchStatus } });
    const where = conditions.length ? { AND: conditions } : undefined;
    const orderBy = options.sort === 'title-desc'
      ? [{ title: 'desc' as const }]
      : options.sort === 'newest'
        ? [{ latestPostAt: 'desc' as const }, { title: 'asc' as const }]
        : options.sort === 'oldest'
          ? [{ latestPostAt: 'asc' as const }, { title: 'asc' as const }]
          : [{ title: 'asc' as const }];
    const [rows, total] = await prisma.$transaction([
      prisma.repackGame.findMany({
        where, skip: options.offset, take: options.limit,
        select: {
          id: true, title: true, normalizedTitle: true, providerName: true,
          providerRemoteId: true, matchStatus: true, matchScore: true,
          createdAt: true, updatedAt: true, latestPostAt: true,
          posts: { select: POST_SUMMARY, orderBy: { publishedAt: 'desc' } },
        }, orderBy,
      }),
      prisma.repackGame.count({ where }),
    ]);
    return { items: rows, total };
  },

  async listGenres(): Promise<string[]> {
    const rows = await prisma.repackGame.findMany({ select: { genres: true } });
    return [...new Set(rows.flatMap((row) => parseJson<string[]>(row.genres, [])))].sort((a, b) => a.localeCompare(b));
  },

  async getGame(id: string) {
    const game = await prisma.repackGame.findUnique({
      where: { id }, include: { posts: { orderBy: { publishedAt: 'desc' } } },
    });
    if (!game) return null;
    return {
      ...game,
      matchCandidates: parseJson<RepackMatchCandidate[]>(game.matchCandidates, []),
      metadataSnapshot: game.metadataSnapshot ? parseJson<RepackMetadataSnapshot | null>(game.metadataSnapshot, null) : null,
      tags: [...new Set(game.posts.flatMap((post) => parseJson<string[]>(post.tags, [])))],
      posts: game.posts.map((post) => ({
        ...post,
        tags: parseJson<string[]>(post.tags, []),
        details: parseJson<Record<string, string>>(post.details, {}),
        downloadOptions: parseJson<Array<{ label: string; url: string }>>(post.downloadOptions, []),
      })),
    };
  },

  async getArtworkGame(id: string) {
    const game = await prisma.repackGame.findUnique({
      where: { id }, select: {
        title: true, providerName: true, providerRemoteId: true, normalizedTitle: true,
        metadataSnapshot: true, matchCandidates: true,
      },
    });
    if (!game) return null;
    return {
      providerName: game.providerName,
      providerRemoteId: game.providerRemoteId,
      title: game.title,
      normalizedTitle: game.normalizedTitle,
      matchCandidates: parseJson<RepackMatchCandidate[]>(game.matchCandidates, []),
      metadataSnapshot: game.metadataSnapshot
        ? parseJson<RepackMetadataSnapshot | null>(game.metadataSnapshot, null)
        : null,
    };
  },

  async listReview(options: { offset: number; limit: number }) {
    const where = { matchStatus: 'REVIEW' };
    const [items, total] = await prisma.$transaction([
      prisma.repackGame.findMany({
        where, skip: options.offset, take: options.limit,
        select: {
          id: true, title: true, normalizedTitle: true, matchStatus: true,
          matchScore: true, matchCandidates: true,
          posts: { select: POST_SUMMARY, orderBy: { publishedAt: 'desc' } },
        }, orderBy: { updatedAt: 'desc' },
      }),
      prisma.repackGame.count({ where }),
    ]);
    return {
      total,
      items: items.map((item) => ({ ...item, matchCandidates: parseJson<RepackMatchCandidate[]>(item.matchCandidates, []) })),
    };
  },

  async acceptMatch(
    id: string,
    candidate: RepackMatchCandidate,
    metadataSnapshot: RepackMetadataSnapshot,
    candidates: RepackMatchCandidate[] = [candidate],
  ) {
    return prisma.repackGame.update({ where: { id }, data: {
      providerName: candidate.providerName, providerRemoteId: candidate.remoteId,
      matchStatus: 'MATCHED', matchScore: candidate.score,
      matchCandidates: JSON.stringify(candidates),
      metadataSnapshot: JSON.stringify(metadataSnapshot),
      genres: JSON.stringify(metadataSnapshot.genres),
      steamDeckCategory: metadataSnapshot.steamDeckCompat?.category ?? null,
    } });
  },

  async rejectMatch(id: string) {
    return prisma.repackGame.update({ where: { id }, data: {
      providerName: null, providerRemoteId: null, matchStatus: 'REJECTED', matchScore: null,
      metadataSnapshot: null,
      genres: '[]', steamDeckCategory: null,
    } });
  },

};
