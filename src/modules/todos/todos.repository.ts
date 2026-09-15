import { prisma } from '../../prisma-client.js';
import { mapPrismaError } from '../../shared/prisma-errors.js';
import type { TodoCreateInput, TodoUpdateInput } from './todos.types.js';

export const todosRepository = {
  async list() {
    try {
      return prisma.todo.findMany({ orderBy: [{ completed: 'asc' }, { parentId: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }] });
    } catch (err) {
      throw mapPrismaError(err, 'Todo', 'list');
    }
  },

  async create(input: TodoCreateInput) {
    try {
      const sortOrder = await prisma.todo.count({ where: { parentId: input.parentId ?? null, completed: false } });
      return prisma.todo.create({ data: { ...input, sortOrder } });
    } catch (err) {
      throw mapPrismaError(err, 'Todo', 'create');
    }
  },

  async get(id: string) {
    try {
      return await prisma.todo.findUnique({ where: { id } });
    } catch (err) {
      throw mapPrismaError(err, 'Todo', id);
    }
  },

  async update(id: string, input: TodoUpdateInput) {
    try {
      return await prisma.$transaction(async (tx) => {
        const todo = await tx.todo.update({ where: { id }, data: input });
        if (input.completed !== undefined) {
          await tx.todo.updateMany({ where: { parentId: id }, data: { completed: input.completed } });
        }
        return todo;
      });
    } catch (err) {
      throw mapPrismaError(err, 'Todo', id);
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await prisma.$transaction([
        prisma.todo.deleteMany({ where: { parentId: id } }),
        prisma.todo.delete({ where: { id } }),
      ]);
    } catch (err) {
      throw mapPrismaError(err, 'Todo', id);
    }
  },

  async reorder(ids: string[]): Promise<void> {
    try {
      await prisma.$transaction(ids.map((id, index) => prisma.todo.update({ where: { id }, data: { sortOrder: index } })));
    } catch (err) {
      throw mapPrismaError(err, 'Todo', 'reorder');
    }
  },
};
