<script setup lang="ts">
type StrategySystem = { asset: string; markdown: string }

const { data: doc, refresh } = await useFetch('/api/strategy')
const systems = ref<StrategySystem[]>([])
const activeAsset = ref('')
const saving = ref(false)
const newAsset = ref('')

watch(
  doc,
  (d) => {
    const payload = d as { systems?: StrategySystem[]; activeAsset?: string } | null
    const rows = Array.isArray(payload?.systems) ? payload!.systems : [{ asset: 'GENERAL', markdown: '' }]
    systems.value = rows.map((x) => ({
      asset: String(x.asset ?? '').trim().toUpperCase() || 'GENERAL',
      markdown: String(x.markdown ?? ''),
    }))
    const requested = String(payload?.activeAsset ?? '').trim().toUpperCase()
    activeAsset.value = systems.value.some((x) => x.asset === requested)
      ? requested
      : (systems.value[0]?.asset ?? 'GENERAL')
  },
  { immediate: true },
)

const activeSystem = computed(() => systems.value.find((x) => x.asset === activeAsset.value) ?? null)

const activeMarkdown = computed({
  get: () => activeSystem.value?.markdown ?? '',
  set: (v: string) => {
    const idx = systems.value.findIndex((x) => x.asset === activeAsset.value)
    if (idx === -1) return
    systems.value[idx] = { ...systems.value[idx], markdown: v }
  },
})

function normalizeAsset(raw: string) {
  return raw.trim().toUpperCase()
}

function addSystem() {
  const asset = normalizeAsset(newAsset.value)
  if (!asset) return
  if (systems.value.some((x) => x.asset === asset)) {
    activeAsset.value = asset
    newAsset.value = ''
    return
  }
  systems.value = [...systems.value, { asset, markdown: '' }]
  activeAsset.value = asset
  newAsset.value = ''
}

function removeSystem(asset: string) {
  if (systems.value.length <= 1) return
  systems.value = systems.value.filter((x) => x.asset !== asset)
  if (activeAsset.value === asset) {
    activeAsset.value = systems.value[0]?.asset ?? 'GENERAL'
  }
}

async function save() {
  saving.value = true
  try {
    await $fetch('/api/strategy', {
      method: 'PUT',
      body: {
        systems: systems.value,
        activeAsset: activeAsset.value,
      },
    })
    await refresh()
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="page">
    <h1 class="title">Торговые системы по активам</h1>
    <div class="layout">
      <section class="left card">
        <h2 class="asset-title">{{ activeAsset || '—' }}</h2>
        <textarea
          v-model="activeMarkdown"
          class="textarea md"
          rows="28"
          placeholder="# TS для актива&#10;&#10;- Условия входа&#10;- Условия выхода"
        />
        <button type="button" class="btn btn-primary save-btn" :disabled="saving" @click="save">Сохранить</button>
      </section>
      <aside class="right card">
        <h3 class="list-title">Все ТС</h3>
        <div class="add-row">
          <input
            v-model="newAsset"
            class="input"
            placeholder="Напр. BTCUSDT"
            @keydown.enter.prevent="addSystem"
          />
          <button type="button" class="btn" @click="addSystem">Добавить</button>
        </div>
        <ul class="sys-list">
          <li v-for="s in systems" :key="s.asset" class="sys-item">
            <button
              type="button"
              class="sys-btn"
              :class="{ 'sys-btn--active': s.asset === activeAsset }"
              @click="activeAsset = s.asset"
            >
              {{ s.asset }}
            </button>
            <button
              type="button"
              class="btn btn-tiny"
              :disabled="systems.length <= 1"
              @click="removeSystem(s.asset)"
            >
              ×
            </button>
          </li>
        </ul>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.title {
  margin: 0 0 0.75rem;
}
.layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 1rem;
  align-items: start;
}
@media (max-width: 980px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
.left,
.right {
  padding: 0.85rem;
}
.asset-title {
  margin: 0 0 0.55rem;
  font-size: 1rem;
}
.md {
  font-family: ui-monospace, monospace;
  font-size: 0.9rem;
  line-height: 1.45;
}
.save-btn {
  margin-top: 0.65rem;
}
.list-title {
  margin: 0 0 0.5rem;
  font-size: 0.9rem;
}
.add-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.45rem;
  margin-bottom: 0.65rem;
}
.sys-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.45rem;
}
.sys-item {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 0.45rem;
}
.sys-btn {
  text-align: left;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface2);
  color: var(--text);
  padding: 0.38rem 0.55rem;
  cursor: pointer;
  font-family: inherit;
}
.sys-btn--active {
  border-color: var(--accent);
  color: var(--accent);
}
</style>
