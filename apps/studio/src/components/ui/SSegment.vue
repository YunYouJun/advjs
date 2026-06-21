<script setup lang="ts">
interface SegmentItem {
  key: string
  label: string
}

defineProps<{
  modelValue: string
  items: SegmentItem[]
}>()

defineEmits<{
  'update:modelValue': [key: string]
}>()
</script>

<template>
  <div class="s-segment">
    <button
      v-for="item in items"
      :key="item.key"
      type="button"
      class="s-segment__item"
      :class="{ 's-segment__item--active': item.key === modelValue }"
      @click="$emit('update:modelValue', item.key)"
    >
      {{ item.label }}
    </button>
  </div>
</template>

<style scoped>
.s-segment {
  display: inline-flex;
  gap: 2px;
  padding: 3px;
  border-radius: var(--adv-radius-sm);
  background: var(--adv-surface-elevated);
}

.s-segment__item {
  flex: 1;
  border: none;
  border-radius: calc(var(--adv-radius-sm) - 2px);
  padding: 6px 16px;
  background: transparent;
  font-family: inherit;
  font-size: var(--adv-font-body-sm);
  font-weight: 600;
  white-space: nowrap;
  color: var(--adv-text-secondary);
  cursor: pointer;
  transition:
    background var(--adv-duration-fast) var(--adv-ease-default),
    color var(--adv-duration-fast) var(--adv-ease-default);
}

.s-segment__item--active {
  background: var(--adv-surface-card);
  color: var(--adv-primary);
  box-shadow: var(--adv-shadow-subtle);
}
</style>
