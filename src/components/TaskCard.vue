<script setup lang="ts">
import { computed } from 'vue'
import { CalendarDays, Star, MoreHorizontal, Pencil, Trash2, Check } from 'lucide-vue-next'
import type { Category, Task } from '@/types'

const props = defineProps<{ task: Task; category?: Category }>()
const emit = defineEmits<{ toggle: [id: string]; star: [id: string]; edit: [task: Task]; remove: [id: string]; update: [task: Task] }>()
const dueLabel = computed(() => {
  if (!props.task.dueDate) return ''
  const today = new Date().toISOString().slice(0, 10)
  if (props.task.dueDate === today) return "Aujourd'hui"
  return new Intl.DateTimeFormat('fr-BE', { day: 'numeric', month: 'short' }).format(new Date(`${props.task.dueDate}T12:00:00`))
})
const subtasksDone = computed(() => props.task.subtasks.filter(s => s.done).length)
function toggleSubtask(id: string) {
  const copy = structuredClone(props.task)
  const sub = copy.subtasks.find(s => s.id === id)
  if (sub) sub.done = !sub.done
  emit('update', copy)
}
</script>

<template>
  <article class="task-card" :class="{ completed: task.status === 'done' }">
    <button class="check-btn" :class="{ checked: task.status === 'done' }" @click="emit('toggle', task.id)"><Check v-if="task.status === 'done'" :size="15" /></button>
    <div class="task-content">
      <div class="task-topline">
        <div class="badges">
          <span class="category-badge" :style="{ '--cat': category?.color || '#777' }">{{ category?.name || 'Sans catégorie' }}</span>
          <span class="priority-dot" :class="task.priority">{{ task.priority === 'high' ? 'Haute' : task.priority === 'medium' ? 'Moyenne' : 'Basse' }}</span>
        </div>
        <div class="task-actions">
          <button class="icon-btn small" :class="{ active: task.starred }" @click="emit('star', task.id)"><Star :size="16" :fill="task.starred ? 'currentColor' : 'none'" /></button>
          <div class="menu-wrap">
            <button class="icon-btn small"><MoreHorizontal :size="18" /></button>
            <div class="context-menu">
              <button @click="emit('edit', task)"><Pencil :size="15" /> Modifier</button>
              <button class="danger" @click="emit('remove', task.id)"><Trash2 :size="15" /> Supprimer</button>
            </div>
          </div>
        </div>
      </div>
      <h3>{{ task.title }}</h3>
      <p v-if="task.description">{{ task.description }}</p>
      <div v-if="task.subtasks.length" class="subtasks">
        <button v-for="sub in task.subtasks" :key="sub.id" class="subtask" :class="{ done: sub.done }" @click="toggleSubtask(sub.id)">
          <span class="tiny-check"><Check v-if="sub.done" :size="11" /></span>{{ sub.title }}
        </button>
      </div>
      <div class="task-footer">
        <div class="meta-row">
          <span v-if="dueLabel" class="meta"><CalendarDays :size="15" />{{ dueLabel }}</span>
          <span v-for="tag in task.tags" :key="tag" class="tag">#{{ tag }}</span>
        </div>
        <span v-if="task.subtasks.length" class="sub-progress">{{ subtasksDone }}/{{ task.subtasks.length }}</span>
      </div>
    </div>
  </article>
</template>
