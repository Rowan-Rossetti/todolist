import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Subtask, Task, TaskStatus } from './models/task.model';
import { HistoryEntry, TaskService } from './services/task.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  readonly store = inject(TaskService);
  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly toast = signal('');
  readonly currentPage = signal<'dashboard' | 'tasks' | 'tools'>('tasks');
  readonly darkMode = signal(localStorage.getItem('taskflow.darkMode') === 'true');
  readonly draggingTaskId = signal<string | null>(null);
  readonly dragOverStatus = signal<TaskStatus | null>(null);

  title = '';
  subtasks: Subtask[] = [];
  newSubtask = '';

  readonly total = computed(() => this.store.tasks().length);
  readonly completed = computed(() => this.store.tasks().filter(task => task.completed).length);
  readonly remaining = computed(() => this.total() - this.completed());
  readonly progress = computed(() => this.total() ? Math.round((this.completed() / this.total()) * 100) : 0);
  readonly pieStyle = computed(() => `conic-gradient(var(--accent) 0 ${this.progress()}%, var(--track) ${this.progress()}% 100%)`);
  readonly subtaskTotal = computed(() => this.store.tasks().reduce((sum, task) => sum + task.subtasks.length, 0));
  readonly subtaskCompleted = computed(() => this.store.tasks().reduce((sum, task) => sum + task.subtasks.filter(subtask => subtask.completed).length, 0));
  readonly recentHistory = computed(() => this.store.history().slice(0, 8));
  readonly todoTasks = computed(() => this.store.tasks().filter(task => task.status === 'todo'));
  readonly doingTasks = computed(() => this.store.tasks().filter(task => task.status === 'doing'));
  readonly doneTasks = computed(() => this.store.tasks().filter(task => task.status === 'done'));


  dragStart(event: DragEvent, task: Task): void {
    this.draggingTaskId.set(task.id);
    event.dataTransfer?.setData('text/plain', task.id);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
  }

  dragEnd(): void {
    this.draggingTaskId.set(null);
    this.dragOverStatus.set(null);
  }

  dragOver(event: DragEvent, status: TaskStatus): void {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    this.dragOverStatus.set(status);
  }

  dragLeave(event: DragEvent, status: TaskStatus): void {
    const current = event.currentTarget as HTMLElement | null;
    const related = event.relatedTarget as Node | null;
    if (current && related && current.contains(related)) return;
    if (this.dragOverStatus() === status) this.dragOverStatus.set(null);
  }

  dropTask(event: DragEvent, status: TaskStatus): void {
    event.preventDefault();
    const id = event.dataTransfer?.getData('text/plain') || this.draggingTaskId();
    this.dragOverStatus.set(null);
    this.draggingTaskId.set(null);
    if (!id) return;

    const moved = this.store.moveTask(id, status);
    if (!moved) {
      this.notify('Toutes les sous-tâches sont terminées : la tâche doit rester dans Fini.');
      return;
    }
    this.notify(status === 'todo' ? 'Tâche déplacée dans À faire.' : status === 'doing' ? 'Tâche déplacée dans En cours.' : 'Tâche déplacée dans Fini.');
  }

  setPage(page: 'dashboard' | 'tasks' | 'tools'): void {
    this.currentPage.set(page);
  }

  toggleDarkMode(): void {
    const value = !this.darkMode();
    this.darkMode.set(value);
    localStorage.setItem('taskflow.darkMode', String(value));
  }

  historyLabel(entry: HistoryEntry): string {
    const labels: Record<HistoryEntry['action'], string> = {
      created: 'Tâche ajoutée',
      updated: 'Tâche modifiée',
      completed: 'Tâche terminée',
      reopened: 'Tâche réouverte',
      deleted: 'Tâche supprimée',
      imported: 'Sauvegarde restaurée',
      cleared: 'Tâches terminées supprimées'
    };
    return labels[entry.action];
  }

  formatHistoryDate(value: string): string {
    return new Intl.DateTimeFormat('fr-BE', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  }

  exportBackup(): void {
    const data = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), tasks: this.store.tasks() }, null, 2);
    this.downloadBlob(new Blob([data], { type: 'application/json;charset=utf-8' }), 'todo-sauvegarde.json');
    this.notify('Sauvegarde téléchargée.');
  }

  importBackup(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result ?? ''));
        const tasks = Array.isArray(parsed) ? parsed : parsed?.tasks;
        if (!Array.isArray(tasks)) throw new Error('invalid');
        if (!confirm('Remplacer les tâches actuelles par celles de cette sauvegarde ?')) return;
        this.store.replaceTasks(tasks);
        this.notify('Sauvegarde restaurée.');
      } catch {
        this.notify('Fichier de sauvegarde invalide.');
      } finally {
        input.value = '';
      }
    };
    reader.readAsText(file);
  }

  clearCompletedTasks(): void {
    if (!this.completed()) {
      this.notify('Aucune tâche terminée à supprimer.');
      return;
    }
    if (!confirm(`Supprimer les ${this.completed()} tâche(s) terminée(s) ?`)) return;
    const count = this.store.clearCompleted();
    this.notify(`${count} tâche(s) supprimée(s).`);
  }

  clearHistory(): void {
    if (!this.store.history().length) return;
    if (!confirm('Effacer tout l’historique ?')) return;
    this.store.clearHistory();
    this.notify('Historique effacé.');
  }

  openCreate(): void {
    this.editingId.set(null);
    this.title = '';
    this.subtasks = [];
    this.newSubtask = '';
    this.showForm.set(true);
  }

  openEdit(task: Task): void {
    this.editingId.set(task.id);
    this.title = task.title;
    this.subtasks = task.subtasks.map(subtask => ({ ...subtask }));
    this.newSubtask = '';
    this.showForm.set(true);
  }

  closeForm(): void {
    this.showForm.set(false);
  }

  addSubtask(): void {
    const title = this.newSubtask.trim();
    if (!title) return;
    this.subtasks = [...this.subtasks, { id: crypto.randomUUID(), title, completed: false }];
    this.newSubtask = '';
  }

  removeDraftSubtask(id: string): void {
    this.subtasks = this.subtasks.filter(subtask => subtask.id !== id);
  }

  saveTask(): void {
    const title = this.title.trim();
    if (!title) {
      this.notify('Ajoute un titre à la tâche.');
      return;
    }

    const id = this.editingId();
    if (id) {
      this.store.update(id, title, this.subtasks);
      this.notify('Tâche modifiée.');
    } else {
      this.store.create(title, this.subtasks);
      this.notify('Tâche ajoutée.');
    }
    this.showForm.set(false);
  }

  deleteTask(task: Task): void {
    if (!confirm(`Supprimer « ${task.title} » ?`)) return;
    this.store.remove(task.id);
    this.notify('Tâche supprimée.');
  }

  printTodo(): void {
    const tasks = this.store.tasks();
    if (!tasks.length) {
      this.notify('Aucune tâche à imprimer.');
      return;
    }

    const popup = window.open('', '_blank', 'width=900,height=700');
    if (!popup) {
      this.notify('Le navigateur a bloqué la fenêtre d’impression.');
      return;
    }

    popup.document.open();
    popup.document.write(this.exportHtml(tasks));
    popup.document.close();
    popup.focus();
    popup.onload = () => {
      popup.print();
      popup.close();
    };
  }

  exportTodoPdf(): void {
    const tasks = this.store.tasks();
    if (!tasks.length) {
      this.notify('Aucune tâche à exporter.');
      return;
    }

    const pdf = this.createSimplePdf(this.exportTextLines(tasks));
    const buffer = new ArrayBuffer(pdf.byteLength);
    new Uint8Array(buffer).set(pdf);
    this.downloadBlob(new Blob([buffer], { type: 'application/pdf' }), 'todo.pdf');
    this.notify('PDF téléchargé.');
  }

  exportTodoWord(): void {
    const tasks = this.store.tasks();
    if (!tasks.length) {
      this.notify('Aucune tâche à exporter.');
      return;
    }

    const blob = new Blob(['\ufeff', this.exportHtml(tasks)], { type: 'application/msword;charset=utf-8' });
    this.downloadBlob(blob, 'todo.doc');
    this.notify('Document Word téléchargé.');
  }

  private exportHtml(tasks: Task[]): string {
    const items = tasks.map(task => {
      const subtasks = task.subtasks.length
        ? `<ul>${task.subtasks.map(subtask => `<li>${subtask.completed ? '&#9745;' : '&#9744;'} ${this.escapeHtml(subtask.title)}</li>`).join('')}</ul>`
        : '';
      return `<li>${task.completed ? '&#9745;' : '&#9744;'} ${this.escapeHtml(task.title)}${subtasks}</li>`;
    }).join('');

    return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Todo</title><style>@page{margin:18mm}body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:12pt}ul{padding-left:24px}li{margin:0 0 10px;line-height:1.45}li ul{margin-top:6px}li ul li{margin:4px 0}</style></head><body><ul>${items}</ul></body></html>`;
  }

  private exportTextLines(tasks: Task[]): string[] {
    const lines: string[] = [];
    for (const task of tasks) {
      lines.push(`${task.completed ? '[x]' : '[ ]'} ${task.title}`);
      for (const subtask of task.subtasks) {
        lines.push(`    ${subtask.completed ? '[x]' : '[ ]'} ${subtask.title}`);
      }
      lines.push('');
    }
    return lines;
  }

  private createSimplePdf(sourceLines: string[]): Uint8Array {
    const pageWidth = 595.28;
    const pageHeight = 841.89;
    const left = 52;
    const top = 58;
    const bottom = 52;
    const fontSize = 12;
    const lineHeight = 18;
    const maxChars = 78;
    const wrapped: string[] = [];

    sourceLines.forEach(line => {
      if (!line) {
        wrapped.push('');
        return;
      }
      const indent = line.match(/^\s*/)?.[0] ?? '';
      const words = line.trimStart().split(/\s+/);
      let current = indent;
      words.forEach(word => {
        if ((current.trim() ? current.length + 1 : current.length) + word.length > maxChars) {
          wrapped.push(current.trimEnd());
          current = indent + word;
        } else {
          current += (current.trim() ? ' ' : '') + word;
        }
      });
      wrapped.push(current.trimEnd());
    });

    const linesPerPage = Math.max(1, Math.floor((pageHeight - top - bottom) / lineHeight));
    const pages: string[][] = [];
    for (let i = 0; i < wrapped.length; i += linesPerPage) pages.push(wrapped.slice(i, i + linesPerPage));
    if (!pages.length) pages.push(['']);

    const objects: string[] = [];
    const addObject = (body: string): number => { objects.push(body); return objects.length; };
    const catalogId = addObject('');
    const pagesId = addObject('');
    const fontId = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const pageIds: number[] = [];

    pages.forEach(pageLines => {
      let stream = `BT\n/F1 ${fontSize} Tf\n${left} ${pageHeight - top} Td\n`;
      pageLines.forEach((line, index) => {
        if (index > 0) stream += `0 -${lineHeight} Td\n`;
        stream += `(${this.escapePdfText(line)}) Tj\n`;
      });
      stream += 'ET';
      const streamBytes = this.toLatin1Bytes(stream);
      const contentId = addObject(`<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream`);
      const pageId = addObject(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`);
      pageIds.push(pageId);
    });

    objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId - 1] = `<< /Type /Pages /Kids [${pageIds.map(id => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`;

    const chunks: Uint8Array[] = [this.toLatin1Bytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')];
    const offsets: number[] = [0];
    let length = chunks[0].length;

    objects.forEach((body, index) => {
      offsets[index + 1] = length;
      const chunk = this.toLatin1Bytes(`${index + 1} 0 obj\n${body}\nendobj\n`);
      chunks.push(chunk);
      length += chunk.length;
    });

    const xrefOffset = length;
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i++) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    const xrefBytes = this.toLatin1Bytes(xref);
    chunks.push(xrefBytes);

    const output = new Uint8Array(length + xrefBytes.length);
    let position = 0;
    chunks.forEach(chunk => { output.set(chunk, position); position += chunk.length; });
    return output;
  }

  private escapePdfText(value: string): string {
    return value
      .replace(/[^\x00-\xFF]/g, char => ({ '’': "'", '‘': "'", '“': '"', '”': '"', '–': '-', '—': '-', '…': '...' }[char] ?? '?'))
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');
  }

  private toLatin1Bytes(value: string): Uint8Array {
    const bytes = new Uint8Array(value.length);
    for (let i = 0; i < value.length; i++) bytes[i] = value.charCodeAt(i) & 0xff;
    return bytes;
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char] ?? char));
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  private notify(message: string): void {
    this.toast.set(message);
    window.setTimeout(() => {
      if (this.toast() === message) this.toast.set('');
    }, 2200);
  }
}
