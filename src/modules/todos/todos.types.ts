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
  collapsed?: boolean;
  parentId?: string;
}

export type TodoPriority = '' | '!' | '!!' | '!!!';
export type TodoColor = 'indigo' | 'violet' | 'teal' | 'amber' | 'rose' | null;
