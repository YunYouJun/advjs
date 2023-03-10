<script lang="ts" setup>
import { computed } from 'vue'
import { useImages } from '@advjs/client/composables'

const props = defineProps<{
  assets: {
    images: Record<string, string>
  }
}>()

const emit = defineEmits(['loaded'])

const images = computed(() => Object.entries(props.assets.images).map(([_key, img]) => ({ src: img })))
const preloadImgs = useImages(images)

const percentage = computed(() => {
  if (!preloadImgs.isLoading.value) {
    emit('loaded')
    return 1
  }
  else {
    let total = 0
    const queue = preloadImgs.imagesQueue.value
    queue.forEach((img) => {
      if (!img.isLoading)
        total += 1
    })
    return total / queue.length
  }
})
</script>

<template>
  <Transition name="fade">
    <div
      w="full"
      flex="~ col" justify="center" items="center"
      p="x-8"
      z="9"
    >
      <AdvProgress :percentage="percentage" />
    </div>
  </Transition>
</template>
