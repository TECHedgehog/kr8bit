export interface RetryOptions {
  retries: number;
  baseDelayMs: number;
  retryOn?: (err: Error) => boolean;
}

export class RetryableHttpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetryableHttpError';
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
