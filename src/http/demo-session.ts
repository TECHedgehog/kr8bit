import { randomUUID } from 'node:crypto';
import type { FastifyRequest, FastifyReply } from 'fastify';

const COOKIE_NAME = 'kr8bit_demo_session';
const SESSION_PATTERN = /^[0-9a-f-]{36}$/i;

declare module 'fastify' {
  interface FastifyRequest {
    demoSessionScope?: string;
  }
}

export function demoSessionScope(request: FastifyRequest): string | undefined {
  const cookies = request.headers.cookie?.split(';').map((part) => part.trim()) ?? [];
  const value = cookies.find((cookie) => cookie.startsWith(`${COOKIE_NAME}=`))?.split('=')[1];
  if (value && SESSION_PATTERN.test(value)) return `/demo/sessions/${value}/`;
  return undefined;
}

export function ensureDemoSession(request: FastifyRequest, reply: FastifyReply): void {
  const existing = demoSessionScope(request);
  if (existing) {
    request.demoSessionScope = existing;
    return;
  }
  const sessionId = randomUUID();
  request.demoSessionScope = `/demo/sessions/${sessionId}/`;
  reply.header('Set-Cookie', `${COOKIE_NAME}=${sessionId}; Path=/; HttpOnly; SameSite=Lax`);
}
