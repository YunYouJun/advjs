<script setup lang="ts">
defineProps<{
  danger?: boolean
}>()
</script>

<template>
  <nav class="nav-group" :class="{ 'nav-group--danger': danger }">
    <slot />
  </nav>
</template>

<style scoped>
.nav-group {
  display: flex;
  flex-direction: column;
  border-radius: var(--adv-radius-lg);
  background: var(--adv-surface-card);
  border: 1px solid var(--adv-border-subtle);
  box-shadow: var(--adv-shadow-subtle);
  overflow: hidden;
}

.nav-group--danger {
  border-color: rgba(239, 68, 68, 0.15);
}
</style>
