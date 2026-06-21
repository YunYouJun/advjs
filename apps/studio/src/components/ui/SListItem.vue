<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  subtitle?: string
  interactive?: boolean
}>(), {
  title: '',
  subtitle: '',
  interactive: true,
})
</script>

<template>
  <div
    class="s-list-item"
    :class="interactive && 's-list-item--interactive'"
  >
    <span v-if="$slots.icon" class="s-list-item__icon">
      <slot name="icon" />
    </span>
    <div class="s-list-item__body">
      <slot>
        <span class="s-list-item__title">{{ title }}</span>
        <span v-if="subtitle" class="s-list-item__subtitle">{{ subtitle }}</span>
      </slot>
    </div>
    <span v-if="$slots.trailing" class="s-list-item__trailing">
      <slot name="trailing" />
    </span>
  </div>
</template>

<style scoped>
.s-list-item {
  display: flex;
  align-items: center;
  gap: var(--adv-space-sm);
  min-height: 44px;
  padding: 12px 14px;
  color: var(--adv-text-primary);
}

.s-list-item--interactive {
  cursor: pointer;
  transition: background var(--adv-duration-fast) var(--adv-ease-default);
}

.s-list-item--interactive:active {
  background: var(--adv-surface-elevated);
}

.s-list-item__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 34px;
  height: 34px;
  border-radius: var(--adv-radius-sm);
  background: var(--adv-primary-light);
  color: var(--adv-primary);
  font-size: var(--adv-font-icon-sm);
}

.s-list-item__body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.s-list-item__title {
  font-size: var(--adv-font-body);
  font-weight: 600;
}

.s-list-item__subtitle {
  font-size: var(--adv-font-body-sm);
  color: var(--adv-text-secondary);
}

.s-list-item__trailing {
  display: flex;
  align-items: center;
  color: var(--adv-text-tertiary);
}
</style>
