import type { FastifyPluginAsync } from 'fastify';
import { todosController } from '../controllers/todos.controller.js';

export const todosRoutes: FastifyPluginAsync = async (app) => {
  app.get('/api/todos', todosController.list);
  app.post('/api/todos', todosController.create);
  app.patch('/api/todos/reorder', todosController.reorder);
  app.patch('/api/todos/:id', todosController.update);
  app.delete('/api/todos/:id', todosController.delete);
};
