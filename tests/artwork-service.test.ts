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

  it('streamPath returns the deterministic cache path', () => {
    const svc = new ArtworkService(tmpDir, { download: vi.fn() });
    expect(svc.streamPath(620, 'cover')).toBe(join(tmpDir, 'artwork', '620', 'cover'));
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
});