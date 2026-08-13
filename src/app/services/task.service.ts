import { Injectable, computed, effect, signal } from '@angular/core';
import { ActivityEntry, AppSettings, Recurrence, Task, TaskStatus } from '../models/task.model';

const TASKS_KEY = 'taskflow.tasks.v2';
const LEGACY_TASKS_KEY = 'taskflow.tasks.v1';
const SETTINGS_KEY = 'taskflow.settings.v2';
const LEGACY_SETTINGS_KEY = 'taskflow.settings.v1';
const ACTIVITY_KEY = 'taskflow.activity.v2';

@Injectable({ providedIn: 'root' })
export class TaskService {
  readonly tasks = signal<Task[]>(this.readTasks());
  readonly settings = signal<AppSettings>(this.readSettings());
  readonly activity = signal<ActivityEntry[]>(this.readActivity());

  readonly activeCount = computed(() => this.tasks().filter(t => !t.completed && !t.archived).length);
  readonly completedCount = computed(() => this.tasks().filter(t => t.completed && !t.archived).length);
  readonly archivedCount = computed(() => this.tasks().filter(t => t.archived).length);

  constructor() {
    effect(() => localStorage.setItem(TASKS_KEY, JSON.stringify(this.tasks())));
    effect(() => localStorage.setItem(ACTIVITY_KEY, JSON.stringify(this.activity().slice(0, 80))));
    effect(() => {
      const settings = this.settings();
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      document.documentElement.dataset['theme'] = settings.theme;
      document.documentElement.dataset['compact'] = 'false';
    });
  }

  create(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'completedAt'>): string {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const newTask: Task = { ...task, id, createdAt: now, updatedAt: now, completedAt: task.completed ? now : null };
    this.tasks.update(tasks => [newTask, ...tasks]);
    this.log('created', newTask.title);
    return id;
  }

  update(id: string, patch: Partial<Task>): void {
    this.tasks.update(tasks => tasks.map(t => t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t));
  }

  setStatus(id: string, status: TaskStatus): void {
    const task = this.tasks().find(t => t.id === id);
    if (!task) return;
    const completed = status === 'done';
    const wasCompleted = task.completed;
    this.update(id, { status, completed, completedAt: completed ? new Date().toISOString() : null });
    if (!wasCompleted && completed) {
      this.log('completed', task.title);
      if (task.recurrence !== 'none' && task.dueDate) this.createRecurringCopy(task);
    } else if (wasCompleted && !completed) {
      this.log('reopened', task.title);
    }
  }

  toggleComplete(id: string): void {
    const task = this.tasks().find(t => t.id === id);
    if (!task) return;
    this.setStatus(id, task.completed ? 'todo' : 'done');
  }

  toggleSubtask(taskId: string, subtaskId: string): void {
    const task = this.tasks().find(t => t.id === taskId);
    if (!task) return;
    const subtasks = task.subtasks.map(s => s.id === subtaskId ? { ...s, completed: !s.completed } : s);
    this.update(taskId, { subtasks });
  }

  remove(id: string): void {
    const task = this.tasks().find(t => t.id === id);
    if (task) this.log('deleted', task.title);
    this.tasks.update(tasks => tasks.filter(t => t.id !== id));
  }

  duplicate(id: string): void {
    const task = this.tasks().find(t => t.id === id);
    if (!task) return;
    this.create({
      ...task,
      title: `${task.title} - copie`,
      status: 'todo',
      completed: false,
      archived: false,
      pinned: false,
      favorite: false,
      subtasks: task.subtasks.map(s => ({ ...s, id: crypto.randomUUID(), completed: false }))
    });
  }


  bulkComplete(ids: string[]): void {
    ids.forEach(id => this.setStatus(id, 'done'));
  }

  bulkDelete(ids: string[]): void {
    ids.forEach(id => this.remove(id));
  }

  clearCompleted(): void {
    this.tasks.update(tasks => tasks.filter(t => !t.completed));
  }

  toggleTheme(): void {
    this.settings.update(s => ({ ...s, theme: s.theme === 'light' ? 'dark' : 'light' }));
  }


  setDailyGoal(value: number): void {
    this.settings.update(s => ({ ...s, dailyGoal: Math.max(1, Math.min(20, Math.round(value || 1))) }));
  }


  private createRecurringCopy(task: Task): void {
    const date = new Date(`${task.dueDate}T12:00:00`);
    const recurrence: Recurrence = task.recurrence;
    if (recurrence === 'daily') date.setDate(date.getDate() + 1);
    if (recurrence === 'weekly') date.setDate(date.getDate() + 7);
    if (recurrence === 'monthly') date.setMonth(date.getMonth() + 1);
    const dueDate = this.toDateInput(date);
    this.create({
      title: task.title,
      description: task.description,
      notes: task.notes,
      status: 'todo',
      completed: false,
      archived: false,
      pinned: task.pinned,
      favorite: task.favorite,
      priority: task.priority,
      energy: task.energy,
      category: task.category,
      tags: [...task.tags],
      dueDate,
      dueTime: '',
      recurrence: task.recurrence,
      subtasks: task.subtasks.map(s => ({ ...s, id: crypto.randomUUID(), completed: false })),
      estimatedMinutes: task.estimatedMinutes,
      actualMinutes: 0
    });
  }

  private log(type: ActivityEntry['type'], taskTitle: string, detail?: string): void {
    const entry: ActivityEntry = { id: crypto.randomUUID(), type, taskTitle, timestamp: new Date().toISOString(), detail };
    this.activity.update(items => [entry, ...items].slice(0, 80));
  }

  private normalizeTask(value: unknown): Task {
    const raw = (value ?? {}) as Partial<Task>;
    const now = new Date().toISOString();
    const completed = Boolean(raw.completed);
    return {
      id: raw.id || crypto.randomUUID(),
      title: String(raw.title || 'Sans titre'),
      description: String(raw.description || ''),
      notes: String(raw.notes || ''),
      status: raw.status ?? (completed ? 'done' : 'todo'),
      completed,
      archived: Boolean(raw.archived),
      pinned: Boolean(raw.pinned),
      favorite: Boolean(raw.favorite),
      priority: raw.priority ?? 'medium',
      energy: raw.energy ?? 'medium',
      category: String(raw.category || ''),
      tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
      dueDate: String(raw.dueDate || ''),
      dueTime: '',
      recurrence: raw.recurrence ?? 'none',
      subtasks: Array.isArray(raw.subtasks) ? raw.subtasks.map(s => ({ id: s.id || crypto.randomUUID(), title: String(s.title || ''), completed: Boolean(s.completed) })) : [],
      estimatedMinutes: Number(raw.estimatedMinutes) || 0,
      actualMinutes: Number(raw.actualMinutes) || 0,
      createdAt: raw.createdAt || now,
      updatedAt: raw.updatedAt || now,
      completedAt: raw.completedAt || (completed ? now : null)
    };
  }

  private readTasks(): Task[] {
    try {
      const raw = localStorage.getItem(TASKS_KEY) ?? localStorage.getItem(LEGACY_TASKS_KEY) ?? '[]';
      const parsed = JSON.parse(raw) as unknown[];
      return Array.isArray(parsed) ? parsed.map(task => this.normalizeTask(task)) : [];
    } catch {
      return [];
    }
  }

  private readSettings(): AppSettings {
    try {
      const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? localStorage.getItem(LEGACY_SETTINGS_KEY) ?? '{}') as Partial<AppSettings>;
      return { theme: raw.theme === 'dark' ? 'dark' : 'light', compact: false, dailyGoal: Number(raw.dailyGoal) || 5 };
    } catch {
      return { theme: 'light', compact: false, dailyGoal: 5 };
    }
  }

  private readActivity(): ActivityEntry[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(ACTIVITY_KEY) ?? '[]') as ActivityEntry[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private toDateInput(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
