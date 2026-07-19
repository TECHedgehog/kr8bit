import { prisma } from '../../prisma-client.js';
import { mapPrismaError } from '../../shared/prisma-errors.js';
import { NotFoundError } from '../../shared/errors.js';
import { encodeArray } from '../../shared/json.js';
import { ScanStatus } from '../../shared/enums.js';
import { toDomain } from './scanner.mapper.js';
import type { ScanRun, ScanRunCreateInput, ScanRunUpdateInput } from './scanner.types.js';

export const scannerRepository = {
  async create(input: ScanRunCreateInput): Promise<ScanRun> {
    try {
      const row = await prisma.scanRun.create({
        data: {
          rootPath: input.rootPath,
          status: ScanStatus.RUNNING,
          errors: encodeArray([]),
        },
      });
      return toDomain(row);
    } catch (err) {
      throw mapPrismaError(err, 'ScanRun', 'create');
    }
  },

  async findById(id: string): Promise<ScanRun> {
    try {
      const row = await prisma.scanRun.findUnique({ where: { id } });
      if (!row) throw new NotFoundError('ScanRun', id);
      return toDomain(row);
    } catch (err) {
      throw mapPrismaError(err, 'ScanRun', id);
    }
  },

  async findLatest(): Promise<ScanRun | null> {
    const row = await prisma.scanRun.findFirst({
      orderBy: { startedAt: 'desc' },
    });
    return row ? toDomain(row) : null;
  },

  async findRunning(): Promise<ScanRun | null> {
    const row = await prisma.scanRun.findFirst({
      where: { status: ScanStatus.RUNNING },
      orderBy: { startedAt: 'desc' },
    });
    return row ? toDomain(row) : null;
  },

  async update(id: string, input: ScanRunUpdateInput): Promise<ScanRun> {
    try {
      const data: Record<string, unknown> = {};
      if (input.finishedAt !== undefined) data.finishedAt = input.finishedAt;
      if (input.found !== undefined) data.found = input.found;
      if (input.added !== undefined) data.added = input.added;
      if (input.updated !== undefined) data.updated = input.updated;
      if (input.failed !== undefined) data.failed = input.failed;
      if (input.status !== undefined) data.status = input.status;
      if (input.errors !== undefined) data.errors = encodeArray(input.errors);

      const row = await prisma.scanRun.update({ where: { id }, data });
      return toDomain(row);
    } catch (err) {
      throw mapPrismaError(err, 'ScanRun', id);
    }
  },
};