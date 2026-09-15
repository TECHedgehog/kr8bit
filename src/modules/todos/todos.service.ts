import { ValidationError } from '../../shared/errors.js';
import { todosRepository } from './todos.repository.js';
import type { TodoCreateInput, TodoPriority, TodoUpdateInput, TodoColor } from './todos.types.js';

const MAX_TITLE_LENGTH = 200;
const PRIORITIES = ['', '!', '!!', '!!!'] as const;
const COLORS = ['indigo', 'violet', 'teal', 'amber', 'rose'] as const;

function validateTitle(title: unknown): string {
  if (typeof title !== 'string') throw new ValidationError('title must be a string');
  const normalized = title.trim();
  if (!normalized) throw new ValidationError('title is required');
  if (normalized.length > MAX_TITLE_LENGTH) throw new ValidationError(`title must be ${MAX_TITLE_LENGTH} characters or fewer`);
  return normalized;
}

function validatePriority(priority: unknown): TodoPriority {
  if (typeof priority !== 'string' || !PRIORITIES.includes(priority as TodoPriority)) throw new ValidationError('invalid priority');
  return priority as TodoPriority;
}

function validateColor(color: unknown): TodoColor {
  if (color === null) return null;
  if (typeof color !== 'string' || !COLORS.includes(color as TodoColor & string)) throw new ValidationError('invalid color');
  return color as TodoColor;
}

export function parseCreateInput(body: unknown): TodoCreateInput {
  const raw = body && typeof body === 'object' ? body as Record<string, unknown> : {};
  const input: TodoCreateInput = { title: validateTitle(raw.title) };
  if (raw.parentId !== undefined) {
    if (typeof raw.parentId !== 'string' || !raw.parentId) throw new ValidationError('parentId must be a valid id');
    input.parentId = raw.parentId;
  }
  if (raw.priority !== undefined) input.priority = validatePriority(raw.priority);
  if (raw.color !== undefined) input.color = validateColor(raw.color);
  return input;
}

export function parseUpdateInput(body: unknown): TodoUpdateInput {
  if (!body || typeof body !== 'object') throw new ValidationError('request body must be an object');
  const raw = body as Record<string, unknown>;
  const input: TodoUpdateInput = {};
  if ('title' in raw) input.title = validateTitle(raw.title);
  if ('completed' in raw) {
    if (typeof raw.completed !== 'boolean') throw new ValidationError('completed must be a boolean');
    input.completed = raw.completed;
  }
  if ('priority' in raw) input.priority = validatePriority(raw.priority);
  if ('color' in raw) input.color = validateColor(raw.color);
  if (Object.keys(input).length === 0) throw new ValidationError('at least one field is required');
  return input;
}

export const todosService = {
  list: () => todosRepository.list(),
  async create(input: TodoCreateInput) {
    if (input.parentId) {
      const parent = await todosRepository.get(input.parentId);
      if (!parent) throw new ValidationError('parent task not found');
      if (parent.parentId) throw new ValidationError('subtasks cannot have subtasks');
    }
    return todosRepository.create(input);
  },
  async update(id: string, input: TodoUpdateInput) {
    const existing = await todosRepository.get(id);
    if (!existing) throw new ValidationError('task not found');
    return todosRepository.update(id, input);
  },
  delete: (id: string) => todosRepository.delete(id),
  async reorder(ids: string[]) {
    if (ids.length === 0 || new Set(ids).size !== ids.length) throw new ValidationError('reorder requires unique task ids');
    const todos = await todosRepository.list();
    const selected = ids.map((id) => todos.find((todo) => todo.id === id));
    if (selected.some((todo) => !todo) || selected.some((todo) => todo!.parentId !== selected[0]!.parentId || todo!.completed !== selected[0]!.completed)) {
      throw new ValidationError('tasks must share parent and completion state');
    }
    await todosRepository.reorder(ids);
    return { updated: ids.length };
  },
};
