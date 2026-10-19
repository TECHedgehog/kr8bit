import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from '../src/http/server.js';
import { prisma } from '../src/prisma-client.js';

describe('diagnostics routes', () => {
  let app: FastifyInstance;

  afterEach(async () => {
    if (app) await app.close();
  });

  it('exposes status and report endpoints', async () => {
    app = await buildServer();
    await prisma.providerMatch.deleteMany({});
    await prisma.game.deleteMany({});

    const status = await app.inject({ method: 'GET', url: '/api/diagnostics/status' });
    const report = await app.inject({ method: 'GET', url: '/api/diagnostics/report' });

    expect(status.statusCode).toBe(200);
    expect(status.json()).toMatchObject({ running: false, processed: 0, reportReady: false });
    expect(report.statusCode).toBe(404);

    const started = await app.inject({ method: 'POST', url: '/api/diagnostics/run' });
    expect(started.statusCode).toBe(202);
    let current = started.json();
    for (let attempt = 0; attempt < 50; attempt += 1) {
      const response = await app.inject({ method: 'GET', url: '/api/diagnostics/status' });
      current = response.json();
      if (current.reportReady) break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(current).toMatchObject({ running: false, total: 0, reportReady: true });

    const download = await app.inject({ method: 'GET', url: '/api/diagnostics/report' });
    expect(download.statusCode).toBe(200);
    expect(download.headers['content-disposition']).toContain('kr8bit-diagnostics-');
    expect(download.json().summary).toMatchObject({ totalGames: 0, problemGames: 0 });
  });
});
