import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { request } from 'undici';
import { logger } from '../../logger/index.js';
import { config } from '../../config/index.js';

export type ArtworkKind = 'header' | 'cover' | 'hero' | 'logo';

const IMAGE_PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const IMAGE_JPEG_MAGIC = [0xff, 0xd8, 0xff];
const IMAGE_GIF_MAGIC_87 = [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]; // GIF87a
const IMAGE_GIF_MAGIC_89 = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]; // GIF89a
const IMAGE_WEBP_RIFF = [0x52, 0x49, 0x46, 0x46]; // RIFF
const IMAGE_WEBP_TYPE = [0x57, 0x45, 0x42, 0x50]; // WEBP (at offset 8)
const IMAGE_AVIF_FTYP = [0x66, 0x74, 0x79, 0x70]; // ftyp (at offset 4)
const IMAGE_AVIF_BRAND = [0x61, 0x76, 0x69, 0x66]; // avif (at offset 8)

export interface ArtworkClient {
  download(url: string): Promise<Uint8Array>;
}

export const defaultArtworkClient: ArtworkClient = {
  async download(url) {
    const res = await request(url, {
      method: 'GET',
      headersTimeout: config.artwork.headerTimeoutMs,
      bodyTimeout: config.artwork.bodyTimeoutMs,
      headers: { 'User-Agent': 'kr8bit/0.1' },
    });
    if (res.statusCode >= 400) {
      throw new Error(`artwork http ${res.statusCode} for ${url}`);
    }
    const buf = await res.body.arrayBuffer();
    return new Uint8Array(buf);
  },
};

export function detectContentType(buf: Uint8Array): string {
  if (buf.length >= 4 && matchesMagic(buf, IMAGE_PNG_MAGIC)) return 'image/png';
  if (buf.length >= 3 && matchesMagic(buf, IMAGE_JPEG_MAGIC)) return 'image/jpeg';
  if (buf.length >= 6 && (matchesMagic(buf, IMAGE_GIF_MAGIC_87) || matchesMagic(buf, IMAGE_GIF_MAGIC_89))) return 'image/gif';
  if (buf.length >= 12 && matchesMagic(buf, IMAGE_WEBP_RIFF) && matchesMagicAt(buf, IMAGE_WEBP_TYPE, 8)) return 'image/webp';
  if (buf.length >= 12 && matchesMagicAt(buf, IMAGE_AVIF_FTYP, 4) && matchesMagicAt(buf, IMAGE_AVIF_BRAND, 8)) return 'image/avif';
  return 'application/octet-stream';
}

function matchesMagic(buf: Uint8Array, magic: number[]): boolean {
  for (let i = 0; i < magic.length; i += 1) {
    if (buf[i] !== magic[i]) return false;
  }
  return true;
}

function matchesMagicAt(buf: Uint8Array, magic: number[], offset: number): boolean {
  for (let i = 0; i < magic.length; i += 1) {
    if (buf[offset + i] !== magic[i]) return false;
  }
  return true;
}

export interface ArtworkDeps {
  now: () => Date;
  cacheTtlMs: number;
}

export const defaultArtworkDeps: ArtworkDeps = {
  now: () => new Date(),
  cacheTtlMs: config.artwork.cacheTtlMs,
};

export class ArtworkService {
  constructor(
    private readonly cacheDir: string = config.cacheDir,
    private readonly client: ArtworkClient = defaultArtworkClient,
    private readonly deps: ArtworkDeps = defaultArtworkDeps,
  ) {}

  cachePath(steamAppId: number, kind: ArtworkKind): string {
    return this.resolveCachePath(steamAppId, kind);
  }

  async downloadToCache(
    steamAppId: number,
    kind: ArtworkKind,
    remoteUrl: string | null | undefined,
  ): Promise<string | null> {
    if (!remoteUrl) return null;
    const target = this.resolveCachePath(steamAppId, kind, remoteUrl);
    if (await this.fileExists(target)) {
      if (await this.isCacheStale(target)) {
        logger.debug({ steamAppId, kind }, 'artwork cache stale — re-downloading');
        try { await fs.unlink(target); } catch { /* ignore */ }
      } else {
        logger.debug({ steamAppId, kind }, 'artwork cache hit — skipping download');
        return target;
      }
    }
    try {
      const bytes = await this.client.download(remoteUrl);
      await fs.mkdir(join(this.cacheDir, 'artwork', String(steamAppId)), { recursive: true });
      await fs.writeFile(target, bytes);
      logger.info(
        { steamAppId, kind, bytes: bytes.byteLength, contentType: detectContentType(bytes) },
        'artwork cached',
      );
      return target;
    } catch (err) {
      logger.warn(
        { err: (err as Error).message, steamAppId, kind, url: remoteUrl },
        'artwork download failed',
      );
      return null;
    }
  }

  async exists(steamAppId: number, kind: ArtworkKind): Promise<boolean> {
    const path = await this.findCachedFile(steamAppId, kind);
    if (!path) return false;
    return this.fileExists(path);
  }

  async readWithContentType(
    steamAppId: number,
    kind: ArtworkKind,
  ): Promise<{ bytes: Buffer; contentType: string } | null> {
    const path = await this.findCachedFile(steamAppId, kind);
    if (!path) return null;
    try {
      const buf = await fs.readFile(path);
      const contentType = detectContentType(new Uint8Array(buf));
      return { bytes: buf, contentType };
    } catch {
      return null;
    }
  }

  async remove(steamAppId: number): Promise<void> {
    const dir = join(this.cacheDir, 'artwork', String(steamAppId));
    try {
      await fs.rm(dir, { recursive: true, force: true });
      logger.info({ steamAppId }, 'artwork cache pruned');
    } catch (err) {
      logger.debug({ err: (err as Error).message, steamAppId }, 'artwork cache prune skipped');
    }
  }

  cachePathGeneric(provider: string, remoteId: string, kind: ArtworkKind): string {
    return this.resolveCachePathGeneric(provider, remoteId, kind);
  }

  async existsGeneric(provider: string, remoteId: string, kind: ArtworkKind): Promise<boolean> {
    const path = await this.findCachedFileGeneric(provider, remoteId, kind);
    if (!path) return false;
    return this.fileExists(path);
  }

  async downloadToCacheGeneric(
    provider: string,
    remoteId: string,
    kind: ArtworkKind,
    remoteUrl: string | null | undefined,
  ): Promise<string | null> {
    if (!remoteUrl) return null;
    const target = this.resolveCachePathGeneric(provider, remoteId, kind, remoteUrl);
    if (await this.fileExists(target)) {
      if (await this.isCacheStale(target)) {
        logger.debug({ provider, remoteId, kind }, 'artwork cache stale (generic) — re-downloading');
        try { await fs.unlink(target); } catch { /* ignore */ }
      } else {
        logger.debug({ provider, remoteId, kind }, 'artwork cache hit (generic) — skipping download');
        return target;
      }
    }
    try {
      const bytes = await this.client.download(remoteUrl);
      await fs.mkdir(join(this.cacheDir, 'artwork', provider, remoteId), { recursive: true });
      await fs.writeFile(target, bytes);
      logger.info(
        { provider, remoteId, kind, bytes: bytes.byteLength, contentType: detectContentType(bytes) },
        'artwork cached (generic)',
      );
      return target;
    } catch (err) {
      logger.warn(
        { err: (err as Error).message, provider, remoteId, kind, url: remoteUrl },
        'artwork download failed (generic)',
      );
      return null;
    }
  }

  async readWithContentTypeGeneric(
    provider: string,
    remoteId: string,
    kind: ArtworkKind,
  ): Promise<{ bytes: Buffer; contentType: string } | null> {
    const path = await this.findCachedFileGeneric(provider, remoteId, kind);
    if (!path) return null;
    try {
      const buf = await fs.readFile(path);
      const contentType = detectContentType(new Uint8Array(buf));
      return { bytes: buf, contentType };
    } catch {
      return null;
    }
  }

  async removeGeneric(provider: string, remoteId: string): Promise<void> {
    const dir = join(this.cacheDir, 'artwork', provider, remoteId);
    try {
      await fs.rm(dir, { recursive: true, force: true });
      logger.info({ provider, remoteId }, 'artwork cache pruned (generic)');
    } catch (err) {
      logger.debug(
        { err: (err as Error).message, provider, remoteId },
        'artwork cache prune skipped (generic)',
      );
    }
  }

  private cacheBustSuffix(url: string): string {
    try {
      const parsed = new URL(url);
      const token = parsed.searchParams.get('t') ?? parsed.searchParams.get('v');
      if (token) return `-${token}`;
    } catch {
      // ignore invalid URL
    }
    return '';
  }

  private resolveCachePath(
    steamAppId: number,
    kind: ArtworkKind,
    remoteUrl?: string,
  ): string {
    const suffix = remoteUrl ? this.cacheBustSuffix(remoteUrl) : '';
    return join(this.cacheDir, 'artwork', String(steamAppId), `${kind}${suffix}`);
  }

  private resolveCachePathGeneric(
    provider: string,
    remoteId: string,
    kind: ArtworkKind,
    remoteUrl?: string,
  ): string {
    const suffix = remoteUrl ? this.cacheBustSuffix(remoteUrl) : '';
    return join(this.cacheDir, 'artwork', provider, remoteId, `${kind}${suffix}`);
  }

  private async isCacheStale(path: string): Promise<boolean> {
    try {
      const stat = await fs.stat(path);
      const ageMs = this.deps.now().getTime() - stat.mtimeMs;
      return ageMs > this.deps.cacheTtlMs;
    } catch {
      return false;
    }
  }

  private async fileExists(path: string): Promise<boolean> {
    try {
      const stat = await fs.stat(path);
      return stat.isFile() && stat.size > 0;
    } catch {
      return false;
    }
  }

  private async findCachedFile(steamAppId: number, kind: ArtworkKind): Promise<string | null> {
    const dir = join(this.cacheDir, 'artwork', String(steamAppId));
    return this.findLatestMatchingFile(dir, kind);
  }

  private async findCachedFileGeneric(
    provider: string,
    remoteId: string,
    kind: ArtworkKind,
  ): Promise<string | null> {
    const dir = join(this.cacheDir, 'artwork', provider, remoteId);
    return this.findLatestMatchingFile(dir, kind);
  }

  private async findLatestMatchingFile(dir: string, kind: ArtworkKind): Promise<string | null> {
    let best: { path: string; mtime: Date } | null = null;
    try {
      const entries = await fs.readdir(dir);
      for (const entry of entries) {
        if (entry === kind || entry.startsWith(`${kind}-`)) {
          const path = join(dir, entry);
          const stat = await fs.stat(path);
          if (stat.isFile() && stat.size > 0 && (!best || stat.mtime > best.mtime)) {
            best = { path, mtime: stat.mtime };
          }
        }
      }
    } catch {
      // ignore missing directory or read errors
    }
    return best?.path ?? null;
  }
}

export const artworkService = new ArtworkService(config.cacheDir, defaultArtworkClient, defaultArtworkDeps);
