import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

const onSettingsChanged = vi.hoisted(() => vi.fn());

vi.mock('../src/modules/repack-catalog/repack-catalog.job.js', () => ({
  repackCatalogJob: {
    onSettingsChanged,
    isRunning: vi.fn(() => false),
    sync: vi.fn(),
    audit: vi.fn(),
  },
}));

import { buildServer } from '../src/http/server.js';
import { prisma } from '../src/prisma-client.js';
import { repackCatalogJob } from '../src/modules/repack-catalog/repack-catalog.job.js';

describe('repack catalog settings routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
    await prisma.setting.deleteMany({});
    app = await buildServer();
  });

  afterEach(async () => { if (app) await app.close(); });
  afterAll(async () => { await prisma.$disconnect(); });

  it('returns settings defaults and constraints', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/repack-catalog/settings' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      enabled: false,
      baseUrl: 'https://fitgirl-repacks.site/',
      intervalHours: 24,
      auditIntervalHours: 720,
      defaults: { intervalHours: 24, auditIntervalHours: 720 },
      constraints: {
        baseUrl: { protocol: 'https:' },
        intervalHours: { min: 1, max: 8760 },
        auditIntervalHours: { min: 1, max: 8760 },
      },
    });
  });

  it('accepts typed updates and persists string settings', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/repack-catalog/settings',
      payload: { enabled: true, intervalHours: 48, auditEnabled: true },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ enabled: true, intervalHours: 48, auditEnabled: true });
    expect(await prisma.setting.findMany({ orderBy: { key: 'asc' } })).toEqual([
      expect.objectContaining({ key: 'repackCatalogAuditEnabled', value: 'true' }),
      expect.objectContaining({ key: 'repackCatalogEnabled', value: 'true' }),
      expect.objectContaining({ key: 'repackCatalogIntervalHours', value: '48' }),
    ]);
    expect(repackCatalogJob.onSettingsChanged).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: false }),
      expect.objectContaining({ enabled: true, intervalHours: 48 }),
    );
  });

  it('returns 422 for invalid values and preserves existing settings', async () => {
    await prisma.setting.create({ data: { key: 'repackCatalogIntervalHours', value: '24' } });
    const response = await app.inject({
      method: 'PUT',
      url: '/api/repack-catalog/settings',
      payload: { enabled: 'true', intervalHours: 0 },
    });

    expect(response.statusCode).toBe(422);
    expect(response.json().code).toBe('VALIDATION_ERROR');
    expect(await prisma.setting.findUnique({ where: { key: 'repackCatalogIntervalHours' } })).toMatchObject({ value: '24' });
    expect(repackCatalogJob.onSettingsChanged).not.toHaveBeenCalled();
  });

  it('passes enabled-to-disabled transition to job for stopping', async () => {
    await prisma.setting.create({ data: { key: 'repackCatalogEnabled', value: 'true' } });
    const response = await app.inject({ method: 'PUT', url: '/api/repack-catalog/settings', payload: { enabled: false } });

    expect(response.statusCode).toBe(200);
    expect(repackCatalogJob.onSettingsChanged).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true }),
      expect.objectContaining({ enabled: false }),
    );
  });

  it('passes source URL change to job for immediate sync', async () => {
    await prisma.setting.create({ data: { key: 'repackCatalogEnabled', value: 'true' } });
    const response = await app.inject({
      method: 'PUT',
      url: '/api/repack-catalog/settings',
      payload: { baseUrl: 'https://fitgirl.example/' },
    });

    expect(response.statusCode).toBe(200);
    expect(repackCatalogJob.onSettingsChanged).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, baseUrl: 'https://fitgirl-repacks.site/' }),
      expect.objectContaining({ enabled: true, baseUrl: 'https://fitgirl.example/' }),
    );
  });
});
