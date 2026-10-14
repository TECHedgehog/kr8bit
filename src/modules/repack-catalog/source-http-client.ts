import { setTimeout as delay } from 'node:timers/promises';

export interface SourceHttpClientOptions {
  minDelayMs?: number;
  maxDelayMs?: number;
  concurrency?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number, options?: { signal?: AbortSignal }) => Promise<void>;
  now?: () => number;
  random?: () => number;
}

export interface SourceHttpResponse {
  html: string;
  unchanged: boolean;
}

export class SourceBlockedError extends Error {
  constructor(public readonly status: number) {
    super(`source refused request: ${status}`);
    this.name = 'SourceBlockedError';
  }
}

interface CachedPage {
  html: string;
  etag?: string;
  lastModified?: string;
}

export class SourceHttpClient {
  private readonly cache = new Map<string, CachedPage>();
  private readonly minDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly concurrency: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number, options?: { signal?: AbortSignal }) => Promise<void>;
  private readonly now: () => number;
  private readonly random: () => number;
  private active = 0;
  private waiters: Array<() => void> = [];
  private paceChain = Promise.resolve();
  private nextRequestAt = 0;

  constructor(options: SourceHttpClientOptions = {}) {
    this.minDelayMs = options.minDelayMs ?? 1_500;
    this.maxDelayMs = options.maxDelayMs ?? 3_500;
    this.concurrency = options.concurrency ?? 2;
    this.maxRetries = options.maxRetries ?? 2;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.sleep = options.sleep ?? ((ms, sleepOptions) => delay(ms, undefined, sleepOptions));
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
  }

  async get(url: string, signal?: AbortSignal): Promise<SourceHttpResponse> {
    await this.acquire(signal);
    try {
      for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
        await this.waitForPace(signal);
        const cached = this.cache.get(url);
        const headers: Record<string, string> = {
          accept: 'text/html,application/xhtml+xml',
          'user-agent': 'kr8bit catalog sync',
        };
        if (cached?.etag) headers['if-none-match'] = cached.etag;
        if (cached?.lastModified) headers['if-modified-since'] = cached.lastModified;
        const response = await this.fetchImpl(url, { signal, headers });

        if (response.status === 304 && cached) return { html: cached.html, unchanged: true };
        if (response.ok) {
          const page = {
            html: await response.text(),
            etag: response.headers.get('etag') ?? undefined,
            lastModified: response.headers.get('last-modified') ?? undefined,
          };
          this.cache.set(url, page);
          return { html: page.html, unchanged: false };
        }
        if (response.status === 401 || response.status === 403) throw new SourceBlockedError(response.status);
        if (response.status === 429) {
          if (attempt === this.maxRetries) throw new SourceBlockedError(response.status);
          await this.sleep(this.retryDelay(response.headers.get('retry-after'), attempt));
          continue;
        }
        if (response.status < 500 || attempt === this.maxRetries) {
          throw new Error(`source request failed: ${response.status}`);
        }
        await this.sleep(this.retryDelay(response.headers.get('retry-after'), attempt));
      }
      throw new Error('source request exhausted retries');
    } finally {
      this.release();
    }
  }

  private retryDelay(retryAfter: string | null, attempt: number): number {
    const seconds = Number(retryAfter);
    const dateDelay = retryAfter && Number.isNaN(seconds) ? Date.parse(retryAfter) - this.now() : NaN;
    const requested = Number.isFinite(seconds) ? seconds * 1_000 : dateDelay;
    const fallback = 2 ** attempt * 2_000;
    if (Number.isFinite(requested)) return Math.max(1_000, requested);
    return Math.min(60_000, fallback);
  }

  private async waitForPace(signal?: AbortSignal): Promise<void> {
    let waitMs = 0;
    const previous = this.paceChain;
    let release!: () => void;
    this.paceChain = new Promise<void>((resolve) => { release = resolve; });
    await previous;
    const now = this.now();
    waitMs = Math.max(0, this.nextRequestAt - now);
    const jitter = this.minDelayMs + this.random() * (this.maxDelayMs - this.minDelayMs);
    this.nextRequestAt = Math.max(now, this.nextRequestAt) + jitter;
    release();
    if (waitMs > 0) await this.sleep(waitMs, signal ? { signal } : undefined);
  }

  private async acquire(signal?: AbortSignal): Promise<void> {
    if (this.active < this.concurrency) { this.active += 1; return; }
    await new Promise<void>((resolve, reject) => {
      const ready = () => { signal?.removeEventListener('abort', aborted); this.active += 1; resolve(); };
      const aborted = () => { this.waiters = this.waiters.filter((waiter) => waiter !== ready); reject(signal?.reason); };
      this.waiters.push(ready);
      signal?.addEventListener('abort', aborted, { once: true });
    });
  }

  private release(): void {
    this.active -= 1;
    this.waiters.shift()?.();
  }
}
