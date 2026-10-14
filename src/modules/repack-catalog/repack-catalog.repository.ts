import { randomUUID } from 'node:crypto';
import { prisma } from '../../prisma-client.js';
import type { RepackMatchCandidate, RepackMetadataSnapshot, RepackPostInput } from './repack-catalog.types.js';

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
      create: { title: input.gameTitle, normalizedTitle: input.normalizedTitle },
      update: { title: input.gameTitle },
    });
    return prisma.repackPost.upsert({
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
      include: { game: true },
    });
  },

  async findGameByNormalizedTitle(normalizedTitle: string) {
    return prisma.repackGame.findUnique({ where: { normalizedTitle } });
  },

  async findRematchableGames() {
    return prisma.repackGame.findMany({
      where: { matchStatus: { in: ['PENDING', 'REVIEW', 'REJECTED'] } },
      select: { id: true, title: true, normalizedTitle: true },
      orderBy: { updatedAt: 'asc' },
    });
  },

  async saveCandidates(id: string, candidates: RepackMatchCandidate[], status: string, score: number | null = null) {
    return prisma.repackGame.update({
      where: { id }, data: { matchCandidates: JSON.stringify(candidates), matchStatus: status, matchScore: score },
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

  async acceptMatch(id: string, candidate: RepackMatchCandidate, metadataSnapshot: RepackMetadataSnapshot) {
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

  async regroupGames(normalize: (title: string) => { gameTitle: string; normalizedTitle: string }) {
    await prisma.$transaction(async (tx) => {
      const games = await tx.repackGame.findMany({ include: { posts: { select: { id: true, title: true } } } });
      const groups = new Map<string, { gameTitle: string; normalizedTitle: string; posts: string[]; games: typeof games }>();
      const postOwners = new Map(games.flatMap((game) => game.posts.map((post) => [post.id, game.id] as const)));
      const winnerDetails = new Map<string, { title: string; normalizedTitle: string }>();

      for (const game of games) {
        if (!game.posts.length) {
          const key = normalize(game.title);
          const group = groups.get(key.normalizedTitle) ?? { ...key, posts: [], games: [] };
          group.games.push(game);
          groups.set(key.normalizedTitle, group);
        }
        for (const post of game.posts) {
          const key = normalize(post.title);
          const group = groups.get(key.normalizedTitle) ?? { ...key, posts: [], games: [] };
          group.posts.push(post.id);
          if (!group.games.some((entry) => entry.id === game.id)) group.games.push(game);
          groups.set(key.normalizedTitle, group);
        }
      }

      const statusRank: Record<string, number> = { MATCHED: 4, REVIEW: 3, PENDING: 2, REJECTED: 1 };
      const winners = new Map<string, string>();
      const claimed = new Set<string>();
      const orderedGroups = [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
      for (const [normalizedTitle, group] of orderedGroups) {
        const available = group.games.filter((game) => !claimed.has(game.id)).sort((left, right) =>
          (statusRank[right.matchStatus] ?? 0) - (statusRank[left.matchStatus] ?? 0)
          || right.updatedAt.getTime() - left.updatedAt.getTime(),
        );
        const winner = available[0] ?? await tx.repackGame.create({
          data: { title: group.gameTitle, normalizedTitle: `__regroup__${randomUUID()}` },
        });
        claimed.add(winner.id);
        winners.set(normalizedTitle, winner.id);
        winnerDetails.set(winner.id, { title: winner.title, normalizedTitle: winner.normalizedTitle });
      }

      const duplicateIds = games.filter((game) => !claimed.has(game.id)).map((game) => game.id);
      const needsRewrite = duplicateIds.length > 0 || orderedGroups.some(([normalizedTitle, group]) => {
        const winnerId = winners.get(normalizedTitle)!;
        const winner = winnerDetails.get(winnerId)!;
        return winner.title !== group.gameTitle || winner.normalizedTitle !== normalizedTitle
          || group.posts.some((postId) => postOwners.get(postId) !== winnerId);
      });
      if (!needsRewrite) return;

      for (const [normalizedTitle, group] of orderedGroups) {
        const winnerId = winners.get(normalizedTitle)!;
        if (group.posts.length) await tx.repackPost.updateMany({ where: { id: { in: group.posts } }, data: { gameId: winnerId } });
      }
      if (duplicateIds.length) await tx.repackGame.deleteMany({ where: { id: { in: duplicateIds } } });
      for (const winnerId of winners.values()) {
        await tx.repackGame.update({ where: { id: winnerId }, data: { normalizedTitle: `__regroup__${randomUUID()}` } });
      }
      for (const [normalizedTitle, group] of orderedGroups) {
        const winnerId = winners.get(normalizedTitle)!;
        await tx.repackGame.update({
          where: { id: winnerId },
          data: { title: group.gameTitle, normalizedTitle },
        });
      }
    });
  },
};
