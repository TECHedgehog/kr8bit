import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/prisma-client.js';
import { steamIndexRepository } from '../src/modules/metadata/steam-index/steam-index.repository.js';
import type { SteamAppListEntry } from '../src/modules/metadata/steam/steam.http.types.js';

beforeEach(async () => {
  await prisma.steamAppIndex.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

function makeEntry(appid: number, name: string): SteamAppListEntry {
  return { appid, name };
}

describe('steamIndexRepository.replaceAll', () => {
  it('inserts rows and returns count', async () => {
    const rows = await steamIndexRepository.replaceAll([
      makeEntry(10, 'Game A'),
      makeEntry(20, 'Game B'),
    ]);
    expect(rows).toBe(2);
    expect(await prisma.steamAppIndex.count()).toBe(2);
  });

  it('truncates on subsequent calls', async () => {
    await steamIndexRepository.replaceAll([
      makeEntry(1, 'Old'),
      makeEntry(2, 'Also Old'),
      makeEntry(3, 'Older'),
    ]);
    const rows = await steamIndexRepository.replaceAll([makeEntry(7, 'New')]);
    expect(rows).toBe(1);
    expect(await prisma.steamAppIndex.count()).toBe(1);
  });

  it('handles empty input', async () => {
    const rows = await steamIndexRepository.replaceAll([]);
    expect(rows).toBe(0);
    expect(await prisma.steamAppIndex.count()).toBe(0);
  });

  it('chunks batches above REPLACE_BATCH_SIZE boundary', async () => {
    const entries: SteamAppListEntry[] = [];
    for (let i = 0; i < 5005; i += 1) {
      entries.push(makeEntry(i + 1, `Game ${i}`));
    }
    const inserted = await steamIndexRepository.replaceAll(entries);
    expect(inserted).toBe(5005);
    expect(await prisma.steamAppIndex.count()).toBe(5005);
  });
});

describe('steamIndexRepository.findAll', () => {
  it('returns rows in insertion order', async () => {
    await steamIndexRepository.replaceAll([
      makeEntry(10, 'Game A'),
      makeEntry(20, 'Game B'),
    ]);
    const rows = await steamIndexRepository.findAll();
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.appId).sort((a, b) => a - b)).toEqual([10, 20]);
  });

  it('returns empty array when table is empty', async () => {
    expect(await steamIndexRepository.findAll()).toEqual([]);
  });
});