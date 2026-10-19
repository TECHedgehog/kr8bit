import { randomUUID } from 'node:crypto';
import { prisma } from '../../prisma-client.js';

export async function regroupRepackGames(
  normalize: (title: string) => { gameTitle: string; normalizedTitle: string },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const games = await tx.repackGame.findMany({
      include: { posts: { select: { id: true, title: true, normalizedTitle: true, publishedAt: true } } },
    });
    const groups = new Map<string, { gameTitle: string; normalizedTitle: string; posts: string[]; games: typeof games }>();
    const postOwners = new Map(games.flatMap((game) => game.posts.map((post) => [post.id, game.id] as const)));
    const postNormalizedTitles = new Map(games.flatMap((game) => game.posts.map((post) => [post.id, post.normalizedTitle] as const)));
    const postPublishedAt = new Map(games.flatMap((game) => game.posts.map((post) => [post.id, post.publishedAt] as const)));
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
        || group.posts.some((postId) => postOwners.get(postId) !== winnerId
          || postNormalizedTitles.get(postId) !== normalizedTitle);
    });
    if (!needsRewrite) return;

    for (const [normalizedTitle, group] of orderedGroups) {
      const winnerId = winners.get(normalizedTitle)!;
      if (group.posts.length) {
        await tx.repackPost.updateMany({
          where: { id: { in: group.posts } },
          data: { gameId: winnerId, normalizedTitle },
        });
      }
    }
    if (duplicateIds.length) await tx.repackGame.deleteMany({ where: { id: { in: duplicateIds } } });

    // @@unique([normalizedTitle]) forbids swapping final titles in place; temporary unique titles avoid collisions.
    for (const winnerId of winners.values()) {
      await tx.repackGame.update({ where: { id: winnerId }, data: { normalizedTitle: `__regroup__${randomUUID()}` } });
    }
    for (const [normalizedTitle, group] of orderedGroups) {
      const winnerId = winners.get(normalizedTitle)!;
      await tx.repackGame.update({
        where: { id: winnerId },
        data: {
          title: group.gameTitle,
          normalizedTitle,
          latestPostAt: group.posts.reduce<Date | null>((latest, postId) => {
            const publishedAt = postPublishedAt.get(postId);
            return publishedAt && (!latest || publishedAt > latest) ? publishedAt : latest;
          }, null),
        },
      });
    }
  });
}
