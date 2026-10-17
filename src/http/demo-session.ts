import { randomUUID } from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';

const COOKIE_NAME = 'kr8bit_demo_session';
const SESSION_PATTERN = /^[0-9a-f-]{36}$/i;

const DEMO_SESSION_ROOT_PREFIX = '/demo/sessions/';
export const LEGACY_DEMO_SESSION_ROOT = `${DEMO_SESSION_ROOT_PREFIX}legacy/`;
export const LEGACY_DEMO_LIBRARY_PREFIX = '/demo/library/';

export function demoSessionRoot(sessionId: string): string {
  return `${DEMO_SESSION_ROOT_PREFIX}${sessionId}/`;
}

export function isDemoSessionRoot(path: string): boolean {
  if (!path.startsWith(DEMO_SESSION_ROOT_PREFIX) || !path.endsWith('/')) return false;
  return path.slice(DEMO_SESSION_ROOT_PREFIX.length).split('/').filter(Boolean).length === 1;
}

declare module 'fastify' {
  interface FastifyRequest {
    demoSessionScope?: string;
  }
}

export function demoSessionScope(request: FastifyRequest): string | undefined {
  const cookies = request.headers.cookie?.split(';').map((part) => part.trim()) ?? [];
  const value = cookies.find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`))?.split('=')[1];
  if (value && SESSION_PATTERN.test(value)) return demoSessionRoot(value);
  return undefined;
}

export function ensureDemoSession(request: FastifyRequest, reply: FastifyReply): void {
  const existing = demoSessionScope(request);
  if (existing) {
    request.demoSessionScope = existing;
    return;
  }
  const sessionId = randomUUID();
  request.demoSessionScope = demoSessionRoot(sessionId);
  reply.header('Set-Cookie', `${COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Lax`);
}
