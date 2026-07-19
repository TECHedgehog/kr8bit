import { Prisma } from '@prisma/client';
import { AppError, NotFoundError } from './errors.js';

export function mapPrismaError(err: unknown, resource: string, id: string | number): AppError {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') return new NotFoundError(resource, id);
    if (err.code === 'P2002') {
      return new AppError(409, `Duplicate ${resource}: ${id}`, 'DUPLICATE');
    }
  }
  if (err instanceof AppError) return err;
  if (err instanceof Error) {
    return new AppError(500, `${resource} persistence error: ${err.message}`, 'PERSIST_ERROR');
  }
  return new AppError(500, `Unknown ${resource} persistence error`, 'PERSIST_ERROR');
}