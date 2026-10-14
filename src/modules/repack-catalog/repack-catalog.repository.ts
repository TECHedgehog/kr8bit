import { prisma } from '../../prisma-client.js';
import type { RepackMatchCandidate, RepackPostInput } from './repack-catalog.types.js';

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
    const game = await prisma.repackGame.upsert({
      where: { normalizedTitle: input.normalizedTitle },
      create: { title: input.title, normalizedTitle: input.normalizedTitle },
      update: { title: input.postKind === 'GAME' ? input.title : undefined },
    });
    return prisma.repackPost.upsert({
      where: { source_sourceUrl: { source: input.source, sourceUrl: input.sourceUrl } },
      create: {
        source: input.source, sourceUrl: input.sourceUrl, title: input.title,
        normalizedTitle: input.normalizedTitle, publishedAt: input.publishedAt,
        contentText: input.contentText, details: JSON.stringify(input.details),
        downloadOptions: JSON.stringify(input.downloadOptions), postKind: input.postKind,
        contentHash: input.contentHash, gameId: game.id,
      },
      update: {
        title: input.title, contentText: input.contentText, details: JSON.stringify(input.details),
        downloadOptions: JSON.stringify(input.downloadOptions), contentHash: input.contentHash,
        lastSeenAt: new Date(), gameId: game.id,
      },
      include: { game: true },
    });
  },

  async findGameByNormalizedTitle(normalizedTitle: string) {
    return prisma.repackGame.findUnique({ where: { normalizedTitle } });
  },

  async saveCandidates(id: string, candidates: RepackMatchCandidate[], status: string) {
    return prisma.repackGame.update({
      where: { id }, data: { matchCandidates: JSON.stringify(candidates), matchStatus: status },
    });
  },

  async listGames(options: { offset: number; limit: number; query?: string }) {
    const where = options.query ? { title: { contains: options.query } } : undefined;
    const [rows, total] = await prisma.$transaction([
      prisma.repackGame.findMany({
        where, skip: options.offset, take: options.limit,
        select: {
          id: true, title: true, normalizedTitle: true, providerName: true,
          providerRemoteId: true, matchStatus: true, matchScore: true,
          createdAt: true, updatedAt: true,
          posts: { select: POST_SUMMARY, orderBy: { publishedAt: 'desc' } },
        }, orderBy: { title: 'asc' },
      }),
      prisma.repackGame.count({ where }),
    ]);
    return { items: rows, total };
  },

  async getGame(id: string) {
    const game = await prisma.repackGame.findUnique({
      where: { id }, include: { posts: { orderBy: { publishedAt: 'desc' } } },
    });
    if (!game) return null;
    return {
      ...game,
      matchCandidates: parseJson<RepackMatchCandidate[]>(game.matchCandidates, []),
      metadataSnapshot: game.metadataSnapshot ? parseJson<Record<string, unknown> | null>(game.metadataSnapshot, null) : null,
      posts: game.posts.map((post) => ({
        ...post,
        details: parseJson<Record<string, string>>(post.details, {}),
        downloadOptions: parseJson<Array<{ label: string; url: string }>>(post.downloadOptions, []),
      })),
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

  async acceptMatch(id: string, candidate: RepackMatchCandidate, metadataSnapshot: unknown) {
    return prisma.repackGame.update({ where: { id }, data: {
      providerName: candidate.providerName, providerRemoteId: candidate.remoteId,
      matchStatus: 'MATCHED', matchScore: candidate.score,
      metadataSnapshot: JSON.stringify(metadataSnapshot),
    } });
  },

  async rejectMatch(id: string) {
    return prisma.repackGame.update({ where: { id }, data: {
      providerName: null, providerRemoteId: null, matchStatus: 'REJECTED', matchScore: null,
      metadataSnapshot: null,
    } });
  },
};
