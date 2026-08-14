import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { ArtworkService, detectContentType } from '../src/modules/artwork/artwork.service.js';

const tmpBase = join(os.tmpdir(), 'kr8bit-art-svc-');
let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(tmpBase);
});

afterAll(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function fileExists(path: string): Promise<boolean> {
  try {
    await fs.stat(path);
    return true;
  } catch {
    return false;
  }
}

describe('detectContentType', () => {
  it('detects PNG from magic bytes', () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectContentType(png)).toBe('image/png');
  });

  it('detects JPEG from magic bytes', () => {
    const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    expect(detectContentType(jpg)).toBe('image/jpeg');
  });

  it('falls back to octet-stream for unknown bytes', () => {
    expect(detectContentType(new Uint8Array([0x00, 0x01]))).toBe('application/octet-stream');
  });

  it('detects WebP from magic bytes', () => {
    const webp = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00,
      0x57, 0x45, 0x42, 0x50,
    ]);
    expect(detectContentType(webp)).toBe('image/webp');
  });

  it('detects GIF87a from magic bytes', () => {
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]);
    expect(detectContentType(gif)).toBe('image/gif');
  });

  it('detects GIF89a from magic bytes', () => {
    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(detectContentType(gif)).toBe('image/gif');
  });

  it('detects AVIF from magic bytes', () => {
    const avif = new Uint8Array([
      0x00, 0x00, 0x00, 0x00, 0x66, 0x74, 0x79, 0x70,
      0x61, 0x76, 0x69, 0x66,
    ]);
    expect(detectContentType(avif)).toBe('image/avif');
  });
});

describe('ArtworkService', () => {
  it('computes deterministic cache path (no extension)', () => {
    const svc = new ArtworkService(tmpDir, { download: vi.fn() });
    expect(svc.cachePath(620, 'header')).toBe(join(tmpDir, 'artwork', '620', 'header'));
    expect(svc.cachePath(620, 'cover')).toBe(join(tmpDir, 'artwork', '620', 'cover'));
  });

  it('downloadToCache writes bytes and returns path', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const client = { download: vi.fn(async () => bytes) };
    const svc = new ArtworkService(tmpDir, client);

    const path = await svc.downloadToCache(620, 'header', 'https://x/header.jpg');

    expect(path).toBe(join(tmpDir, 'artwork', '620', 'header'));
    expect(client.download).toHaveBeenCalledWith('https://x/header.jpg');
    const stat = await fs.stat(path);
    expect(stat.size).toBe(4);
    const buf = await fs.readFile(path);
    expect(Array.from(buf)).toEqual([1, 2, 3, 4]);
  });

  it('downloadToCache returns null on client error', async () => {
    const client = { download: vi.fn(async () => { throw new Error('boom'); }) };
    const svc = new ArtworkService(tmpDir, client);
    const result = await svc.downloadToCache(7, 'header', 'https://x');
    expect(result).toBeNull();
  });

  it('downloadToCache returns existing path without HTTP call when cache hit', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const client = { download: vi.fn(async () => bytes) };
    const svc = new ArtworkService(tmpDir, client);

    await svc.downloadToCache(620, 'header', 'https://x');
    client.download.mockClear();

    const path = await svc.downloadToCache(620, 'header', 'https://x');

    expect(path).toBe(svc.cachePath(620, 'header'));
    expect(client.download).not.toHaveBeenCalled();
  });

  it('downloadToCache returns null when remoteUrl missing', async () => {
    const client = { download: vi.fn() };
    const svc = new ArtworkService(tmpDir, client);
    expect(await svc.downloadToCache(7, 'header', null)).toBeNull();
    expect(await svc.downloadToCache(7, 'header', undefined)).toBeNull();
    expect(await svc.downloadToCache(7, 'header', '')).toBeNull();
    expect(client.download).not.toHaveBeenCalled();
  });

  it('exists returns true after download, false otherwise', async () => {
    const bytes = new Uint8Array([1]);
    const client = { download: vi.fn(async () => bytes) };
    const svc = new ArtworkService(tmpDir, client);

    expect(await svc.exists(620, 'header')).toBe(false);

    await svc.downloadToCache(620, 'header', 'https://x');
    expect(await svc.exists(620, 'header')).toBe(true);
  });

  it('readWithContentType returns bytes + content-type from cache', async () => {
    const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const client = { download: vi.fn(async () => new Uint8Array(pngMagic)) };
    const svc = new ArtworkService(tmpDir, client);

    await svc.downloadToCache(620, 'cover', 'https://x');
    const result = await svc.readWithContentType(620, 'cover');
    expect(result).not.toBeNull();
    expect(result!.contentType).toBe('image/png');
    expect(Array.from(result!.bytes)).toEqual(pngMagic);
  });

  it('readWithContentType returns null when cache missing', async () => {
    const svc = new ArtworkService(tmpDir, { download: vi.fn() });
    expect(await svc.readWithContentType(999, 'cover')).toBeNull();
  });

  it('remove deletes the app artwork directory', async () => {
    const bytes = new Uint8Array([1]);
    const client = { download: vi.fn(async () => bytes) };
    const svc = new ArtworkService(tmpDir, client);

    await svc.downloadToCache(620, 'header', 'https://x');
    await svc.downloadToCache(620, 'cover', 'https://y');
    expect(await svc.exists(620, 'header')).toBe(true);

    await svc.remove(620);

    expect(await svc.exists(620, 'header')).toBe(false);
    expect(await svc.exists(620, 'cover')).toBe(false);
  });

  it('remove is idempotent when cache directory does not exist', async () => {
    const client = { download: vi.fn() };
    const svc = new ArtworkService(tmpDir, client);
    await expect(svc.remove(999)).resolves.toBeUndefined();
  });

  it('cachePathGeneric computes deterministic cache path (no extension)', () => {
    const svc = new ArtworkService(tmpDir, { download: vi.fn() });
    expect(svc.cachePathGeneric('igdb', 'abc', 'header')).toBe(
      join(tmpDir, 'artwork', 'igdb', 'abc', 'header'),
    );
    expect(svc.cachePathGeneric('igdb', 'abc', 'cover')).toBe(
      join(tmpDir, 'artwork', 'igdb', 'abc', 'cover'),
    );
  });

  it('downloadToCacheGeneric writes bytes and returns path', async () => {
    const bytes = new Uint8Array([5, 6, 7, 8]);
    const client = { download: vi.fn(async () => bytes) };
    const svc = new ArtworkService(tmpDir, client);

    const path = await svc.downloadToCacheGeneric('igdb', 'abc', 'cover', 'https://x/cover.jpg');

    expect(path).toBe(join(tmpDir, 'artwork', 'igdb', 'abc', 'cover'));
    expect(client.download).toHaveBeenCalledWith('https://x/cover.jpg');
    const stat = await fs.stat(path);
    expect(stat.size).toBe(4);
    const buf = await fs.readFile(path);
    expect(Array.from(buf)).toEqual([5, 6, 7, 8]);
  });

  it('downloadToCacheGeneric returns null on client error', async () => {
    const client = { download: vi.fn(async () => { throw new Error('boom'); }) };
    const svc = new ArtworkService(tmpDir, client);
    const result = await svc.downloadToCacheGeneric('igdb', 'abc', 'cover', 'https://x');
    expect(result).toBeNull();
  });

  it('downloadToCacheGeneric returns null when remoteUrl missing', async () => {
    const client = { download: vi.fn() };
    const svc = new ArtworkService(tmpDir, client);
    expect(await svc.downloadToCacheGeneric('igdb', 'abc', 'cover', null)).toBeNull();
    expect(await svc.downloadToCacheGeneric('igdb', 'abc', 'cover', undefined)).toBeNull();
    expect(await svc.downloadToCacheGeneric('igdb', 'abc', 'cover', '')).toBeNull();
    expect(client.download).not.toHaveBeenCalled();
  });

  it('downloadToCacheGeneric returns existing path without HTTP call when cache hit', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const client = { download: vi.fn(async () => bytes) };
    const svc = new ArtworkService(tmpDir, client);

    await svc.downloadToCacheGeneric('igdb', 'abc', 'cover', 'https://x');
    client.download.mockClear();

    const path = await svc.downloadToCacheGeneric('igdb', 'abc', 'cover', 'https://x');

    expect(path).toBe(svc.cachePathGeneric('igdb', 'abc', 'cover'));
    expect(client.download).not.toHaveBeenCalled();
  });

  it('existsGeneric returns true after download, false otherwise', async () => {
    const bytes = new Uint8Array([1]);
    const client = { download: vi.fn(async () => bytes) };
    const svc = new ArtworkService(tmpDir, client);

    expect(await svc.existsGeneric('igdb', 'abc', 'header')).toBe(false);

    await svc.downloadToCacheGeneric('igdb', 'abc', 'header', 'https://x');
    expect(await svc.existsGeneric('igdb', 'abc', 'header')).toBe(true);
  });

  it('readWithContentTypeGeneric returns bytes + content-type from cache', async () => {
    const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    const client = { download: vi.fn(async () => new Uint8Array(pngMagic)) };
    const svc = new ArtworkService(tmpDir, client);

    await svc.downloadToCacheGeneric('igdb', 'abc', 'cover', 'https://x');
    const result = await svc.readWithContentTypeGeneric('igdb', 'abc', 'cover');
    expect(result).not.toBeNull();
    expect(result!.contentType).toBe('image/png');
    expect(Array.from(result!.bytes)).toEqual(pngMagic);
  });

  it('readWithContentTypeGeneric returns null when cache missing', async () => {
    const svc = new ArtworkService(tmpDir, { download: vi.fn() });
    expect(await svc.readWithContentTypeGeneric('igdb', 'abc', 'cover')).toBeNull();
  });

  it('removeGeneric deletes the provider artwork directory', async () => {
    const bytes = new Uint8Array([1]);
    const client = { download: vi.fn(async () => bytes) };
    const svc = new ArtworkService(tmpDir, client);

    await svc.downloadToCacheGeneric('igdb', 'abc', 'header', 'https://x');
    await svc.downloadToCacheGeneric('igdb', 'abc', 'cover', 'https://y');
    expect(await svc.existsGeneric('igdb', 'abc', 'header')).toBe(true);

    await svc.removeGeneric('igdb', 'abc');

    expect(await svc.existsGeneric('igdb', 'abc', 'header')).toBe(false);
    expect(await svc.existsGeneric('igdb', 'abc', 'cover')).toBe(false);
  });

  it('removeGeneric is idempotent when cache directory does not exist', async () => {
    const client = { download: vi.fn() };
    const svc = new ArtworkService(tmpDir, client);
    await expect(svc.removeGeneric('igdb', 'missing')).resolves.toBeUndefined();
  });

  describe('cache-busting', () => {
    it('appends suffix for ?t= query param', async () => {
      const client = { download: vi.fn(async () => new Uint8Array([1])) };
      const svc = new ArtworkService(tmpDir, client);

      const path = await svc.downloadToCache(620, 'cover', 'https://x/cover.jpg?t=123');

      expect(path).toBe(join(tmpDir, 'artwork', '620', 'cover-123'));
      expect(await fileExists(path)).toBe(true);
    });

    it('appends suffix for ?v= query param', async () => {
      const client = { download: vi.fn(async () => new Uint8Array([1])) };
      const svc = new ArtworkService(tmpDir, client);

      const path = await svc.downloadToCache(620, 'header', 'https://x/header.jpg?v=2');

      expect(path).toBe(join(tmpDir, 'artwork', '620', 'header-2'));
      expect(await fileExists(path)).toBe(true);
    });

    it('does not append suffix for plain URLs', async () => {
      const client = { download: vi.fn(async () => new Uint8Array([1])) };
      const svc = new ArtworkService(tmpDir, client);

      const path = await svc.downloadToCache(620, 'cover', 'https://x/cover.jpg');

      expect(path).toBe(join(tmpDir, 'artwork', '620', 'cover'));
      expect(await fileExists(path)).toBe(true);
    });

    it('ignores unrelated query params', async () => {
      const client = { download: vi.fn(async () => new Uint8Array([1])) };
      const svc = new ArtworkService(tmpDir, client);

      const path = await svc.downloadToCache(620, 'cover', 'https://x/cover.jpg?page=1');

      expect(path).toBe(join(tmpDir, 'artwork', '620', 'cover'));
      expect(await fileExists(path)).toBe(true);
    });

    it('re-downloads when cache-bust token changes', async () => {
      const client = { download: vi.fn(async () => new Uint8Array([1])) };
      const svc = new ArtworkService(tmpDir, client);

      const path1 = await svc.downloadToCache(620, 'cover', 'https://x/cover.jpg?t=1');
      client.download.mockClear();

      const path2 = await svc.downloadToCache(620, 'cover', 'https://x/cover.jpg?t=2');

      expect(path1).toBe(join(tmpDir, 'artwork', '620', 'cover-1'));
      expect(path2).toBe(join(tmpDir, 'artwork', '620', 'cover-2'));
      expect(client.download).toHaveBeenCalledTimes(1);
      expect(await fileExists(path1)).toBe(true);
      expect(await fileExists(path2)).toBe(true);
    });

    it('readWithContentType finds versioned cached file', async () => {
      const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      const client = { download: vi.fn(async () => new Uint8Array(pngMagic)) };
      const svc = new ArtworkService(tmpDir, client);

      await svc.downloadToCache(620, 'cover', 'https://x/cover.jpg?t=456');
      const result = await svc.readWithContentType(620, 'cover');

      expect(result).not.toBeNull();
      expect(result!.contentType).toBe('image/png');
    });

    it('readWithContentType returns newest versioned file by mtime', async () => {
      const client = {
        download: vi.fn()
          .mockResolvedValueOnce(new Uint8Array([1]))
          .mockResolvedValueOnce(new Uint8Array([2])),
      };
      const svc = new ArtworkService(tmpDir, client);

      await svc.downloadToCache(620, 'cover', 'https://x/cover.jpg?t=1');
      await new Promise((r) => setTimeout(r, 20));
      await svc.downloadToCache(620, 'cover', 'https://x/cover.jpg?t=2');

      const result = await svc.readWithContentType(620, 'cover');
      expect(result).not.toBeNull();
      expect(result!.bytes[0]).toBe(2);
    });

    it('exists finds versioned cached file', async () => {
      const client = { download: vi.fn(async () => new Uint8Array([1])) };
      const svc = new ArtworkService(tmpDir, client);

      await svc.downloadToCache(620, 'cover', 'https://x/cover.jpg?t=789');
      expect(await svc.exists(620, 'cover')).toBe(true);
    });

    it('generic path appends suffix for ?t= param', async () => {
      const client = { download: vi.fn(async () => new Uint8Array([1])) };
      const svc = new ArtworkService(tmpDir, client);

      const path = await svc.downloadToCacheGeneric('igdb', 'abc', 'cover', 'https://x/cover.jpg?t=999');

      expect(path).toBe(join(tmpDir, 'artwork', 'igdb', 'abc', 'cover-999'));
      expect(await fileExists(path)).toBe(true);
    });

    it('generic path re-downloads when token changes', async () => {
      const client = { download: vi.fn(async () => new Uint8Array([1])) };
      const svc = new ArtworkService(tmpDir, client);

      const path1 = await svc.downloadToCacheGeneric('igdb', 'abc', 'cover', 'https://x/cover.jpg?t=a');
      client.download.mockClear();

      const path2 = await svc.downloadToCacheGeneric('igdb', 'abc', 'cover', 'https://x/cover.jpg?t=b');

      expect(path1).toBe(join(tmpDir, 'artwork', 'igdb', 'abc', 'cover-a'));
      expect(path2).toBe(join(tmpDir, 'artwork', 'igdb', 'abc', 'cover-b'));
      expect(client.download).toHaveBeenCalledTimes(1);
      expect(await fileExists(path1)).toBe(true);
      expect(await fileExists(path2)).toBe(true);
    });

    it('generic readWithContentTypeGeneric returns newest versioned file', async () => {
      const client = {
        download: vi.fn()
          .mockResolvedValueOnce(new Uint8Array([1]))
          .mockResolvedValueOnce(new Uint8Array([2])),
      };
      const svc = new ArtworkService(tmpDir, client);

      await svc.downloadToCacheGeneric('igdb', 'abc', 'cover', 'https://x/cover.jpg?t=1');
      await new Promise((r) => setTimeout(r, 20));
      await svc.downloadToCacheGeneric('igdb', 'abc', 'cover', 'https://x/cover.jpg?t=2');

      const result = await svc.readWithContentTypeGeneric('igdb', 'abc', 'cover');
      expect(result).not.toBeNull();
      expect(result!.bytes[0]).toBe(2);
    });

    it('generic existsGeneric finds versioned cached file', async () => {
      const client = { download: vi.fn(async () => new Uint8Array([1])) };
      const svc = new ArtworkService(tmpDir, client);

      await svc.downloadToCacheGeneric('igdb', 'abc', 'cover', 'https://x/cover.jpg?t=xyz');
      expect(await svc.existsGeneric('igdb', 'abc', 'cover')).toBe(true);
    });
  });

  describe('TTL-based cache invalidation', () => {
    it('re-downloads when cache is stale', async () => {
      const bytes = new Uint8Array([1, 2, 3]);
      const freshBytes = new Uint8Array([4, 5, 6]);
      const client = { download: vi.fn(async () => bytes) };
      let currentTime = Date.now();
      const svc = new ArtworkService(tmpDir, client, { now: () => new Date(currentTime), cacheTtlMs: 1000 });

      await svc.downloadToCache(620, 'cover', 'https://x/cover.jpg');

      client.download.mockResolvedValueOnce(freshBytes);
      currentTime += 2000;

      const path = await svc.downloadToCache(620, 'cover', 'https://x/cover.jpg');

      expect(client.download).toHaveBeenCalledTimes(2);
      expect(path).toBeTruthy();
    });

    it('skips download when cache is fresh', async () => {
      const bytes = new Uint8Array([1, 2, 3]);
      const client = { download: vi.fn(async () => bytes) };
      let currentTime = Date.now();
      const svc = new ArtworkService(tmpDir, client, { now: () => new Date(currentTime), cacheTtlMs: 1000 });

      await svc.downloadToCache(620, 'cover', 'https://x/cover.jpg');

      currentTime += 500;

      await svc.downloadToCache(620, 'cover', 'https://x/cover.jpg');

      expect(client.download).toHaveBeenCalledTimes(1);
    });

    it('re-downloads generic cache when stale', async () => {
      const bytes = new Uint8Array([1]);
      const freshBytes = new Uint8Array([2]);
      const client = { download: vi.fn(async () => bytes) };
      let currentTime = Date.now();
      const svc = new ArtworkService(tmpDir, client, { now: () => new Date(currentTime), cacheTtlMs: 1000 });

      await svc.downloadToCacheGeneric('igdb', 'abc', 'cover', 'https://x/cover.jpg');

      client.download.mockResolvedValueOnce(freshBytes);
      currentTime += 2000;

      const path = await svc.downloadToCacheGeneric('igdb', 'abc', 'cover', 'https://x/cover.jpg');

      expect(client.download).toHaveBeenCalledTimes(2);
      expect(path).toBeTruthy();
    });
  });
});