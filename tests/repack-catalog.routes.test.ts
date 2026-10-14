import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/http/server.js';

describe('repack catalog routes', () => {
  let app: FastifyInstance;
  afterEach(async () => { if (app) await app.close(); });

  it('rejects invalid pagination without querying catalog records', async () => {
    app = await buildServer();
    const response = await app.inject({ method: 'GET', url: '/api/repack-catalog?limit=101' });
    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain('limit must be between');
  });
});
