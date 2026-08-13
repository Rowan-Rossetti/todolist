import { CommonModule } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Priority, Recurrence, Subtask, Task, TaskStatus } from './models/task.model';
import { TaskService } from './services/task.service';

type View = 'dashboard' | 'inbox' | 'today' | 'upcoming' | 'completed' | 'archived';
type Sort = 'smart' | 'created' | 'due' | 'priority' | 'title' | 'duration';

interface TaskDraft {
  title: string;
  description: string;
  notes: string;
  priority: Priority;
  category: string;
  dueDate: string;
  recurrence: Recurrence;
  subtasks: Subtask[];
  estimatedMinutes: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  readonly store = inject(TaskService);
  readonly view = signal<View>('dashboard');
  readonly query = signal('');
  readonly category = signal('all');
  readonly priority = signal<'all' | Priority>('all');
  readonly status = signal<'all' | TaskStatus>('all');
  readonly sort = signal<Sort>('smart');
  readonly showForm = signal(false);
  readonly showSettings = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly selected = signal<Set<string>>(new Set());
  readonly toast = signal('');

  draft: TaskDraft = this.emptyDraft();
  newSubtask = '';

  readonly categories = computed(() => {
    const values = this.store.tasks().map(t => t.category.trim()).filter(Boolean);
    return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'fr'));
  });

  readonly activeTasks = computed(() => this.store.tasks().filter(t => !t.archived && !t.completed));

  readonly visibleTasks = computed(() => {
    const today = this.toDateInput(new Date());
    const sevenDate = new Date();
    sevenDate.setDate(sevenDate.getDate() + 7);
    const nextWeek = this.toDateInput(sevenDate);
    const q = this.query().trim().toLocaleLowerCase('fr');

    let tasks = this.store.tasks().filter(task => {
      const matchesSearch = !q || [task.title, task.description, task.notes, task.category, ...task.tags]
        .join(' ').toLocaleLowerCase('fr').includes(q);

      // La recherche globale parcourt toutes les tâches, y compris terminées et archivées.
      if (q) return matchesSearch;

      const matchesCategory = this.category() === 'all' || task.category === this.category();
      const matchesPriority = this.priority() === 'all' || task.priority === this.priority();
      const matchesStatus = this.status() === 'all' || task.status === this.status();
      if (!matchesCategory || !matchesPriority || !matchesStatus) return false;

      switch (this.view()) {
        case 'today': return !task.archived && !task.completed && task.dueDate === today;
        case 'upcoming': return !task.archived && !task.completed && !!task.dueDate && task.dueDate > today && task.dueDate <= nextWeek;
        case 'completed': return !task.archived && task.completed;
        case 'archived': return task.archived;
        default: return !task.archived && !task.completed;
      }
    });

    const priorities: Record<Priority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
    tasks = [...tasks].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (this.sort() === 'smart') {
        if (this.isOverdue(a) !== this.isOverdue(b)) return this.isOverdue(a) ? -1 : 1;
        if (a.status !== b.status) return a.status === 'doing' ? -1 : 1;
        if (priorities[a.priority] !== priorities[b.priority]) return priorities[b.priority] - priorities[a.priority];
        return (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31');
      }
      switch (this.sort()) {
        case 'due': return (a.dueDate || '9999-12-31').localeCompare(b.dueDate || '9999-12-31');
        case 'priority': return priorities[b.priority] - priorities[a.priority];
        case 'title': return a.title.localeCompare(b.title, 'fr');
        case 'duration': return a.estimatedMinutes - b.estimatedMinutes;
        default: return b.createdAt.localeCompare(a.createdAt);
      }
    });
    return tasks;
  });

  readonly dashboard = computed(() => {
    const all = this.store.tasks().filter(t => !t.archived);
    const today = this.toDateInput(new Date());
    const completed = all.filter(t => t.completed).length;
    const active = all.length - completed;
    const overdue = all.filter(t => !t.completed && this.isOverdue(t)).length;
    const dueToday = all.filter(t => !t.completed && t.dueDate === today).length;
    const completedToday = all.filter(t => t.completedAt?.startsWith(today)).length;
    const rate = all.length ? Math.round((completed / all.length) * 100) : 0;
    const goal = this.store.settings().dailyGoal;
    const goalRate = Math.min(100, Math.round((completedToday / goal) * 100));
    const totalEstimated = all.filter(t => !t.completed).reduce((sum, t) => sum + t.estimatedMinutes, 0);
    const focusMinutes = all.reduce((sum, t) => sum + t.actualMinutes, 0);
    return { total: all.length, completed, active, overdue, dueToday, completedToday, rate, goal, goalRate, totalEstimated, focusMinutes };
  });

  readonly priorityBreakdown = computed(() => {
    const active = this.activeTasks();
    return (['urgent', 'high', 'medium', 'low'] as Priority[]).map(priority => ({
      priority,
      count: active.filter(t => t.priority === priority).length,
      percent: active.length ? Math.round((active.filter(t => t.priority === priority).length / active.length) * 100) : 0
    }));
  });

  readonly upcomingPreview = computed(() => {
    return [...this.activeTasks()]
      .filter(t => t.dueDate)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 5);
  });



  @HostListener('window:keydown', ['$event'])
  handleShortcut(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.tagName === 'SELECT';
    if (typing || this.showForm() || this.showSettings()) return;
    if (event.key.toLowerCase() === 'n') { event.preventDefault(); this.openCreate(); }
    if (event.key === '/') { event.preventDefault(); document.querySelector<HTMLInputElement>('.global-search')?.focus(); }
  }

  updateGlobalSearch(value: string): void {
    this.query.set(value);
    this.selected.set(new Set());
    if (value.trim()) {
      this.category.set('all');
      this.priority.set('all');
      this.status.set('all');
      if (this.view() === 'dashboard') this.view.set('inbox');
    }
  }

  clearGlobalSearch(): void {
    this.query.set('');
  }

  setView(view: View): void {
    this.view.set(view);
    this.selected.set(new Set());
  }

  openCreate(): void {
    this.editingId.set(null);
    this.draft = this.emptyDraft();
    this.newSubtask = '';
    this.showForm.set(true);
  }

  openEdit(task: Task): void {
    this.editingId.set(task.id);
    this.draft = {
      title: task.title,
      description: task.description,
      notes: task.notes,
      priority: task.priority,
      category: task.category,
      dueDate: task.dueDate,
      recurrence: task.recurrence,
      subtasks: task.subtasks.map(s => ({ ...s })),
      estimatedMinutes: task.estimatedMinutes
    };
    this.newSubtask = '';
    this.showForm.set(true);
  }

  saveTask(): void {
    const title = this.draft.title.trim();
    if (!title) {
      this.notify('Ajoute un titre à la tâche.');
      return;
    }

    const payload = {
      title,
      description: this.draft.description.trim(),
      notes: this.draft.notes.trim(),
      priority: this.draft.priority,
      category: this.draft.category.trim(),
      dueDate: this.draft.dueDate,
      recurrence: this.draft.recurrence,
      subtasks: this.draft.subtasks,
      estimatedMinutes: Math.max(0, Number(this.draft.estimatedMinutes) || 0)
    };

    const id = this.editingId();
    if (id) {
      const existing = this.store.tasks().find(t => t.id === id);
      if (existing) {
        this.store.update(id, {
          ...payload,
          status: existing.status,
          completed: existing.completed,
          completedAt: existing.completedAt,
          energy: existing.energy,
          tags: existing.tags,
          dueTime: ''
        });
      }
      this.notify('Tâche modifiée.');
    } else {
      this.store.create({
        ...payload,
        status: 'todo', completed: false, archived: false, pinned: false, favorite: false,
        energy: 'medium', tags: [], dueTime: '', actualMinutes: 0
      });
      this.notify('Tâche créée.');
    }
    this.showForm.set(false);
  }

  addSubtask(): void {
    const title = this.newSubtask.trim();
    if (!title) return;
    this.draft.subtasks = [...this.draft.subtasks, { id: crypto.randomUUID(), title, completed: false }];
    this.newSubtask = '';
  }

  removeDraftSubtask(id: string): void {
    this.draft.subtasks = this.draft.subtasks.filter(s => s.id !== id);
  }

  progress(task: Task): number {
    if (!task.subtasks.length) return task.completed ? 100 : 0;
    return Math.round((task.subtasks.filter(s => s.completed).length / task.subtasks.length) * 100);
  }

  isOverdue(task: Task): boolean {
    if (!task.dueDate || task.completed) return false;
    const deadline = new Date(`${task.dueDate}T${task.dueTime || '23:59'}:00`);
    return deadline.getTime() < Date.now();
  }

  dateLabel(task: Task): string {
    if (!task.dueDate) return 'Sans échéance';
    const today = this.toDateInput(new Date());
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = this.toDateInput(tomorrowDate);
    if (task.dueDate === today) return `Aujourd’hui${task.dueTime ? ' à ' + task.dueTime : ''}`;
    if (task.dueDate === tomorrow) return `Demain${task.dueTime ? ' à ' + task.dueTime : ''}`;
    const parsed = new Date(`${task.dueDate}T12:00:00`);
    return new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed) + (task.dueTime ? ` à ${task.dueTime}` : '');
  }

  priorityLabel(priority: Priority): string {
    return ({ low: 'Basse', medium: 'Moyenne', high: 'Haute', urgent: 'Urgente' })[priority];
  }


  recurrenceLabel(value: Recurrence): string {
    return ({ none: 'Aucune', daily: 'Chaque jour', weekly: 'Chaque semaine', monthly: 'Chaque mois' })[value];
  }

  statusLabel(status: TaskStatus): string {
    return ({ todo: 'À faire', doing: 'En cours', done: 'Terminée' })[status];
  }

  durationLabel(minutes: number): string {
    if (!minutes) return '';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
  }


  toggleSelected(id: string): void {
    const next = new Set(this.selected());
    next.has(id) ? next.delete(id) : next.add(id);
    this.selected.set(next);
  }

  selectAllVisible(): void {
    const all = this.visibleTasks().map(t => t.id);
    const every = all.length > 0 && all.every(id => this.selected().has(id));
    this.selected.set(every ? new Set() : new Set(all));
  }

  bulkComplete(): void {
    const ids = [...this.selected()];
    if (!ids.length) return;
    this.store.bulkComplete(ids);
    this.selected.set(new Set());
    this.notify(`${ids.length} tâche(s) terminée(s).`);
  }

  bulkDelete(): void {
    const ids = [...this.selected()];
    if (!ids.length || !confirm(`Supprimer ${ids.length} tâche(s) ?`)) return;
    this.store.bulkDelete(ids);
    this.selected.set(new Set());
    this.notify(`${ids.length} tâche(s) supprimée(s).`);
  }

  deleteTask(task: Task): void {
    if (!confirm(`Supprimer « ${task.title} » ?`)) return;
    this.store.remove(task.id);
    this.notify('Tâche supprimée.');
  }

  toggleArchive(task: Task): void {
    this.store.update(task.id, { archived: !task.archived });
    this.notify(task.archived ? 'Tâche restaurée.' : 'Tâche archivée.');
  }


  clearCompleted(): void {
    if (!this.store.completedCount() || !confirm('Supprimer définitivement toutes les tâches terminées ?')) return;
    this.store.clearCompleted();
    this.notify('Tâches terminées supprimées.');
  }

  resetFilters(): void {
    this.query.set('');
    this.category.set('all');
    this.priority.set('all');
    this.status.set('all');
    this.sort.set('smart');
  }


  private notify(message: string): void {
    this.toast.set(message);
    window.setTimeout(() => {
      if (this.toast() === message) this.toast.set('');
    }, 2600);
  }

  private emptyDraft(): TaskDraft {
    return {
      title: '', description: '', notes: '', priority: 'medium', category: '',
      dueDate: '', recurrence: 'none', subtasks: [], estimatedMinutes: 30
    };
  }

  private toDateInput(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
}
