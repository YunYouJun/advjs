<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'primary' | 'gold' | 'neutral'
}>(), {
  variant: 'primary',
})
</script>

<template>
  <span class="s-chip" :class="`s-chip--${variant}`">
    <slot />
  </span>
</template>

<style scoped>
.s-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--adv-space-xs);
  font-size: var(--adv-font-caption);
  font-weight: 600;
  line-height: 1;
  padding: 5px 10px;
  border-radius: var(--adv-radius-full);
}

.s-chip--primary {
  background: var(--adv-primary-light);
  color: var(--adv-primary);
}

.s-chip--gold {
  background: var(--adv-accent-subtle);
  color: var(--adv-accent-shade);
}

.s-chip--neutral {
  background: var(--adv-surface-elevated);
  color: var(--adv-text-secondary);
}
</style>
