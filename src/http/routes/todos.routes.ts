import type { FastifyPluginAsync } from 'fastify';
import { todosController } from '../controllers/todos.controller.js';
import { requireDeveloperAccess } from '../developer-access.js';

export const todosRoutes: FastifyPluginAsync = async (app) => {
  const options = { preHandler: requireDeveloperAccess };
  app.get('/api/todos', options, todosController.list);
  app.post('/api/todos', options, todosController.create);
  app.patch('/api/todos/reorder', options, todosController.reorder);
  app.patch('/api/todos/:id', options, todosController.update);
  app.delete('/api/todos/:id', options, todosController.delete);
};
