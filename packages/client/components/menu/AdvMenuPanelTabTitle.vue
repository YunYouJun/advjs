<script setup lang="ts">
import { TabsTrigger } from 'reka-ui'

defineProps<{
  value: string
  title?: string
}>()
</script>

<template>
  <TabsTrigger class="adv-settings-tab" :value="value">
    <slot>{{ title }}</slot>
  </TabsTrigger>
</template>

<style scoped>
.adv-settings-tab {
  min-height: 2.75em;
  padding: 0.5em 0.625em;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--adv-c-text-2);
  font: inherit;
  font-size: 1.125em;
  font-weight: 600;
  line-height: 1.3;
  cursor: pointer;
}

.adv-settings-tab[data-state='active'] {
  border-color: var(--adv-c-primary);
  color: var(--adv-c-primary);
  background: var(--adv-control-active-bg, color-mix(in srgb, var(--adv-c-primary) 12%, transparent));
}
</style>
