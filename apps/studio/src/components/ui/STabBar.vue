<script setup lang="ts">
interface TabItem {
  key: string
  label: string
  icon?: string
}

defineProps<{
  modelValue: string
  items: TabItem[]
}>()

defineEmits<{
  'update:modelValue': [key: string]
}>()
</script>

<template>
  <nav class="s-tabbar">
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      class="s-tabbar__tab"
      :class="{ 's-tabbar__tab--active': item.key === modelValue }"
      @click="$emit('update:modelValue', item.key)"
    >
      <span class="s-tabbar__icon">
        <slot name="icon" :item="item" :active="item.key === modelValue">{{ item.icon }}</slot>
      </span>
      <span class="s-tabbar__label">{{ item.label }}</span>
    </button>
  </nav>
</template>

<style scoped>
.s-tabbar {
  display: flex;
  background: var(--adv-surface-card);
  border-top: 0.5px solid var(--adv-border-subtle);
  padding-bottom: env(safe-area-inset-bottom, 0px);
}

.s-tabbar__tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  padding: 9px 0 10px;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--adv-text-tertiary);
  font-family: inherit;
  font-size: var(--adv-font-caption);
  -webkit-tap-highlight-color: transparent;
  transition:
    color var(--adv-duration-fast) var(--adv-ease-default),
    transform var(--adv-duration-fast) var(--adv-ease-default);
}

.s-tabbar__tab:active {
  transform: scale(0.95);
}

.s-tabbar__icon {
  display: flex;
  font-size: 23px;
  line-height: 1;
}

.s-tabbar__tab--active {
  color: var(--adv-primary);
}
</style>
