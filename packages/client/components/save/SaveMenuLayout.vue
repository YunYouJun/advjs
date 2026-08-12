<script setup lang="ts">
import type { MotionPreference } from '../../stores/settings/types'

withDefaults(defineProps<{
  motion?: MotionPreference
}>(), {
  motion: 'full',
})
</script>

<template>
  <div class="save-menu-shell menu-panel" :data-motion="motion">
    <div class="save-menu__viewport">
      <slot />
    </div>
    <slot name="pagination" />
  </div>
</template>

<style scoped>
.save-menu-shell {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
}

.save-menu__viewport {
  min-width: 0;
  min-height: 0;
  flex: 1 1 auto;
}

.save-menu__viewport :deep(.save-menu__swiper) {
  width: 100%;
  height: 100%;
}

.save-menu__viewport :deep(.swiper-slide) {
  height: 100%;
}

.save-menu-shell[data-motion='reduced'] :deep(.saved-card:hover),
.save-menu-shell[data-motion='reduced'] :deep(.saved-card:hover .preview-image-container img),
.save-menu-shell[data-motion='none'] :deep(.saved-card:hover),
.save-menu-shell[data-motion='none'] :deep(.saved-card:hover .preview-image-container img) {
  transform: none;
}

.save-menu-shell[data-motion='none'] :deep(.saved-card),
.save-menu-shell[data-motion='none'] :deep(.preview-image-container img) {
  transition: none;
}
</style>
