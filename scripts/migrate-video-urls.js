import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function migrate() {
  const games = await prisma.game.findMany({
    where: { videos: { contains: '.m3u8' } },
    select: { id: true, videos: true },
  });

  let updated = 0;

  for (const game of games) {
    let videos;
    try {
      videos = JSON.parse(game.videos);
    } catch {
      continue;
    }

    if (!Array.isArray(videos)) continue;

    let changed = false;
    for (const v of videos) {
      if (typeof v.url === 'string' && v.url.endsWith('.m3u8') && !v.hlsUrl) {
        v.hlsUrl = v.url;
        v.url = '';
        changed = true;
      }
    }

    if (changed) {
      await prisma.game.update({
        where: { id: game.id },
        data: { videos: JSON.stringify(videos) },
      });
      updated++;
    }
  }

  console.log(`Migrated ${updated} games`);
  await prisma.$disconnect();
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
