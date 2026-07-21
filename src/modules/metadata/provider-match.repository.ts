import { prisma } from '../../prisma-client.js';
import { mapPrismaError } from '../../shared/prisma-errors.js';
import { NotFoundError } from '../../shared/errors.js';

export interface ProviderMatch {
  id: string;
  gameId: string;
  providerName: string;
  remoteId: string;
  matchScore: number | null;
  matchedAt: Date;
  isPrimary: boolean;
  createdAt: Date;
}

export interface ProviderMatchUpsertInput {
  gameId: string;
  providerName: string;
  remoteId: string;
  matchScore: number | null;
  isPrimary: boolean;
  matchedAt: Date;
}

function toDomain(row: {
  id: string;
  gameId: string;
  providerName: string;
  remoteId: string;
  matchScore: number | null;
  matchedAt: Date;
  isPrimary: boolean;
  createdAt: Date;
}): ProviderMatch {
  return { ...row };
}

export const providerMatchRepository = {
  async upsert(input: ProviderMatchUpsertInput): Promise<ProviderMatch> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        if (input.isPrimary) {
          await tx.providerMatch.updateMany({
            where: { gameId: input.gameId, isPrimary: true },
            data: { isPrimary: false },
          });
        }
        return tx.providerMatch.upsert({
          where: {
            gameId_providerName: {
              gameId: input.gameId,
              providerName: input.providerName,
            },
          },
          update: {
            remoteId: input.remoteId,
            matchScore: input.matchScore,
            isPrimary: input.isPrimary,
            matchedAt: input.matchedAt,
          },
          create: {
            gameId: input.gameId,
            providerName: input.providerName,
            remoteId: input.remoteId,
            matchScore: input.matchScore,
            isPrimary: input.isPrimary,
            matchedAt: input.matchedAt,
          },
        });
      });
      return toDomain(result);
    } catch (err) {
      throw mapPrismaError(err, 'ProviderMatch', input.gameId);
    }
  },

  async findPrimaryByGame(gameId: string): Promise<ProviderMatch | null> {
    const row = await prisma.providerMatch.findFirst({
      where: { gameId, isPrimary: true },
    });
    return row ? toDomain(row) : null;
  },

  async findByGameAndProvider(
    gameId: string,
    providerName: string,
  ): Promise<ProviderMatch | null> {
    const row = await prisma.providerMatch.findUnique({
      where: {
        gameId_providerName: { gameId, providerName },
      },
    });
    return row ? toDomain(row) : null;
  },

  async findByGame(gameId: string): Promise<ProviderMatch[]> {
    const rows = await prisma.providerMatch.findMany({
      where: { gameId },
      orderBy: { matchedAt: 'desc' },
    });
    return rows.map(toDomain);
  },

  async findByProviderAndRemoteId(
    providerName: string,
    remoteId: string,
  ): Promise<ProviderMatch | null> {
    const row = await prisma.providerMatch.findFirst({
      where: { providerName, remoteId },
    });
    return row ? toDomain(row) : null;
  },

  async deleteByGame(gameId: string): Promise<void> {
    try {
      await prisma.providerMatch.deleteMany({ where: { gameId } });
    } catch (err) {
      throw mapPrismaError(err, 'ProviderMatch', gameId);
    }
  },

  async deleteByGameAndProvider(
    gameId: string,
    providerName: string,
  ): Promise<void> {
    try {
      await prisma.providerMatch.delete({
        where: {
          gameId_providerName: { gameId, providerName },
        },
      });
    } catch (err) {
      throw mapPrismaError(err, 'ProviderMatch', gameId);
    }
  },

  async findById(id: string): Promise<ProviderMatch> {
    try {
      const row = await prisma.providerMatch.findUnique({ where: { id } });
      if (!row) throw new NotFoundError('ProviderMatch', id);
      return toDomain(row);
    } catch (err) {
      throw mapPrismaError(err, 'ProviderMatch', id);
    }
  },
};