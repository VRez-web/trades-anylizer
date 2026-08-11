<script setup lang="ts">
export type AnalysisSections = {
  general: { system: boolean; technique: boolean; psychology: boolean }
  ts: { system: boolean; technique: boolean; psychology: boolean }
}

const props = defineProps<{
  sections: AnalysisSections
}>()

const LABELS = [
  { key: 'system' as const, letter: 'С', title: 'Система' },
  { key: 'technique' as const, letter: 'Т', title: 'Техника' },
  { key: 'psychology' as const, letter: 'П', title: 'Психология' },
]

const hasGeneral = computed(() => LABELS.some((l) => props.sections.general[l.key]))
const hasTs = computed(() => LABELS.some((l) => props.sections.ts[l.key]))
const hasAny = computed(() => hasGeneral.value || hasTs.value)
</script>

<template>
  <span v-if="!hasAny" class="an-none muted">—</span>
  <span v-else class="an-wrap">
    <span v-if="hasGeneral" class="an-group" title="Общий анализ">
      <span
        v-for="l in LABELS"
        :key="'g-' + l.key"
        class="an-badge"
        :class="sections.general[l.key] ? 'an-badge--on' : 'an-badge--off'"
        :title="l.title + (sections.general[l.key] ? '' : ' — пусто')"
      >
        {{ l.letter }}
      </span>
    </span>
    <span v-if="hasTs" class="an-group" title="Анализ ТС">
      <span class="an-ts-prefix">ТС</span>
      <span
        v-for="l in LABELS"
        :key="'t-' + l.key"
        class="an-badge"
        :class="sections.ts[l.key] ? 'an-badge--on' : 'an-badge--off'"
        :title="'ТС: ' + l.title + (sections.ts[l.key] ? '' : ' — пусто')"
      >
        {{ l.letter }}
      </span>
    </span>
  </span>
</template>

<style scoped>
.an-wrap {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  align-items: center;
}
.an-group {
  display: inline-flex;
  gap: 2px;
  align-items: center;
}
.an-ts-prefix {
  font-size: 0.58rem;
  font-weight: 700;
  color: var(--muted);
  margin-right: 1px;
}
.an-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.05rem;
  height: 1.05rem;
  padding: 0 2px;
  border-radius: 3px;
  font-size: 0.58rem;
  font-weight: 700;
  line-height: 1;
}
.an-badge--on {
  color: #166534;
  background: rgba(22, 101, 52, 0.14);
  border: 1px solid rgba(22, 101, 52, 0.35);
}
.an-badge--off {
  color: var(--muted);
  background: transparent;
  border: 1px dashed rgba(100, 116, 139, 0.35);
  opacity: 0.55;
}
.an-none {
  font-size: 0.8125rem;
}
</style>
