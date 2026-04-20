<script setup lang="ts">
const { data: doc, refresh } = await useFetch('/api/strategy')
const markdown = ref('')
const saving = ref(false)

watch(
  doc,
  (d) => {
    if (d && 'markdown' in d) markdown.value = (d as { markdown: string }).markdown
  },
  { immediate: true },
)

async function save() {
  saving.value = true
  try {
    await $fetch('/api/strategy', { method: 'PUT', body: { markdown: markdown.value } })
    await refresh()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page">
    <h1 style="margin-top: 0">Торговая система</h1>
    <p class="muted">Один документ в Markdown — описание стратегии, правил и заметок.</p>
    <textarea v-model="markdown" class="textarea md" rows="28" placeholder="# Стратегия&#10;&#10;- Правило 1&#10;- Правило 2" />
    <button type="button" class="btn btn-primary" style="margin-top: 0.75rem" :disabled="saving" @click="save">
      Сохранить
    </button>
  </div>
</template>

<style scoped>
.md {
  font-family: ui-monospace, monospace;
  font-size: 0.9rem;
  line-height: 1.45;
}
</style>
