import { prisma } from '../../prisma-client.js';
import { mapPrismaError } from '../../shared/prisma-errors.js';
import type { Setting } from './settings.types.js';

export const settingsRepository = {
  async get(key: string): Promise<string | null> {
    try {
      const row = await prisma.setting.findUnique({ where: { key } });
      return row?.value ?? null;
    } catch (err) {
      throw mapPrismaError(err, 'Setting', key);
    }
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

  async setMany(entries: { key: string; value: string }[]): Promise<number> {
    try {
      await prisma.$transaction(
        entries.map((e) =>
          prisma.setting.upsert({
            where: { key: e.key },
            create: { key: e.key, value: e.value },
            update: { value: e.value },
          }),
        ),
      );
      return entries.length;
    } catch (err) {
      const first = entries[0]?.key ?? '';
      throw mapPrismaError(err, 'Setting', first);
    }
  },

  async list(): Promise<Setting[]> {
    try {
      return await prisma.setting.findMany({ orderBy: { key: 'asc' } });
    } catch (err) {
      throw mapPrismaError(err, 'Setting', 'list');
    }
  },

  async delete(key: string): Promise<void> {
    try {
      await prisma.setting.delete({ where: { key } });
    } catch (err) {
      throw mapPrismaError(err, 'Setting', key);
    }
  },
};