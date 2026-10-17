<script setup lang="ts">
type Note = { id: number; title: string; body: string; updatedAt: string }

const open = ref(false)
const notes = ref<Note[]>([])
const loaded = ref(false)
const current = ref<Note | null>(null)
const saving = ref(false)
let saveTimer: ReturnType<typeof setTimeout> | null = null

async function load() {
  try {
    notes.value = await $fetch<Note[]>('/api/quick-notes')
    loaded.value = true
  } catch {
    notes.value = []
  }
}

async function toggle() {
  open.value = !open.value
  if (open.value && !loaded.value) await load()
  if (!open.value) await flush()
}

async function create() {
  try {
    const row = await $fetch<Note>('/api/quick-notes', { method: 'POST', body: { title: '', body: '' } })
    notes.value.unshift(row)
    current.value = row
  } catch {
    alert('Не удалось создать заметку')
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(flush, 600)
}

async function flush() {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  } else return
  const n = current.value
  if (!n) return
  saving.value = true
  try {
    const row = await $fetch<Note>(`/api/quick-notes/${n.id}`, {
      method: 'PUT',
      body: { title: n.title, body: n.body },
    })
    const i = notes.value.findIndex((x) => x.id === row.id)
    if (i >= 0) notes.value.splice(i, 1)
    notes.value.unshift(row)
  } finally {
    saving.value = false
  }
}

async function back() {
  await flush()
  current.value = null
}

async function remove() {
  const n = current.value
  if (!n || !confirm(`Удалить заметку «${n.title || 'Без названия'}»?`)) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  await $fetch(`/api/quick-notes/${n.id}`, { method: 'DELETE' })
  notes.value = notes.value.filter((x) => x.id !== n.id)
  current.value = null
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })
}

onBeforeUnmount(flush)
</script>

<template>
  <Teleport to="body">
    <div class="qn">
      <div v-if="open" class="qn-panel">
        <template v-if="current">
          <div class="qn-head">
            <button type="button" class="btn btn-tiny" @click="back">← Список</button>
            <span class="qn-status muted">{{ saving ? 'Сохранение…' : '' }}</span>
            <button type="button" class="btn btn-tiny qn-del" @click="remove">Удалить</button>
          </div>
          <input
            v-model="current.title"
            class="input qn-title"
            placeholder="Название"
            @input="scheduleSave"
          />
          <textarea v-model="current.body" class="textarea qn-body" @input="scheduleSave" />
        </template>
        <template v-else>
          <div class="qn-head">
            <strong>Заметки</strong>
            <button type="button" class="btn btn-tiny btn-primary" @click="create">+ Новая</button>
          </div>
          <div class="qn-list">
            <p v-if="loaded && !notes.length" class="muted qn-empty">Пока пусто</p>
            <button
              v-for="n in notes"
              :key="n.id"
              type="button"
              class="qn-item"
              @click="current = n"
            >
              <span class="qn-item-title">{{ n.title || 'Без названия' }}</span>
              <span class="qn-item-date muted">{{ fmtDate(n.updatedAt) }}</span>
            </button>
          </div>
        </template>
      </div>
      <button
        type="button"
        class="qn-fab"
        :class="{ 'is-open': open }"
        :aria-label="open ? 'Закрыть заметки' : 'Заметки'"
        @click="toggle"
      >
        <svg v-if="!open" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
          <path d="M14 3v6h6M8 13h8M8 17h5" />
        </svg>
        <svg v-else viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  </Teleport>
</template>

<style scoped>
.qn {
  position: fixed;
  right: 1.25rem;
  bottom: 1.25rem;
  z-index: 9000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.6rem;
}
.qn-fab {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  border: 0;
  background: var(--accent);
  color: #fff;
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.22);
}
.qn-fab.is-open {
  background: var(--text);
}
.qn-panel {
  width: min(340px, calc(100vw - 2.5rem));
  height: min(440px, calc(100vh - 6rem));
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.75rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.18);
}
.qn-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}
.qn-status {
  flex: 1;
  font-size: 0.75rem;
}
.qn-del {
  color: #b91c1c;
}
.qn-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.qn-empty {
  margin: 1rem 0;
  text-align: center;
  font-size: 0.85rem;
}
.qn-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
  padding: 0.45rem 0.55rem;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  text-align: left;
  font: inherit;
  color: var(--text);
  cursor: pointer;
}
.qn-item:hover {
  background: var(--surface2, #f1f5f9);
  border-color: var(--border);
}
.qn-item-title {
  font-weight: 600;
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.qn-item-date {
  font-size: 0.7rem;
}
.qn-title {
  font-weight: 600;
}
.qn-body {
  flex: 1;
  resize: none;
  min-height: 0;
}
</style>
