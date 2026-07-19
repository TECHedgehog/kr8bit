import type { ScanRun as PrismaScanRun } from '@prisma/client';
import type { ScanRun } from './scanner.types.js';
import { decodeArray } from '../../shared/json.js';
import type { ScanStatus } from '../../shared/enums.js';

export function toDomain(row: PrismaScanRun): ScanRun {
  return {
    id: row.id,
    rootPath: row.rootPath,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    found: row.found,
    added: row.added,
    updated: row.updated,
    failed: row.failed,
    status: row.status as ScanStatus,
    errors: decodeArray(row.errors),
  };
}