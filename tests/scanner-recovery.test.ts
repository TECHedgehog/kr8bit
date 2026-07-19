import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { prisma } from '../src/prisma-client.js';
import { scannerRepository } from '../src/modules/scanner/scanner.repository.js';
import { recoverStaleScanRuns } from '../src/modules/scanner/scanner.recovery.js';
import { ScanStatus } from '../src/shared/enums.js';
import { encodeArray } from '../src/shared/json.js';

beforeEach(async () => {
  await prisma.scanRun.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('recoverStaleScanRuns', () => {
  it('does nothing when no stale rows exist', async () => {
    await recoverStaleScanRuns();
    const count = await prisma.scanRun.count({ where: { status: ScanStatus.FAILED } });
    expect(count).toBe(0);
  });

  it('marks RUNNING rows as FAILED with interrupted error', async () => {
    await prisma.scanRun.create({
      data: {
        rootPath: '/games',
        status: ScanStatus.RUNNING,
        errors: encodeArray([]),
      },
    });

    await recoverStaleScanRuns();

    const rows = await prisma.scanRun.findMany();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe(ScanStatus.FAILED);
    expect(rows[0].finishedAt).not.toBeNull();
    const errs = JSON.parse(rows[0].errors);
    expect(errs[0]).toContain('interrupted');
  });

  it('marks multiple stale rows in one call', async () => {
    for (let i = 0; i < 3; i += 1) {
      await prisma.scanRun.create({
        data: {
          rootPath: `/games${i}`,
          status: ScanStatus.RUNNING,
          errors: encodeArray([]),
        },
      });
    }

    await recoverStaleScanRuns();

    const failed = await scannerRepository.findLatest();
    expect(failed?.status).toBe(ScanStatus.FAILED);
    const count = await prisma.scanRun.count({ where: { status: ScanStatus.FAILED } });
    expect(count).toBe(3);
  });

  it('leaves already-finished runs untouched', async () => {
    await prisma.scanRun.create({
      data: {
        rootPath: '/games',
        status: ScanStatus.DONE,
        errors: encodeArray([]),
        finishedAt: new Date(),
      },
    });

    await recoverStaleScanRuns();

    const done = await prisma.scanRun.findFirst({ where: { status: ScanStatus.DONE } });
    expect(done).not.toBeNull();
  });
});