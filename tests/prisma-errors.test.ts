import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { mapPrismaError } from '../src/shared/prisma-errors.js';
import { AppError, NotFoundError } from '../src/shared/errors.js';

describe('mapPrismaError', () => {
  it('maps P2025 to NotFoundError', () => {
    const err = new Prisma.PrismaClientKnownRequestError('record not found', {
      code: 'P2025',
      clientVersion: '5.22.0',
    });
    const out = mapPrismaError(err, 'Game', 'abc');
    expect(out).toBeInstanceOf(NotFoundError);
    expect(out.statusCode).toBe(404);
  });

  it('maps P2002 to 409 Conflict', () => {
    const err = new Prisma.PrismaClientKnownRequestError('dup', {
      code: 'P2002',
      clientVersion: '5.22.0',
    });
    const out = mapPrismaError(err, 'Game', 'abc');
    expect(out).toBeInstanceOf(AppError);
    expect(out.statusCode).toBe(409);
    expect(out.code).toBe('DUPLICATE');
  });

  it('passes AppError through', () => {
    const original = new NotFoundError('Game', 'abc');
    const out = mapPrismaError(original, 'Game', 'abc');
    expect(out).toBe(original);
  });

  it('wraps generic Error', () => {
    const out = mapPrismaError(new Error('boom'), 'Game', 'abc');
    expect(out).toBeInstanceOf(AppError);
    expect(out.statusCode).toBe(500);
    expect(out.code).toBe('PERSIST_ERROR');
  });

  it('wraps unknown', () => {
    const out = mapPrismaError('weird', 'Game', 'abc');
    expect(out).toBeInstanceOf(AppError);
    expect(out.statusCode).toBe(500);
  });

  it('maps unknown Prisma code to generic 500', () => {
    const err = new Prisma.PrismaClientKnownRequestError('x', {
      code: 'P9999',
      clientVersion: '5.22.0',
    });
    const out = mapPrismaError(err, 'Game', 'abc');
    expect(out.statusCode).toBe(500);
  });
});