import type { ApiErrorEnvelope } from './types';

export class ApiError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(envelope: ApiErrorEnvelope) {
    super(envelope.message);
    this.name = 'ApiError';
    this.statusCode = envelope.statusCode;
    this.code = envelope.code;
  }
}

async function parseEnvelope(res: Response): Promise<ApiErrorEnvelope> {
  const text = await res.text();
  try {
    const body = JSON.parse(text) as ApiErrorEnvelope;
    if (typeof body.statusCode === 'number' && typeof body.message === 'string') {
      return body;
    }
  } catch {
    // not JSON
  }
  return {
    statusCode: res.status,
    code: 'HTTP_ERROR',
    error: 'HttpError',
    message: text || `${res.status} ${res.statusText}`,
  };
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const init: RequestInit = { method, headers: {} };
  if (body !== undefined) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(path, init);
  if (!res.ok) {
    throw new ApiError(await parseEnvelope(res));
  }
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
};