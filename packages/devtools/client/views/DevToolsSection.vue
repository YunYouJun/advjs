<script setup lang="ts">
import { useId } from 'vue'

defineProps<{ title: string, meta?: string }>()
const headingId = useId()
</script>

<template>
  <section class="tool-section" :aria-labelledby="headingId">
    <header class="tool-section-header">
      <h2 :id="headingId">
        {{ title }}
      </h2>
      <span v-if="meta" class="section-meta">{{ meta }}</span>
    </header>
    <div v-if="$slots.toolbar" class="tool-section-toolbar">
      <slot name="toolbar" />
    </div>
    <div class="tool-section-body">
      <slot />
    </div>
  </section>
</template>
