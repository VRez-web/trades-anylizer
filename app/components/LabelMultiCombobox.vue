<script setup lang="ts">
import type { LabelKind } from '#shared/labelKind'

const props = defineProps<{
  modelValue: number[]
  kind: LabelKind
  options: { id: number; label: string }[]
  inputClass?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number[]]
  refresh: []
}>()

const inputClass = computed(() => props.inputClass ?? 'input')

const inputRef = ref<HTMLInputElement | null>(null)
const open = ref(false)
const inputValue = ref('')
const creating = ref(false)

function labelForId(id: number) {
  return props.options.find((o) => o.id === id)?.label ?? `#${id}`
}

function toggle(id: number) {
  const set = new Set(props.modelValue)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  emit('update:modelValue', [...set])
}

function removeId(id: number) {
  emit(
    'update:modelValue',
    props.modelValue.filter((x) => x !== id),
  )
}

const filtered = computed(() => {
  const sel = new Set(props.modelValue)
  const q = inputValue.value.trim().toLowerCase()
  let list = props.options.filter((o) => !sel.has(o.id))
  if (q) list = list.filter((o) => o.label.toLowerCase().includes(q))
  return list
})

async function commitEnter() {
  const raw = inputValue.value.trim()
  if (!raw) {
    open.value = false
    return
  }
  const exact = props.options.find((o) => o.label.toLowerCase() === raw.toLowerCase())
  if (exact) {
    if (!props.modelValue.includes(exact.id)) emit('update:modelValue', [...props.modelValue, exact.id])
    inputValue.value = ''
    open.value = false
    return
  }
  creating.value = true
  try {
    const row = await $fetch<{ id: number; label: string }>('/api/labels', {
      method: 'POST',
      body: { kind: props.kind, label: raw },
    })
    emit('refresh')
    if (!props.modelValue.includes(row.id)) emit('update:modelValue', [...props.modelValue, row.id])
    inputValue.value = ''
  } finally {
    creating.value = false
    open.value = false
  }
}

function onInput() {
  open.value = true
}

function onFocus() {
  open.value = true
}

function onBlur() {
  setTimeout(() => {
    open.value = false
    inputValue.value = ''
  }, 160)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    commitEnter()
  } else if (e.key === 'Escape') {
    open.value = false
    inputValue.value = ''
    inputRef.value?.blur()
  }
}
</script>

<template>
  <div class="label-multi">
    <div v-if="modelValue.length" class="chips">
      <button
        v-for="id in modelValue"
        :key="id"
        type="button"
        class="chip"
        @click="removeId(id)"
      >
        {{ labelForId(id) }}
        <span class="chip-x" aria-hidden="true">×</span>
      </button>
    </div>
    <div class="combo">
      <input
        ref="inputRef"
        v-model="inputValue"
        type="text"
        :class="inputClass"
        autocomplete="off"
        :placeholder="creating ? 'Сохранение…' : 'Добавить лейбл…'"
        :disabled="creating"
        @input="onInput"
        @focus="onFocus"
        @blur="onBlur"
        @keydown="onKeydown"
      />
      <div v-show="open" class="list" role="listbox">
        <button
          v-for="r in filtered"
          :key="r.id"
          type="button"
          class="item"
          role="option"
          @mousedown.prevent="toggle(r.id)"
        >
          {{ r.label }}
        </button>
        <p v-if="inputValue.trim() && !filtered.length" class="muted empty">
          Enter — создать лейбл
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.label-multi {
  width: 100%;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-bottom: 0.35rem;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  max-width: 100%;
  padding: 0.15rem 0.45rem;
  font-size: 0.75rem;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface2);
  color: var(--text);
  cursor: pointer;
  font-family: inherit;
}
.chip:hover {
  border-color: var(--accent);
}
.chip-x {
  font-size: 1rem;
  line-height: 1;
  opacity: 0.65;
}
.combo {
  position: relative;
  width: 100%;
}
.list {
  position: absolute;
  left: 0;
  right: 0;
  top: calc(100% + 2px);
  z-index: 40;
  max-height: 11rem;
  overflow: auto;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 6px 16px rgba(15, 23, 42, 0.1);
  padding: 0.2rem 0;
}
.item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.35rem 0.55rem;
  border: none;
  background: transparent;
  font-size: inherit;
  color: var(--text);
  cursor: pointer;
  font-family: inherit;
}
.item:hover,
.item:focus-visible {
  background: var(--surface2);
  outline: none;
}
.empty {
  margin: 0;
  padding: 0.35rem 0.55rem;
  font-size: 0.75rem;
}
</style>
