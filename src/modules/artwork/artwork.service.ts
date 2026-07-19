import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { request } from 'undici';
import { logger } from '../../logger/index.js';
import { config } from '../../config/index.js';

export type ArtworkKind = 'header' | 'cover';

const IMAGE_PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];
const IMAGE_JPEG_MAGIC = [0xff, 0xd8, 0xff];

export interface ArtworkClient {
  download(url: string): Promise<Uint8Array>;
}

export const defaultArtworkClient: ArtworkClient = {
  async download(url) {
    const res = await request(url, {
      method: 'GET',
      headersTimeout: 15000,
      bodyTimeout: 30000,
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
  return 'application/octet-stream';
}

function matchesMagic(buf: Uint8Array, magic: number[]): boolean {
  for (let i = 0; i < magic.length; i += 1) {
    if (buf[i] !== magic[i]) return false;
  }
  return true;
}

export class ArtworkService {
  constructor(
    private readonly cacheDir: string = config.cacheDir,
    private readonly client: ArtworkClient = defaultArtworkClient,
  ) {}

  cachePath(steamAppId: number, kind: ArtworkKind): string {
    return join(this.cacheDir, 'artwork', String(steamAppId), kind);
  }

  streamPath(steamAppId: number, kind: ArtworkKind): string {
    return this.cachePath(steamAppId, kind);
  }

  async downloadToCache(
    steamAppId: number,
    kind: ArtworkKind,
    remoteUrl: string | null | undefined,
  ): Promise<string | null> {
    if (!remoteUrl) return null;
    const target = this.cachePath(steamAppId, kind);
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
    try {
      const stat = await fs.stat(this.cachePath(steamAppId, kind));
      return stat.isFile() && stat.size > 0;
    } catch {
      return false;
    }
  }

  async readWithContentType(
    steamAppId: number,
    kind: ArtworkKind,
  ): Promise<{ bytes: Buffer; contentType: string } | null> {
    const path = this.cachePath(steamAppId, kind);
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
}

export const artworkService = new ArtworkService();