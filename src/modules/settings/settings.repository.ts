import { prisma } from '../../prisma-client.js';
import { mapPrismaError } from '../../shared/prisma-errors.js';
import { NotFoundError } from '../../shared/errors.js';
import type { Setting } from './settings.types.js';

export const settingsRepository = {
  async get(key: string): Promise<string | null> {
    const row = await prisma.setting.findUnique({ where: { key } });
    return row?.value ?? null;
  },

  async getOrThrow(key: string): Promise<string> {
    const value = await this.get(key);
    if (value === null) throw new NotFoundError('Setting', key);
    return value;
  },

  async set(key: string, value: string): Promise<Setting> {
    try {
      const row = await prisma.setting.upsert({
        where: { key },
        create: { key, value },
        update: { value },
      });
      return row;
    } catch (err) {
      throw mapPrismaError(err, 'Setting', key);
    }
  },

  async list(): Promise<Setting[]> {
    return prisma.setting.findMany({ orderBy: { key: 'asc' } });
  },

  async delete(key: string): Promise<void> {
    try {
      await prisma.setting.delete({ where: { key } });
    } catch (err) {
      throw mapPrismaError(err, 'Setting', key);
    }
  },
};