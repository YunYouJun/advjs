<script setup lang="ts">
import AGUIButton from '@advjs/gui/components/button/AGUIButton.vue'

defineProps<{ label: string, description?: string, icon?: string }>()
</script>

<template>
  <AGUIButton variant="text" class="project-action" :icon="icon">
    <span class="project-action-copy">
      <strong>{{ label }}</strong>
      <small v-if="description || $slots.description"><slot name="description">{{ description }}</slot></small>
    </span>
  </AGUIButton>
</template>

<style scoped>
.project-action {
  justify-content: flex-start;
  gap: 8px;
  width: 100%;
  min-width: 0;
  padding: 8px;
  text-align: left;
}
.project-action-copy {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}
.project-action :deep(> [aria-hidden='true']) {
  flex-shrink: 0;
}
strong {
  display: block;
  font-size: 13px;
  font-weight: 500;
}
small {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: var(--agui-c-text-2);
}
</style>
