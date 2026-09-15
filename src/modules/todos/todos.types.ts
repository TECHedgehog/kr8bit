export interface Todo {
  id: string;
  title: string;
  completed: boolean;
  sortOrder: number;
  parentId: string | null;
  priority: TodoPriority;
  color: TodoColor;
  createdAt: Date;
  updatedAt: Date;
}

export interface TodoCreateInput {
  title: string;
  parentId?: string;
  priority?: TodoPriority;
  color?: TodoColor;
}

export interface TodoUpdateInput {
  title?: string;
  completed?: boolean;
  priority?: TodoPriority;
  color?: TodoColor;
}

export type TodoPriority = '' | '!' | '!!' | '!!!';
export type TodoColor = 'indigo' | 'violet' | 'teal' | 'amber' | 'rose' | null;
