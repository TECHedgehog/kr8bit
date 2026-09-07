import { PrismaClient } from '@prisma/client';
import { config as loadEnv } from 'dotenv';

loadEnv();

// Single DB source: prefer an explicit DATABASE_URL (set by the docker
// entrypoint), otherwise derive it from DB_PATH like the app does.
const databaseUrl =
  process.env.DATABASE_URL ?? `file:${process.env.DB_PATH ?? './data/kr8bit.db'}`;

const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl } },
});

// Idempotent by construction: only games whose .m3u8 video url lacks an
// hlsUrl are rewritten, so a second run finds nothing to change.
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
