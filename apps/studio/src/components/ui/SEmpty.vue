<script setup lang="ts">
withDefaults(defineProps<{
  title?: string
  description?: string
}>(), {
  title: '',
  description: '',
})
</script>

<template>
  <div class="s-empty">
    <div v-if="$slots.icon" class="s-empty__icon">
      <slot name="icon" />
    </div>
    <div class="s-empty__title">
      <slot name="title">
        {{ title }}
      </slot>
    </div>
    <p v-if="description || $slots.description" class="s-empty__desc">
      <slot name="description">
        {{ description }}
      </slot>
    </p>
    <div v-if="$slots.action" class="s-empty__action">
      <slot name="action" />
    </div>
  </div>
</template>

<style scoped>
.s-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  gap: var(--adv-space-sm);
  padding: var(--adv-space-2xl) var(--adv-space-lg);
}

.s-empty__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--adv-space-xs);
  font-size: var(--adv-font-icon-xl);
  color: var(--adv-text-tertiary);
}

.s-empty__title {
  font-size: var(--adv-font-subtitle);
  font-weight: 700;
  color: var(--adv-text-primary);
}

.s-empty__desc {
  margin: 0;
  max-width: 280px;
  font-size: var(--adv-font-body-sm);
  line-height: 1.5;
  color: var(--adv-text-secondary);
}

.s-empty__action {
  margin-top: var(--adv-space-sm);
}
</style>
