export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export type TaskStatus = 'todo' | 'doing' | 'done';

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  status: TaskStatus;
  subtasks: Subtask[];
  createdAt: string;
  updatedAt: string;
}
