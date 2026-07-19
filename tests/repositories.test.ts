import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/prisma-client.js';
import { libraryRepository } from '../src/modules/library/library.repository.js';
import { scannerRepository } from '../src/modules/scanner/scanner.repository.js';
import { settingsRepository } from '../src/modules/settings/settings.repository.js';
import { EntryType, MatchStatus, ScanStatus } from '../src/shared/enums.js';
import { NotFoundError } from '../src/shared/errors.js';

const TEST_PATH = '/games/Test Game.7z';

async function cleanup() {
  await prisma.game.deleteMany({});
  await prisma.scanRun.deleteMany({});
  await prisma.setting.deleteMany({});
}

beforeEach(async () => {
  await cleanup();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('libraryRepository', () => {
  it('creates and finds a game by id', async () => {
    const game = await libraryRepository.create({
      entryPath: TEST_PATH,
      entryType: EntryType.ARCHIVE,
      entryName: 'Test Game.7z',
      sizeBytes: 1024,
      matchStatus: MatchStatus.PENDING,
    });
    expect(game.id).toMatch(/^[0-9a-f-]+$/);
    expect(game.entryPath).toBe(TEST_PATH);
    expect(game.sizeBytes).toBe(1024);
    expect(game.developers).toEqual([]);
    expect(game.entryType).toBe(EntryType.ARCHIVE);

    const fetched = await libraryRepository.findById(game.id);
    expect(fetched.id).toBe(game.id);
  });

  it('findByEntryPath returns null when missing', async () => {
    expect(await libraryRepository.findByEntryPath('/nope')).toBeNull();
  });

  it('updates JSON array fields and reads them back decoded', async () => {
    const game = await libraryRepository.create({
      entryPath: TEST_PATH,
      entryType: EntryType.ARCHIVE,
      entryName: 'Test Game.7z',
      sizeBytes: 1,
      matchStatus: MatchStatus.PENDING,
    });
    const updated = await libraryRepository.update(game.id, {
      title: 'Test Game',
      developers: ['Studio X'],
      publishers: ['Pub Y'],
      genres: ['Action', 'RPG'],
      matchStatus: MatchStatus.ACCEPTED,
      matchScore: 95.5,
      matchedAt: new Date('2024-01-01'),
    });
    expect(updated.title).toBe('Test Game');
    expect(updated.developers).toEqual(['Studio X']);
    expect(updated.publishers).toEqual(['Pub Y']);
    expect(updated.genres).toEqual(['Action', 'RPG']);
    expect(updated.matchStatus).toBe(MatchStatus.ACCEPTED);
    expect(updated.matchScore).toBe(95.5);

    const refetched = await libraryRepository.findById(game.id);
    expect(refetched.genres).toEqual(['Action', 'RPG']);
  });

  it('lists games with status filter and pagination', async () => {
    for (let i = 0; i < 3; i++) {
      await libraryRepository.create({
        entryPath: `/games/g${i}.7z`,
        entryType: EntryType.ARCHIVE,
        entryName: `g${i}.7z`,
        sizeBytes: 1,
        matchStatus: MatchStatus.PENDING,
      });
    }
    await libraryRepository.create({
      entryPath: '/games/acc.7z',
      entryType: EntryType.ARCHIVE,
      entryName: 'acc.7z',
      sizeBytes: 1,
      matchStatus: MatchStatus.ACCEPTED,
    });

    const pending = await libraryRepository.list({ matchStatus: MatchStatus.PENDING });
    expect(pending.items).toHaveLength(3);
    expect(pending.total).toBe(3);

    const all = await libraryRepository.list({ limit: 2 });
    expect(all.items).toHaveLength(2);
    expect(all.total).toBe(4);

    const paged = await libraryRepository.list({ limit: 2, offset: 2 });
    expect(paged.items).toHaveLength(2);
  });

  it('searches by title or entryName', async () => {
    await libraryRepository.create({
      entryPath: '/games/Skyrim.7z',
      entryType: EntryType.ARCHIVE,
      entryName: 'Skyrim.7z',
      sizeBytes: 1,
      matchStatus: MatchStatus.PENDING,
    });
    await libraryRepository.update(
      (await libraryRepository.findByEntryPath('/games/Skyrim.7z'))!.id,
      { title: 'The Elder Scrolls V: Skyrim' },
    );

    const result = await libraryRepository.list({ search: 'Elder' });
    expect(result.total).toBe(1);
    expect(result.items[0].title).toContain('Elder');
  });

  it('findById throws NotFoundError when missing', async () => {
    expect.assertions(1);
    try {
      await libraryRepository.findById('nonexistent');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundError);
    }
  });

  it('deletes game', async () => {
    const game = await libraryRepository.create({
      entryPath: TEST_PATH,
      entryType: EntryType.ARCHIVE,
      entryName: 'Test Game.7z',
      sizeBytes: 1,
      matchStatus: MatchStatus.PENDING,
    });
    await libraryRepository.delete(game.id);
    expect(await libraryRepository.findByEntryPath(TEST_PATH)).toBeNull();
  });
});

describe('scannerRepository', () => {
  it('creates a running scanrun and updates it', async () => {
    const run = await scannerRepository.create({ rootPath: '/games' });
    expect(run.status).toBe(ScanStatus.RUNNING);
    expect(run.finishedAt).toBeNull();
    expect(run.errors).toEqual([]);

    const updated = await scannerRepository.update(run.id, {
      found: 10,
      added: 5,
      status: ScanStatus.DONE,
      finishedAt: new Date('2024-01-02'),
      errors: ['oops'],
    });
    expect(updated.found).toBe(10);
    expect(updated.added).toBe(5);
    expect(updated.status).toBe(ScanStatus.DONE);
    expect(updated.finishedAt).toEqual(new Date('2024-01-02'));
    expect(updated.errors).toEqual(['oops']);
  });

  it('findLatest returns most recent', async () => {
    await scannerRepository.create({ rootPath: '/a' });
    await new Promise((r) => setTimeout(r, 10));
    const second = await scannerRepository.create({ rootPath: '/b' });
    const latest = await scannerRepository.findLatest();
    expect(latest?.id).toBe(second.id);
  });

  it('findRunning returns running scan', async () => {
    await scannerRepository.create({ rootPath: '/a' });
    const running = await scannerRepository.findRunning();
    expect(running).not.toBeNull();
    expect(running!.status).toBe(ScanStatus.RUNNING);
  });
});

describe('settingsRepository', () => {
  it('returns null for missing key', async () => {
    expect(await settingsRepository.get('nope')).toBeNull();
  });

  it('sets and gets a value', async () => {
    await settingsRepository.set('foo', 'bar');
    expect(await settingsRepository.get('foo')).toBe('bar');
  });

  it('upserts on second set', async () => {
    await settingsRepository.set('foo', 'a');
    await settingsRepository.set('foo', 'b');
    expect(await settingsRepository.get('foo')).toBe('b');
  });

  it('lists settings', async () => {
    await settingsRepository.set('b', '2');
    await settingsRepository.set('a', '1');
    const all = await settingsRepository.list();
    expect(all.map((s) => s.key)).toEqual(['a', 'b']);
  });

  it('getOrThrow throws NotFoundError', async () => {
    expect.assertions(1);
    try {
      await settingsRepository.getOrThrow('missing');
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundError);
    }
  });

  it('deletes setting', async () => {
    await settingsRepository.set('foo', 'bar');
    await settingsRepository.delete('foo');
    expect(await settingsRepository.get('foo')).toBeNull();
  });
});

