import { computed, ref, watch } from 'vue'
import type { Category, Priority, Task } from '@/types'

const STORAGE_KEY = 'focus-tasks-v2'
const CATEGORY_KEY = 'focus-categories-v1'
const dateKey = (date = new Date()) => date.toISOString().slice(0, 10)

const daysAgo = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString() }
const defaultCategories: Category[] = [
  { id: 'work', name: 'Travail', color: '#7c6df2', icon: 'BriefcaseBusiness' },
  { id: 'personal', name: 'Personnel', color: '#e783bd', icon: 'Sparkles' },
  { id: 'health', name: 'Santé', color: '#58c7a5', icon: 'HeartPulse' },
  { id: 'learning', name: 'Apprentissage', color: '#f0a65a', icon: 'BookOpen' },
]

function load<T>(key: string, fallback: T): T { try { const value = localStorage.getItem(key); return value ? JSON.parse(value) : fallback } catch { return fallback } }

export function useTasks() {
  const tasks = ref<Task[]>(load(STORAGE_KEY, []))
  const categories = ref<Category[]>(load(CATEGORY_KEY, defaultCategories))
  const query = ref('')
  const filter = ref<'all' | 'today' | 'upcoming' | 'overdue' | 'starred' | 'done'>('all')
  const categoryFilter = ref('all')
  const priorityFilter = ref<'all' | Priority>('all')
  const sortBy = ref<'newest' | 'due' | 'priority' | 'alphabetical'>('newest')

  watch(tasks, value => localStorage.setItem(STORAGE_KEY, JSON.stringify(value)), { deep: true })
  watch(categories, value => localStorage.setItem(CATEGORY_KEY, JSON.stringify(value)), { deep: true })

  const filteredTasks = computed(() => {
    const rank = { high: 3, medium: 2, low: 1 }
    return tasks.value.filter(task => {
      const haystack = `${task.title} ${task.description} ${task.tags.join(' ')}`.toLowerCase()
      if (query.value && !haystack.includes(query.value.toLowerCase())) return false
      if (categoryFilter.value !== 'all' && task.category !== categoryFilter.value) return false
      if (priorityFilter.value !== 'all' && task.priority !== priorityFilter.value) return false
      if (filter.value === 'today' && task.dueDate !== dateKey()) return false
      if (filter.value === 'upcoming' && (!task.dueDate || task.dueDate <= dateKey() || task.status === 'done')) return false
      if (filter.value === 'overdue' && (!task.dueDate || task.dueDate >= dateKey() || task.status === 'done')) return false
      if (filter.value === 'starred' && !task.starred) return false
      if (filter.value === 'done' && task.status !== 'done') return false
      if (filter.value !== 'done' && task.status === 'done') return false
      return true
    }).sort((a, b) => {
      if (sortBy.value === 'due') return (a.dueDate || '9999').localeCompare(b.dueDate || '9999')
      if (sortBy.value === 'priority') return rank[b.priority] - rank[a.priority]
      if (sortBy.value === 'alphabetical') return a.title.localeCompare(b.title, 'fr')
      return b.createdAt.localeCompare(a.createdAt)
    })
  })

  const stats = computed(() => {
    const total = tasks.value.length
    const done = tasks.value.filter(t => t.status === 'done').length
    const today = tasks.value.filter(t => t.dueDate === dateKey() && t.status === 'todo').length
    const overdue = tasks.value.filter(t => t.dueDate && t.dueDate < dateKey() && t.status === 'todo').length
    const high = tasks.value.filter(t => t.priority === 'high' && t.status === 'todo').length
    return { total, done, open: total - done, today, overdue, high, progress: total ? Math.round(done / total * 100) : 0 }
  })

  const weeklyActivity = computed(() => Array.from({ length: 7 }, (_, index) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - index)); const key = dateKey(d)
    return { key, label: new Intl.DateTimeFormat('fr-BE', { weekday: 'short' }).format(d).replace('.', ''), count: tasks.value.filter(t => t.completedAt?.slice(0, 10) === key).length }
  }))
  const chartMax = computed(() => Math.max(1, ...weeklyActivity.value.map(d => d.count)))
  const categoryStats = computed(() => categories.value.map(c => ({ ...c, count: tasks.value.filter(t => t.category === c.id).length })).filter(c => c.count > 0))

  function addTask(data: Omit<Task, 'id' | 'createdAt' | 'status' | 'starred'>) { tasks.value.unshift({ ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString(), status: 'todo', starred: false }) }
  function updateTask(task: Task) { const index = tasks.value.findIndex(t => t.id === task.id); if (index !== -1) tasks.value[index] = structuredClone(task) }
  function toggleTask(id: string) { const task = tasks.value.find(t => t.id === id); if (!task) return; task.status = task.status === 'done' ? 'todo' : 'done'; task.completedAt = task.status === 'done' ? new Date().toISOString() : undefined }
  function removeTask(id: string) { tasks.value = tasks.value.filter(t => t.id !== id) }
  function toggleStar(id: string) { const task = tasks.value.find(t => t.id === id); if (task) task.starred = !task.starred }
  function clearCompleted() { tasks.value = tasks.value.filter(t => t.status !== 'done') }
  function completeAllVisible() { filteredTasks.value.filter(t => t.status === 'todo').forEach(t => { t.status = 'done'; t.completedAt = new Date().toISOString() }) }
  function resetData() {
  tasks.value = []; categories.value = structuredClone(defaultCategories) }
  function exportData() { return JSON.stringify({ version: 2, exportedAt: new Date().toISOString(), tasks: tasks.value, categories: categories.value }, null, 2) }
  function importData(raw: string) { const data = JSON.parse(raw); if (!Array.isArray(data.tasks) || !Array.isArray(data.categories)) throw new Error('Format invalide'); tasks.value = data.tasks; categories.value = data.categories }

  return { tasks, categories, query, filter, categoryFilter, priorityFilter, sortBy, filteredTasks, stats, weeklyActivity, chartMax, categoryStats, addTask, updateTask, toggleTask, removeTask, toggleStar, clearCompleted, completeAllVisible, resetData, exportData, importData }
}
