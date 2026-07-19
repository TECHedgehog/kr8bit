import { logger } from '../../logger/index.js';
import { prisma } from '../../prisma-client.js';
import { encodeArray } from '../../shared/json.js';
import { ScanStatus } from '../../shared/enums.js';

export async function recoverStaleScanRuns(): Promise<void> {
  const count = await prisma.scanRun.count({
    where: { status: ScanStatus.RUNNING },
  });
  if (count === 0) return;

  logger.warn({ count }, 'recovering stale RUNNING scan runs');
  await prisma.scanRun.updateMany({
    where: { status: ScanStatus.RUNNING },
    data: {
      status: ScanStatus.FAILED,
      finishedAt: new Date(),
      errors: encodeArray(['interrupted: process restart']),
    },
  });
}