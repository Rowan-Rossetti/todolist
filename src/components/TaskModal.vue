<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { X, Plus, Trash2 } from 'lucide-vue-next'
import type { Category, Priority, Task } from '@/types'

const props = defineProps<{ open: boolean; categories: Category[]; task?: Task | null }>()
const emit = defineEmits<{ close: []; save: [payload: Omit<Task, 'id' | 'createdAt' | 'status' | 'starred'> | Task] }>()

const form = reactive({
  title: '', description: '', priority: 'medium' as Priority, category: 'work', dueDate: '', tags: '',
  subtasks: [] as { id: string; title: string; done: boolean }[],
})

watch(() => [props.open, props.task] as const, () => {
  if (!props.open) return
  form.title = props.task?.title ?? ''
  form.description = props.task?.description ?? ''
  form.priority = props.task?.priority ?? 'medium'
  form.category = props.task?.category ?? props.categories[0]?.id ?? 'work'
  form.dueDate = props.task?.dueDate ?? ''
  form.tags = props.task?.tags.join(', ') ?? ''
  form.subtasks = props.task ? structuredClone(props.task.subtasks) : []
}, { immediate: true })

const valid = computed(() => form.title.trim().length >= 2)

function addSubtask() { form.subtasks.push({ id: crypto.randomUUID(), title: '', done: false }) }
function submit() {
  if (!valid.value) return
  const data = {
    title: form.title.trim(), description: form.description.trim(), priority: form.priority,
    category: form.category, dueDate: form.dueDate,
    tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
    subtasks: form.subtasks.filter(s => s.title.trim()).map(s => ({ ...s, title: s.title.trim() })),
  }
  emit('save', props.task ? { ...props.task, ...data } : data)
  emit('close')
}
</script>

<template>
  <Transition name="modal">
    <div v-if="open" class="modal-backdrop" @mousedown.self="$emit('close')">
      <form class="modal-card" @submit.prevent="submit">
        <div class="modal-head">
          <div>
            <span class="eyebrow">{{ task ? 'Modifier' : 'Nouvelle tâche' }}</span>
            <h2>{{ task ? 'Mettre à jour la tâche' : 'Que faut-il accomplir ?' }}</h2>
          </div>
          <button class="icon-btn" type="button" aria-label="Fermer" @click="$emit('close')"><X :size="19" /></button>
        </div>

        <label class="field field-wide">
          <span>Titre</span>
          <input v-model="form.title" autofocus placeholder="Ex. Préparer la présentation client" />
        </label>
        <label class="field field-wide">
          <span>Description</span>
          <textarea v-model="form.description" rows="3" placeholder="Ajoute quelques détails utiles…" />
        </label>

        <div class="form-grid">
          <label class="field"><span>Catégorie</span><select v-model="form.category"><option v-for="cat in categories" :key="cat.id" :value="cat.id">{{ cat.name }}</option></select></label>
          <label class="field"><span>Priorité</span><select v-model="form.priority"><option value="low">Basse</option><option value="medium">Moyenne</option><option value="high">Haute</option></select></label>
          <label class="field"><span>Échéance</span><input v-model="form.dueDate" type="date" /></label>
          <label class="field"><span>Tags</span><input v-model="form.tags" placeholder="Design, Client" /></label>
        </div>

        <div class="subtasks-editor">
          <div class="section-line"><span>Sous-tâches</span><button type="button" class="text-btn" @click="addSubtask"><Plus :size="15" /> Ajouter</button></div>
          <div v-if="!form.subtasks.length" class="mini-empty">Découpe cette tâche en petites étapes.</div>
          <div v-for="(sub, index) in form.subtasks" :key="sub.id" class="subtask-input">
            <input v-model="sub.title" :placeholder="`Étape ${index + 1}`" />
            <button type="button" class="icon-btn small" @click="form.subtasks.splice(index, 1)"><Trash2 :size="15" /></button>
          </div>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn secondary" @click="$emit('close')">Annuler</button>
          <button class="btn primary" :disabled="!valid">{{ task ? 'Enregistrer' : 'Créer la tâche' }}</button>
        </div>
      </form>
    </div>
  </Transition>
</template>
