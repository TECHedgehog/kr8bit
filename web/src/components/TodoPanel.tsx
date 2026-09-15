import { useCallback, useEffect, useMemo, useState, type DragEvent, type FormEvent } from 'react';
import { api } from '../api/client';
import type { Todo } from '../api/types';
import IconCheck from '@tabler/icons-react/dist/esm/icons/IconCheck.mjs';
import IconCircleCheck from '@tabler/icons-react/dist/esm/icons/IconCircleCheck.mjs';
import IconCircleDashed from '@tabler/icons-react/dist/esm/icons/IconCircleDashed.mjs';
import IconListDetails from '@tabler/icons-react/dist/esm/icons/IconListDetails.mjs';
import IconPencil from '@tabler/icons-react/dist/esm/icons/IconPencil.mjs';
import IconEye from '@tabler/icons-react/dist/esm/icons/IconEye.mjs';
import IconEyeOff from '@tabler/icons-react/dist/esm/icons/IconEyeOff.mjs';
import IconPlus from '@tabler/icons-react/dist/esm/icons/IconPlus.mjs';
import IconRefresh from '@tabler/icons-react/dist/esm/icons/IconRefresh.mjs';
import IconTrash from '@tabler/icons-react/dist/esm/icons/IconTrash.mjs';
import IconX from '@tabler/icons-react/dist/esm/icons/IconX.mjs';

const COLORS: { id: NonNullable<Todo['color']>; value: string; label: string }[] = [
  { id: 'indigo', value: '#818cf8', label: 'Indigo' },
  { id: 'violet', value: '#c084fc', label: 'Violet' },
  { id: 'teal', value: '#2dd4bf', label: 'Teal' },
  { id: 'amber', value: '#fbbf24', label: 'Amber' },
  { id: 'rose', value: '#fb7185', label: 'Rose' },
];

type StatusFilter = 'all' | 'active' | 'completed';
type PriorityValue = '!' | '!!' | '!!!';
type ColorValue = NonNullable<Todo['color']>;
type SortMode = 'manual' | 'priority' | 'title';

export function TodoPanel(): JSX.Element {
  const [items, setItems] = useState<Todo[]>([]);
  const [draft, setDraft] = useState('');
  const [subtaskParentId, setSubtaskParentId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityValue[]>([]);
  const [colorFilter, setColorFilter] = useState<ColorValue[]>([]);
  const [sortMode, setSortMode] = useState<SortMode>('manual');
  const [showCompleted, setShowCompleted] = useState(true);

  const loadItems = useCallback(async () => {
    const result = await api.get<{ items: Todo[] }>('/api/todos');
    setItems(result.items);
  }, []);

  useEffect(() => {
    loadItems().catch((err: Error) => setError(err.message));
  }, [loadItems]);

  const submitTodo = async (event: FormEvent<HTMLFormElement>, parentId?: string) => {
    event.preventDefault();
    if (!draft.trim()) return;
    try {
      await api.post<Todo>('/api/todos', { title: draft, ...(parentId ? { parentId } : {}) });
      setDraft('');
      setSubtaskParentId(null);
      setError(null);
      await loadItems();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const updateTodo = async (id: string, patch: Record<string, unknown>) => {
    try {
      await api.patch<Todo>(`/api/todos/${id}`, patch);
      setError(null);
      await loadItems();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const deleteTodo = async (id: string) => {
    try {
      await api.delete(`/api/todos/${id}`);
      setError(null);
      await loadItems();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const reorder = async (event: DragEvent<HTMLLIElement>, target: Todo) => {
    event.preventDefault();
    const sourceId = event.dataTransfer.getData('text/plain') || draggingId;
    const source = items.find((item) => item.id === sourceId);
    if (!source || source.id === target.id || source.parentId !== target.parentId || source.completed !== target.completed) return;
    const group = items.filter((item) => item.parentId === target.parentId && item.completed === target.completed).sort((a, b) => a.sortOrder - b.sortOrder);
    const ordered = group.filter((item) => item.id !== source.id);
    ordered.splice(ordered.findIndex((item) => item.id === target.id), 0, source);
    const sortOrders = new Map(ordered.map((item, index) => [item.id, index]));
    setItems((current) => current.map((item) => sortOrders.has(item.id) ? { ...item, sortOrder: sortOrders.get(item.id)! } : item));
    setDraggingId(null);
    try {
      await api.patch('/api/todos/reorder', { ids: ordered.map((item) => item.id) });
      setError(null);
    } catch (err) {
      setError((err as Error).message);
      await loadItems();
    }
  };

  const filteredItems = useMemo(() => {
    const matches = (todo: Todo) => {
      if (!showCompleted && todo.completed) return false;
      const statusMatches = statusFilter === 'all' || (statusFilter === 'active' ? !todo.completed : todo.completed);
      const priorityMatches = priorityFilter.length === 0 || priorityFilter.includes(todo.priority as PriorityValue);
      const colorMatches = colorFilter.length === 0 || (todo.color !== null && colorFilter.includes(todo.color));
      return statusMatches && priorityMatches && colorMatches;
    };
    const visibleRootIds = new Set(items.filter((todo) => todo.parentId === null && (matches(todo) || items.some((child) => child.parentId === todo.id && matches(child)))).map((todo) => todo.id));
    return items.filter((todo) => todo.parentId === null ? visibleRootIds.has(todo.id) : visibleRootIds.has(todo.parentId) && matches(todo));
  }, [colorFilter, items, priorityFilter, showCompleted, statusFilter]);

  const sortItems = (todoList: Todo[]) => [...todoList].sort((a, b) => {
    if (sortMode === 'priority') {
      const priorityDifference = b.priority.length - a.priority.length;
      if (priorityDifference !== 0) return priorityDifference;
    }
    if (sortMode === 'title') {
      const titleDifference = a.title.localeCompare(b.title);
      if (titleDifference !== 0) return titleDifference;
    }
    if (sortMode === 'manual') {
      const completedDifference = Number(a.completed) - Number(b.completed);
      if (completedDifference !== 0) return completedDifference;
    }
    return a.sortOrder - b.sortOrder;
  });

  const renderTodo = (todo: Todo, depth = 0): JSX.Element => {
    const children = sortItems(filteredItems.filter((item) => item.parentId === todo.id));
    const isEditing = editingId === todo.id;
    return (
      <li
        className={`todo-item${todo.completed ? ' is-completed' : ''}${draggingId === todo.id ? ' is-dragging' : ''}`}
        key={todo.id}
        draggable
        onDragStart={(event) => { event.dataTransfer.setData('text/plain', todo.id); setDraggingId(todo.id); }}
        onDragEnd={() => setDraggingId(null)}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => void reorder(event, todo)}
        style={{ '--todo-accent': COLORS.find((color) => color.id === todo.color)?.value ?? 'var(--accent)' } as React.CSSProperties}
      >
        <span className="todo-item__handle" aria-hidden="true">⋮⋮</span>
        <input type="checkbox" checked={todo.completed} onChange={() => void updateTodo(todo.id, { completed: !todo.completed })} aria-label={`Complete ${todo.title}`} />
        <div className="todo-item__body">
          <div className="todo-item__title-row">
            {isEditing ? <input className="todo-item__edit" value={editingTitle} onChange={(event) => setEditingTitle(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void updateTodo(todo.id, { title: editingTitle }).then(() => setEditingId(null)); if (event.key === 'Escape') setEditingId(null); }} autoFocus maxLength={200} aria-label="Edit reminder" /> : <span className="todo-item__title">{todo.title}</span>}
            {todo.priority && <span className={`todo-priority-badge todo-priority-badge--${todo.priority.length}`} aria-label={`Priority ${todo.priority}`}>{todo.priority}</span>}
          </div>
          {isEditing && <div className="todo-item__edit-controls">
            <div className="todo-priority-toggles" role="group" aria-label={`Priority for ${todo.title}`}>
              {(['!', '!!', '!!!'] as const).map((priority) => <button type="button" key={priority} className={`todo-priority-toggle${todo.priority === priority ? ' is-active' : ''}`} onClick={() => void updateTodo(todo.id, { priority: todo.priority === priority ? '' : priority })} aria-pressed={todo.priority === priority}>{priority}</button>)}
            </div>
            <div className="todo-item__colors" role="group" aria-label={`Color for ${todo.title}`}>
              <button type="button" className={`todo-color todo-color--none${todo.color === null ? ' is-active' : ''}`} onClick={() => void updateTodo(todo.id, { color: null })} aria-label="No color" aria-pressed={todo.color === null} />
              {COLORS.map((color) => <button type="button" key={color.id} className={`todo-color todo-color--${color.id}${todo.color === color.id ? ' is-active' : ''}`} onClick={() => void updateTodo(todo.id, { color: color.id })} aria-label={color.label} aria-pressed={todo.color === color.id} />)}
            </div>
          </div>}
        </div>
        <div className="todo-item__actions">
          {isEditing ? <><button type="button" className="todo-icon-button" onClick={() => void updateTodo(todo.id, { title: editingTitle }).then(() => setEditingId(null))} aria-label="Save reminder" title="Save reminder"><IconCheck size={15} stroke={2} /></button><button type="button" className="todo-icon-button" onClick={() => setEditingId(null)} aria-label="Cancel editing" title="Cancel editing"><IconX size={15} stroke={2} /></button></> : <button type="button" className="todo-icon-button" onClick={() => { setEditingId(todo.id); setEditingTitle(todo.title); }} aria-label={`Edit ${todo.title}`} title="Edit"><IconPencil size={15} stroke={2} /></button>}
          {depth === 0 && <button type="button" className="todo-icon-button" onClick={() => setSubtaskParentId(todo.id)} aria-label={`Add subtask to ${todo.title}`} title="Add subtask"><IconListDetails size={15} stroke={2} /></button>}
          <button type="button" className="todo-icon-button" onClick={() => void deleteTodo(todo.id)} aria-label={`Delete ${todo.title}`} title="Delete"><IconTrash size={15} stroke={2} /></button>
        </div>
        {subtaskParentId === todo.id && <form className="todo-subtask-form" onSubmit={(event) => void submitTodo(event, todo.id)}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add subtask" autoFocus maxLength={200} /><button type="submit">Add</button></form>}
        {children.length > 0 && <ul className="todo-list todo-list--nested">{children.map((child) => renderTodo(child, 1))}</ul>}
      </li>
    );
  };

  const roots = sortItems(filteredItems.filter((item) => item.parentId === null));
  return (
    <section className="todo-panel" aria-label="To-do list">
      <div className="todo-panel__heading"><div><p className="eyebrow">Reminders</p><h2>To-do list</h2></div><div className="todo-panel__summary"><span>{items.filter((item) => !item.completed).length} remaining / {items.filter((item) => item.completed).length} completed</span><button type="button" className="todo-icon-button" onClick={() => setShowCompleted((visible) => !visible)} aria-label={showCompleted ? 'Hide completed tasks' : 'Show completed tasks'} title={showCompleted ? 'Hide completed' : 'Show completed'}>{showCompleted ? <IconEyeOff size={15} stroke={2} /> : <IconEye size={15} stroke={2} />}</button></div></div>
      <form className="todo-panel__form" onSubmit={(event) => void submitTodo(event)}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add a reminder" aria-label="New reminder" maxLength={200} /><button type="submit" className="todo-icon-button" aria-label="Add reminder" title="Add reminder"><IconPlus size={16} stroke={2} /></button></form>
      <div className="todo-panel__filters" aria-label="Todo filters and sorting">
        <div className="todo-filter-group"><button type="button" className={`todo-filter-chip todo-filter-icon${statusFilter === 'active' ? ' is-active' : ''}`} onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')} aria-label="Active tasks" title="Active tasks"><IconCircleDashed size={15} stroke={2} /></button><button type="button" className={`todo-filter-chip todo-filter-icon${statusFilter === 'completed' ? ' is-active' : ''}`} onClick={() => setStatusFilter(statusFilter === 'completed' ? 'all' : 'completed')} aria-label="Completed tasks" title="Completed tasks"><IconCircleCheck size={15} stroke={2} /></button></div>
        <div className="todo-filter-group">{(['!', '!!', '!!!'] as const).map((value) => <button type="button" key={value} className={`todo-filter-chip${priorityFilter.includes(value) ? ' is-active' : ''}`} onClick={() => setPriorityFilter(priorityFilter.includes(value) ? priorityFilter.filter((item) => item !== value) : [...priorityFilter, value])}>{value}</button>)}</div>
        <div className="todo-filter-group">{COLORS.map((color) => <button type="button" key={color.id} className={`todo-filter-chip todo-filter-chip--${color.id}${colorFilter.includes(color.id) ? ' is-active' : ''}`} onClick={() => setColorFilter(colorFilter.includes(color.id) ? colorFilter.filter((item) => item !== color.id) : [...colorFilter, color.id])} aria-label={`${color.label} color`} />)}</div>
        <button type="button" className="todo-filter-chip todo-filter-icon" onClick={() => { setStatusFilter('all'); setPriorityFilter([]); setColorFilter([]); setSortMode('manual'); setShowCompleted(true); }} aria-label="Reset filters" title="Reset filters"><IconRefresh size={15} stroke={2} /></button>
      </div>
      <div className="todo-panel__filters todo-panel__filters--sort" aria-label="Todo sorting"><div className="todo-filter-group">{(['manual', 'priority', 'title'] as const).map((value) => <button type="button" key={value} className={`todo-filter-chip${sortMode === value ? ' is-active' : ''}`} onClick={() => setSortMode(value)}>{value[0].toUpperCase() + value.slice(1)}</button>)}</div></div>
      {error && <p className="todo-panel__error">{error}</p>}
      <ul className="todo-list">{roots.map((todo) => renderTodo(todo))}</ul>
      {items.length === 0 && <p className="todo-panel__empty">No reminders yet.</p>}
    </section>
  );
}
