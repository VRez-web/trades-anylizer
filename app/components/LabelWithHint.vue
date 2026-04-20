<script setup lang="ts">
defineProps<{
  lines: readonly string[]
}>()
</script>

<template>
  <span class="lwh" tabindex="-1">
    <span class="lwh-text"><slot /></span>
    <span
      class="lwh-trigger"
      tabindex="0"
      role="button"
      aria-label="Наводящие вопросы"
    >?</span>
    <div class="lwh-tip" role="tooltip">
      <ol>
        <li v-for="(line, i) in lines" :key="i">{{ line }}</li>
      </ol>
    </div>
  </span>
</template>

<style scoped>
.lwh {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  position: relative;
  vertical-align: bottom;
}
.lwh-text {
  font: inherit;
  color: inherit;
}
.lwh-trigger {
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
  line-height: 1;
  font-size: 0.62rem;
  font-weight: 700;
  color: var(--muted);
  border: 1px solid var(--border);
  border-radius: 50%;
  background: var(--surface2);
  cursor: help;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.lwh-trigger:hover,
.lwh-trigger:focus-visible {
  border-color: var(--accent);
  color: var(--accent);
  outline: none;
}
.lwh-tip {
  position: absolute;
  left: 100%;
  top: 50%;
  transform: translateY(-50%);
  margin-left: 0.4rem;
  z-index: 80;
  min-width: 14rem;
  max-width: min(22rem, calc(100vw - 2rem));
  padding: 0.45rem 0.55rem 0.5rem;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.12);
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.12s ease, visibility 0.12s ease;
}
.lwh:hover .lwh-tip,
.lwh:focus-within .lwh-tip {
  opacity: 1;
  visibility: visible;
}
.lwh-tip ol {
  margin: 0;
  padding-left: 1.15rem;
}
.lwh-tip li {
  color: var(--muted);
  font-size: 0.75rem;
  font-weight: 400;
  line-height: 1.4;
}
.lwh-tip li + li {
  margin-top: 0.28rem;
}
</style>
