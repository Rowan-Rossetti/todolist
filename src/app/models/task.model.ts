export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type Recurrence = 'none' | 'daily' | 'weekly' | 'monthly';
export type TaskStatus = 'todo' | 'doing' | 'done';
export type Energy = 'low' | 'medium' | 'high';

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  notes: string;
  status: TaskStatus;
  completed: boolean;
  archived: boolean;
  pinned: boolean;
  favorite: boolean;
  priority: Priority;
  energy: Energy;
  category: string;
  tags: string[];
  dueDate: string;
  dueTime: string;
  recurrence: Recurrence;
  subtasks: Subtask[];
  estimatedMinutes: number;
  actualMinutes: number;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface ActivityEntry {
  id: string;
  type: 'created' | 'completed' | 'reopened' | 'deleted' | 'focus';
  taskTitle: string;
  timestamp: string;
  detail?: string;
}

export interface AppSettings {
  theme: 'light' | 'dark';
  compact: boolean;
  dailyGoal: number;
}
