import { request } from 'undici';
import { logger } from '../logger/index.js';
import { config } from '../config/index.js';
import { version } from '../app-version.js';

/** Single source for the outbound User-Agent (ADR-021 versioning). */
export const USER_AGENT = `kr8bit/${version}`;

export interface RetryOptions {
  retries: number;
  baseDelayMs: number;
  retryOn?: (err: Error) => boolean;
}

/** Thrown for retryable statuses (429/5xx); withRetry retries on these. */
export class RetryableHttpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableHttpError';
  }
}

/** Thrown for non-retryable non-2xx responses after the body is consumed. */
export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions,
): Promise<T> {
  const { retries, baseDelayMs, retryOn } = options;
  const shouldRetry = retryOn ?? ((err: Error) => err instanceof RetryableHttpError);

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === retries || !shouldRetry(err as Error)) {
        throw err;
      }
      const jitter = Math.random() * baseDelayMs * 0.3;
      const delay = baseDelayMs * Math.pow(2, attempt) + jitter;
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw new Error('unreachable');
}

export function isRetryableStatus(statusCode: number): boolean {
  return statusCode === 429 || statusCode >= 500;
}

/**
 * Strip query (and fragment) from a URL for logs and error messages.
 * Query strings can carry secrets (STEAM_API_KEY, IGDB client_secret) —
 * they must never reach logs.
 */
export function urlWithoutQuery(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return url;
  }
}

export interface HttpRequestOptions {
  /** Context label used in logs and error messages, e.g. 'steam applist'. */
  label: string;
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  headersTimeoutMs: number;
  bodyTimeoutMs: number;
  /** Defaults to config.httpRetry.count; pass 0 to disable retrying here. */
  retries?: number;
  baseDelayMs?: number;
}

async function fetchWithRetry<T>(
  url: string,
  options: HttpRequestOptions,
  read: (res: Awaited<ReturnType<typeof request>>) => Promise<T>,
): Promise<T> {
  const {
    label,
    method = 'GET',
    headers = {},
    body,
    headersTimeoutMs,
    bodyTimeoutMs,
  } = options;

  return withRetry(
    async () => {
      const res = await request(url, {
        method,
        headersTimeout: headersTimeoutMs,
        bodyTimeout: bodyTimeoutMs,
        headers: { 'User-Agent': USER_AGENT, ...headers },
        ...(body !== undefined ? { body } : {}),
      });
      if (isRetryableStatus(res.statusCode)) {
        // Consume the body so the keep-alive socket is released back to
        // the pool instead of staying pinned until timeout.
        try {
          await res.body.dump();
        } catch {
          // best effort — body may already be consumed or unsupported
        }
        throw new RetryableHttpError(`${label} http ${res.statusCode} for ${urlWithoutQuery(url)}`);
      }
      if (res.statusCode >= 400) {
        const text = await res.body.text().catch(() => '');
        logger.warn(
          { url: urlWithoutQuery(url), statusCode: res.statusCode, text: text.slice(0, 200) },
          `${label} http non-2xx`,
        );
        throw new HttpError(res.statusCode, `${label} http ${res.statusCode} for ${urlWithoutQuery(url)}`);
      }
      return read(res);
    },
    {
      retries: options.retries ?? config.httpRetry.count,
      baseDelayMs: options.baseDelayMs ?? config.httpRetry.baseDelayMs,
      retryOn: (err) => err instanceof RetryableHttpError,
    },
  );
}

export function requestJson<T>(url: string, options: HttpRequestOptions): Promise<T> {
  return fetchWithRetry(
    url,
    { ...options, headers: { Accept: 'application/json', ...options.headers } },
    (res) => res.body.json() as Promise<T>,
  );
}

export function requestText(url: string, options: HttpRequestOptions): Promise<string> {
  return fetchWithRetry(
    url,
    { ...options, headers: { Accept: 'text/html', ...options.headers } },
    (res) => res.body.text(),
  );
}

export function requestBytes(url: string, options: HttpRequestOptions): Promise<Uint8Array> {
  return fetchWithRetry(url, options, async (res) =>
    new Uint8Array(await res.body.arrayBuffer()),
  );
}
