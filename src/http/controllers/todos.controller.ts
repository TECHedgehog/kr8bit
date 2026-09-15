import type { FastifyReply, FastifyRequest } from 'fastify';
import { parseCreateInput, parseUpdateInput, todosService } from '../../modules/todos/todos.service.js';
import { ValidationError } from '../../shared/errors.js';

export const todosController = {
  async list(_req: FastifyRequest, _reply: FastifyReply) {
    return { items: await todosService.list() };
  },

  async create(req: FastifyRequest, reply: FastifyReply) {
    const todo = await todosService.create(parseCreateInput(req.body));
    return reply.status(201).send(todo);
  },

  async update(req: FastifyRequest, _reply: FastifyReply) {
    const { id } = req.params as { id: string };
    return todosService.update(id, parseUpdateInput(req.body));
  },

  async delete(req: FastifyRequest, _reply: FastifyReply) {
    const { id } = req.params as { id: string };
    await todosService.delete(id);
    return { deleted: true, id };
  },

  async reorder(req: FastifyRequest, _reply: FastifyReply) {
    const body = req.body && typeof req.body === 'object' ? req.body as Record<string, unknown> : {};
    if (!Array.isArray(body.ids) || body.ids.some((id) => typeof id !== 'string')) throw new ValidationError('ids must be an array of strings');
    return todosService.reorder(body.ids);
  },
};
