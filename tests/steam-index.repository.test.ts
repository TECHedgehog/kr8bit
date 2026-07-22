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

describe('steamIndexRepository.count', () => {
  it('returns zero on empty table', async () => {
    expect(await steamIndexRepository.count()).toBe(0);
  });
});

describe('steamIndexRepository.replaceAll', () => {
  it('inserts rows and returns count', async () => {
    const rows = await steamIndexRepository.replaceAll([
      makeEntry(10, 'Game A'),
      makeEntry(20, 'Game B'),
    ]);
    expect(rows).toBe(2);
    expect(await steamIndexRepository.count()).toBe(2);
  });

  it('truncates on subsequent calls', async () => {
    await steamIndexRepository.replaceAll([
      makeEntry(1, 'Old'),
      makeEntry(2, 'Also Old'),
      makeEntry(3, 'Older'),
    ]);
    const rows = await steamIndexRepository.replaceAll([makeEntry(7, 'New')]);
    expect(rows).toBe(1);
    expect(await steamIndexRepository.count()).toBe(1);
  });

  it('handles empty input', async () => {
    const rows = await steamIndexRepository.replaceAll([]);
    expect(rows).toBe(0);
    expect(await steamIndexRepository.count()).toBe(0);
  });

  it('chunks batches above REPLACE_BATCH_SIZE boundary', async () => {
    const entries: SteamAppListEntry[] = [];
    for (let i = 0; i < 5005; i += 1) {
      entries.push(makeEntry(i + 1, `Game ${i}`));
    }
    const inserted = await steamIndexRepository.replaceAll(entries);
    expect(inserted).toBe(5005);
    expect(await steamIndexRepository.count()).toBe(5005);
  });
});

describe('steamIndexRepository.searchByName', () => {
  it('finds rows whose name contains query', async () => {
    await steamIndexRepository.replaceAll([
      makeEntry(1, 'Portal 2'),
      makeEntry(2, 'Portal Reloaded'),
      makeEntry(3, 'Half-Life 2'),
    ]);
    const rows = await steamIndexRepository.searchByName('Portal', 10);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.appId).sort((a, b) => a - b)).toEqual([1, 2]);
  });

  it('respects limit param', async () => {
    await steamIndexRepository.replaceAll([
      makeEntry(1, 'Skyrim'),
      makeEntry(2, 'Skyrim Special Edition'),
      makeEntry(3, 'Skyrim Anniversary'),
    ]);
    const rows = await steamIndexRepository.searchByName('Skyrim', 2);
    expect(rows.length).toBeLessThanOrEqual(2);
  });

  it('returns empty array when no match', async () => {
    await steamIndexRepository.replaceAll([makeEntry(1, 'Portal')]);
    expect(await steamIndexRepository.searchByName('Nonexistent', 10)).toEqual([]);
  });
});