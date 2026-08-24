import { Injectable, effect, signal } from '@angular/core';
import { Subtask, Task, TaskStatus } from '../models/task.model';

export interface HistoryEntry {
  id: string;
  action: 'created' | 'updated' | 'completed' | 'reopened' | 'deleted' | 'imported' | 'cleared';
  taskTitle: string;
  date: string;
}

const STORAGE_KEY = 'taskflow.tasks.simple';
const HISTORY_KEY = 'taskflow.history.simple';
const OLD_KEYS = ['taskflow.tasks.v2', 'taskflow.tasks.v1'];

@Injectable({ providedIn: 'root' })
export class TaskService {
  readonly tasks = signal<Task[]>(this.readTasks());
  readonly history = signal<HistoryEntry[]>(this.readHistory());

  constructor() {
    effect(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasks())));
    effect(() => localStorage.setItem(HISTORY_KEY, JSON.stringify(this.history())));
  }

  create(title: string, subtasks: Subtask[]): void {
    const now = new Date().toISOString();
    this.tasks.update(tasks => [{
      id: crypto.randomUUID(),
      title,
      completed: false,
      status: 'todo',
      subtasks,
      createdAt: now,
      updatedAt: now
    }, ...tasks]);
    this.record('created', title);
  }

  update(id: string, title: string, subtasks: Subtask[]): void {
    const task = this.tasks().find(item => item.id === id);
    if (!task) return;

    const allSubtasksDone = subtasks.length > 0 && subtasks.every(subtask => subtask.completed);
    const status: TaskStatus = allSubtasksDone
      ? 'done'
      : (subtasks.length > 0 && task.status === 'done' ? 'doing' : task.status);

    this.tasks.update(tasks => tasks.map(item => item.id === id ? {
      ...item,
      title,
      subtasks,
      status,
      completed: status === 'done',
      updatedAt: new Date().toISOString()
    } : item));
    this.record('updated', title);
  }

  toggleTask(id: string): void {
    const task = this.tasks().find(item => item.id === id);
    if (!task) return;
    const status: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    this.tasks.update(tasks => tasks.map(item => item.id === id ? {
      ...item,
      status,
      completed: status === 'done',
      subtasks: status === 'done'
        ? item.subtasks.map(subtask => ({ ...subtask, completed: true }))
        : item.subtasks,
      updatedAt: new Date().toISOString()
    } : item));
    this.record(status === 'done' ? 'completed' : 'reopened', task.title);
  }

  toggleSubtask(taskId: string, subtaskId: string): void {
    const task = this.tasks().find(item => item.id === taskId);
    if (!task) return;

    let becameDone = false;
    let reopened = false;

    this.tasks.update(tasks => tasks.map(item => {
      if (item.id !== taskId) return item;

      const subtasks = item.subtasks.map(subtask => subtask.id === subtaskId
        ? { ...subtask, completed: !subtask.completed }
        : subtask);

      const allDone = subtasks.length > 0 && subtasks.every(subtask => subtask.completed);
      let status = item.status;

      if (allDone) {
        becameDone = item.status !== 'done';
        status = 'done';
      } else if (item.status === 'done') {
        reopened = true;
        status = 'doing';
      } else if (subtasks.some(subtask => subtask.completed) && item.status === 'todo') {
        status = 'doing';
      }

      return {
        ...item,
        subtasks,
        status,
        completed: status === 'done',
        updatedAt: new Date().toISOString()
      };
    }));

    if (becameDone) this.record('completed', task.title);
    else if (reopened) this.record('reopened', task.title);
  }

  moveTask(id: string, targetStatus: TaskStatus): boolean {
    const task = this.tasks().find(item => item.id === id);
    if (!task || task.status === targetStatus) return true;

    const allSubtasksDone = task.subtasks.length > 0 && task.subtasks.every(subtask => subtask.completed);
    if (targetStatus !== 'done' && allSubtasksDone) return false;

    this.tasks.update(tasks => tasks.map(item => item.id === id ? {
      ...item,
      status: targetStatus,
      completed: targetStatus === 'done',
      subtasks: targetStatus === 'done'
        ? item.subtasks.map(subtask => ({ ...subtask, completed: true }))
        : item.subtasks,
      updatedAt: new Date().toISOString()
    } : item));

    if (targetStatus === 'done') this.record('completed', task.title);
    else if (task.status === 'done') this.record('reopened', task.title);
    else this.record('updated', task.title);
    return true;
  }

  remove(id: string): void {
    const task = this.tasks().find(item => item.id === id);
    if (!task) return;
    this.tasks.update(tasks => tasks.filter(item => item.id !== id));
    this.record('deleted', task.title);
  }

  clearCompleted(): number {
    const completed = this.tasks().filter(task => task.status === 'done');
    if (!completed.length) return 0;
    this.tasks.update(tasks => tasks.filter(task => task.status !== 'done'));
    this.record('cleared', `${completed.length} tâche(s) terminée(s)`);
    return completed.length;
  }

  replaceTasks(tasks: Task[]): void {
    const normalized = tasks.map(task => this.normalizeTask(task));
    this.tasks.set(normalized);
    this.record('imported', `${normalized.length} tâche(s)`);
  }

  clearHistory(): void {
    this.history.set([]);
  }

  private record(action: HistoryEntry['action'], taskTitle: string): void {
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      action,
      taskTitle,
      date: new Date().toISOString()
    };
    this.history.update(items => [entry, ...items].slice(0, 100));
  }

  private readTasks(): Task[] {
    try {
      let raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        for (const key of OLD_KEYS) {
          raw = localStorage.getItem(key);
          if (raw) break;
        }
      }
      const parsed = JSON.parse(raw ?? '[]') as unknown[];
      return Array.isArray(parsed) ? parsed.map(value => this.normalizeTask(value)) : [];
    } catch {
      return [];
    }
  }

  private readHistory(): HistoryEntry[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as HistoryEntry[];
      return Array.isArray(parsed) ? parsed.slice(0, 100) : [];
    } catch {
      return [];
    }
  }

  private normalizeTask(value: unknown): Task {
    const raw = (value ?? {}) as Partial<Task> & { subtasks?: unknown[] };
    const now = new Date().toISOString();
    const subtasks = Array.isArray(raw.subtasks)
      ? raw.subtasks.map(item => {
          const subtask = (item ?? {}) as Partial<Subtask>;
          return {
            id: subtask.id || crypto.randomUUID(),
            title: String(subtask.title || 'Sous-tâche'),
            completed: Boolean(subtask.completed)
          };
        })
      : [];

    const allSubtasksDone = subtasks.length > 0 && subtasks.every(subtask => subtask.completed);
    const rawStatus = raw.status;
    const status: TaskStatus = allSubtasksDone
      ? 'done'
      : rawStatus === 'doing' || rawStatus === 'done' || rawStatus === 'todo'
        ? rawStatus
        : raw.completed ? 'done' : 'todo';

    return {
      id: raw.id || crypto.randomUUID(),
      title: String(raw.title || 'Sans titre'),
      completed: status === 'done',
      status,
      subtasks,
      createdAt: raw.createdAt || now,
      updatedAt: raw.updatedAt || now
    };
  }
}
