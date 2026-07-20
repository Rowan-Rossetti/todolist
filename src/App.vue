<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useDark, useToggle } from '@vueuse/core'
import { Search, Plus, Sun, Moon, Inbox, CalendarDays, CalendarClock, Star, CheckCircle2, LayoutDashboard, SlidersHorizontal, ArrowUpDown, Trash2, Menu, X, AlertTriangle, Download, Upload, RotateCcw, Zap, Target, TrendingUp } from 'lucide-vue-next'
import TaskCard from '@/components/TaskCard.vue'
import TaskModal from '@/components/TaskModal.vue'
import { useTasks } from '@/composables/useTasks'
import type { Task } from '@/types'

const store = useTasks()
const { categories, query, filter, categoryFilter, priorityFilter, sortBy, filteredTasks, stats, weeklyActivity, chartMax, categoryStats } = store
const isDark = useDark({ storageKey: 'focus-theme' })
const toggleDark = useToggle(isDark)
const modalOpen = ref(false), editingTask = ref<Task | null>(null), sidebarOpen = ref(false), importInput = ref<HTMLInputElement | null>(null)
const todayLabel = new Intl.DateTimeFormat('fr-BE', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
const navItems = [
  { id: 'all', label: 'Toutes les tâches', icon: Inbox }, { id: 'today', label: "Aujourd'hui", icon: CalendarDays },
  { id: 'upcoming', label: 'À venir', icon: CalendarClock }, { id: 'overdue', label: 'En retard', icon: AlertTriangle },
  { id: 'starred', label: 'Importantes', icon: Star }, { id: 'done', label: 'Terminées', icon: CheckCircle2 },
] as const
const title = computed(() => navItems.find(i => i.id === filter.value)?.label ?? 'Mes tâches')
const categoryPieStyle = computed(() => {
  const total = categoryStats.value.reduce((sum, category) => sum + category.count, 0)
  if (!total) return { background: 'conic-gradient(var(--line) 0deg 360deg)' }
  let cursor = 0
  const stops = categoryStats.value.map(category => {
    const start = cursor
    cursor += (category.count / total) * 360
    return `${category.color} ${start}deg ${cursor}deg`
  })
  return { background: `conic-gradient(${stops.join(', ')})` }
})
function openCreate() { editingTask.value = null; modalOpen.value = true; sidebarOpen.value = false }
function toggleSidebar() { sidebarOpen.value = !sidebarOpen.value }
function closeSidebar() { sidebarOpen.value = false }
function handleKeydown(event: KeyboardEvent) { if (event.key === 'Escape') closeSidebar() }
watch(sidebarOpen, open => { document.body.classList.toggle('menu-open', open) })
onMounted(() => window.addEventListener('keydown', handleKeydown))
onBeforeUnmount(() => { window.removeEventListener('keydown', handleKeydown); document.body.classList.remove('menu-open') })
function openEdit(task: Task) { editingTask.value = task; modalOpen.value = true }
function save(payload: any) { 'id' in payload ? store.updateTask(payload) : store.addTask(payload) }
function chooseFilter(id: typeof filter.value) { filter.value = id; sidebarOpen.value = false }
function downloadBackup() { const blob = new Blob([store.exportData()], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `focus-backup-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(url) }
async function handleImport(e: Event) { const file = (e.target as HTMLInputElement).files?.[0]; if (!file) return; try { store.importData(await file.text()) } catch { alert("Le fichier n'est pas un export Focus valide.") }; (e.target as HTMLInputElement).value = '' }
</script>

<template>
  <div class="app-shell">
    <aside id="mobile-navigation" class="sidebar" :class="{ open: sidebarOpen }" :aria-hidden="!sidebarOpen && undefined">
      <div class="brand"><div class="brand-mark"><CheckCircle2 :size="23" /></div><span>Focus</span><button class="mobile-close icon-btn" @click="closeSidebar"><X :size="20" /></button></div>
      <button class="btn primary create-btn" @click="openCreate"><Plus :size="19" /> Nouvelle tâche</button>
      <nav class="main-nav"><button v-for="item in navItems" :key="item.id" :class="{ active: filter === item.id }" @click="chooseFilter(item.id)"><component :is="item.icon" :size="18" /><span>{{ item.label }}</span><em v-if="item.id === 'all'">{{ stats.open }}</em><em v-if="item.id === 'today'">{{ stats.today }}</em><em v-if="item.id === 'overdue'">{{ stats.overdue }}</em></button></nav>
      <div class="nav-section"><span>Catégories</span></div>
      <nav class="category-nav"><button :class="{ active: categoryFilter === 'all' }" @click="categoryFilter = 'all'; sidebarOpen = false"><span class="category-dot neutral"></span>Toutes</button><button v-for="cat in categories" :key="cat.id" :class="{ active: categoryFilter === cat.id }" @click="categoryFilter = cat.id; sidebarOpen = false"><span class="category-dot" :style="{ background: cat.color }"></span>{{ cat.name }}</button></nav>
      <div class="sidebar-bottom"><div class="progress-card"><div class="progress-copy"><span>Progression globale</span><strong>{{ stats.progress }}%</strong></div><div class="progress-track"><div :style="{ width: `${stats.progress}%` }"></div></div><small>{{ stats.done }} tâches terminées sur {{ stats.total }}</small></div></div>
    </aside>
    <div v-if="sidebarOpen" class="sidebar-overlay" @click="closeSidebar"></div>

    <main class="main-content">
      <header class="topbar"><button class="mobile-menu icon-btn" type="button" aria-label="Ouvrir ou fermer le menu de navigation" aria-controls="mobile-navigation" :aria-expanded="sidebarOpen" @click="toggleSidebar"><X v-if="sidebarOpen" :size="20" /><Menu v-else :size="20" /></button><div class="searchbox"><Search :size="18" /><input v-model="query" placeholder="Rechercher une tâche, un tag…" /><kbd>⌘ K</kbd></div><button class="theme-toggle icon-btn" title="Changer de thème" @click="toggleDark()"><Sun v-if="isDark" :size="19" /><Moon v-else :size="19" /></button></header>

      <section class="workspace">
        <div class="page-heading"><div><span class="eyebrow">{{ todayLabel }}</span><h1>{{ title }}</h1><p>{{ filteredTasks.length }} tâche{{ filteredTasks.length > 1 ? 's' : '' }} affichée{{ filteredTasks.length > 1 ? 's' : '' }}</p></div><button class="btn primary desktop-add" @click="openCreate"><Plus :size="18" /> Ajouter une tâche</button></div>

        <div class="stats-grid">
          <div class="stat-card"><div class="stat-icon violet"><LayoutDashboard :size="20" /></div><div><span>À faire</span><strong>{{ stats.open }}</strong></div></div>
          <div class="stat-card"><div class="stat-icon orange"><CalendarDays :size="20" /></div><div><span>Aujourd'hui</span><strong>{{ stats.today }}</strong></div></div>
          <div class="stat-card"><div class="stat-icon red"><AlertTriangle :size="20" /></div><div><span>En retard</span><strong>{{ stats.overdue }}</strong></div></div>
          <div class="stat-card"><div class="ring" :style="{ '--progress': `${stats.progress * 3.6}deg` }"><span>{{ stats.progress }}%</span></div><div><span>Progression</span><strong>{{ stats.done }} terminées</strong></div></div>
        </div>

        <section class="activity-section">
          <article class="analytics-card chart-card"><div class="card-heading"><div><span class="eyebrow">Analyse</span><h2>Activité des 7 derniers jours</h2><p class="chart-description">Les barres montent et descendent selon le nombre de tâches terminées chaque jour.</p></div><div class="trend-pill"><TrendingUp :size="15" /> {{ weeklyActivity.reduce((n,d)=>n+d.count,0) }} terminées</div></div><div class="bar-chart" aria-label="Graphique en barres des tâches terminées"><div v-for="day in weeklyActivity" :key="day.key" class="bar-column"><strong>{{ day.count }}</strong><div class="bar-track"><div class="bar-fill" :style="{ height: `${Math.max(day.count ? 14 : 3, day.count / chartMax * 100)}%` }"></div></div><span>{{ day.label }}</span></div></div></article>
        </section>

        <div class="quick-actions"><button @click="store.completeAllVisible"><Zap :size="16" /> Tout terminer dans cette vue</button><button @click="downloadBackup"><Download :size="16" /> Exporter</button><button @click="importInput?.click()"><Upload :size="16" /> Importer</button><button @click="store.resetData"><RotateCcw :size="16" /> Réinitialiser la démo</button><input ref="importInput" hidden type="file" accept="application/json" @change="handleImport" /></div>

        <div class="toolbar"><div class="filter-group"><SlidersHorizontal :size="17" /><select v-model="priorityFilter"><option value="all">Toutes priorités</option><option value="high">Priorité haute</option><option value="medium">Priorité moyenne</option><option value="low">Priorité basse</option></select></div><div class="filter-group"><ArrowUpDown :size="17" /><select v-model="sortBy"><option value="newest">Plus récentes</option><option value="due">Par échéance</option><option value="priority">Par priorité</option><option value="alphabetical">Alphabétique</option></select></div><button v-if="filter === 'done' && stats.done" class="clear-btn" @click="store.clearCompleted"><Trash2 :size="16" /> Vider les terminées</button></div>

        <section class="category-insight">
          <article class="analytics-card pie-card">
            <div class="card-heading"><div><span class="eyebrow">Vue d’ensemble</span><h2>Répartition des tâches</h2><p class="chart-description">Un camembert distinct pour visualiser la part de chaque catégorie.</p></div><Target :size="21" /></div>
            <div class="pie-layout">
              <div class="pie-chart" :style="categoryPieStyle" role="img" aria-label="Graphique en camembert de la répartition des tâches"><div class="pie-center"><strong>{{ stats.total }}</strong><span>tâches</span></div></div>
              <div class="pie-legend"><div v-for="cat in categoryStats" :key="cat.id" class="pie-legend-item"><span><i :style="{ background: cat.color }"></i>{{ cat.name }}</span><strong>{{ cat.count }}</strong></div><p v-if="!categoryStats.length" class="muted">Les catégories apparaîtront ici dès qu’une tâche sera créée.</p></div>
            </div>
          </article>
        </section>

        <TransitionGroup v-if="filteredTasks.length" name="list" tag="div" class="task-list"><TaskCard v-for="task in filteredTasks" :key="task.id" :task="task" :category="categories.find(c => c.id === task.category)" @toggle="store.toggleTask" @star="store.toggleStar" @edit="openEdit" @remove="store.removeTask" @update="store.updateTask" /></TransitionGroup>
        <div v-else class="empty-state"><div class="empty-illustration"><CheckCircle2 :size="42" /></div><h2>Tout est sous contrôle</h2><p>Aucune tâche ne correspond à cette vue. Profite du calme ou ajoute un nouvel objectif.</p><button class="btn primary" @click="openCreate"><Plus :size="18" /> Créer une tâche</button></div>
      </section>
    </main>
    <button class="fab" @click="openCreate"><Plus :size="24" /></button><TaskModal :open="modalOpen" :task="editingTask" :categories="categories" @close="modalOpen = false" @save="save" />
  </div>
</template>
