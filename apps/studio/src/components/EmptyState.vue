<script setup lang="ts">
import { IonIcon } from '@ionic/vue'

defineProps<{
  icon?: string
  title?: string
  description?: string
}>()
</script>

<template>
  <div class="empty-state">
    <div v-if="icon" class="empty-state__illustration">
      <IonIcon :icon="icon" />
    </div>
    <p v-if="title" class="empty-state__title">
      {{ title }}
    </p>
    <p v-if="description" class="empty-state__description">
      {{ description }}
    </p>
    <div v-if="$slots.actions" class="empty-state__actions">
      <slot name="actions" />
    </div>
  </div>
</template>
