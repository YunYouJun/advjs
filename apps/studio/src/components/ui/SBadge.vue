<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'primary' | 'gold' | 'danger' | 'neutral'
  dot?: boolean
}>(), {
  variant: 'primary',
  dot: false,
})
</script>

<template>
  <span
    class="s-badge"
    :class="[`s-badge--${variant}`, dot && 's-badge--dot']"
  >
    <slot v-if="!dot" />
  </span>
</template>

<style scoped>
.s-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--adv-font-caption);
  font-weight: 700;
  line-height: 1;
  padding: 3px 8px;
  border-radius: var(--adv-radius-full);
}

.s-badge--dot {
  padding: 0;
  width: 9px;
  height: 9px;
}

.s-badge--primary {
  background: var(--adv-primary);
  color: #fff;
}

.s-badge--gold {
  background: var(--adv-gradient-gold);
  color: #7a4a05;
}

.s-badge--danger {
  background: var(--adv-danger);
  color: #fff;
}

.s-badge--neutral {
  background: var(--adv-surface-elevated);
  color: var(--adv-text-secondary);
}
</style>
