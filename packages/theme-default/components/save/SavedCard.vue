<template>
  <div class="saved-card shadow hover:shadow-lg" grid="~ cols-2" border="~ black dark:white" m="auto" w="100" h="26">
    <div class="preview-image-container h-full overflow-hidden shadow">
      <img class="w-full h-full object-cover" :src="defaultBgUrl">
    </div>
    <div>
      <h3 text="base" class="flex justify-between items-center">
        <span p="x-2" bg="black" text="white"># {{ no }}</span>
        <span p="x-2" text="sm dark-400 dark:white">{{ dayjs(time).format('YYYY/MM/DD HH:mm:ss') }}</span>
      </h3>
      <p class="preview-narration">
        旁白
      </p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { defaultBgUrl } from '@advjs/theme-default'
import dayjs from 'dayjs'

withDefaults(defineProps<{
  no?: number
  time?: number
}>(), {
  no: 1,
  time: 0,
})
</script>

<style lang="scss">
.saved-card {
  cursor: pointer;

  transition: ease-out 0.4s;

  &:hover {
    transform: scale(1.05);
  }
}

.preview-image-container {
  border-right: 1px solid var(--adv-text-color);
}

.preview-narration {
  padding: 0.5rem;
  text-align: left;

  border-top: 1px solid var(--adv-text-color);
  @apply text-sm;
}
</style>
