<script lang="ts" setup>
import { onMounted, ref } from 'vue'

const emit = defineEmits(['loaded'])

/**
 * image load by pixi.js manifest
 */

const percentage = ref(0)

const show = ref(true)

onMounted(() => {
  percentage.value = 100
  setTimeout(() => {
    emit('loaded')
  }, 1)
})
</script>

<template>
  <Transition name="fade">
    <div
      v-if="show"
      w="full"
      flex="~ col" justify="center" items="center"
      p="x-8"
      z="9"
    >
      <AdvProgress :percentage="percentage" />
    </div>
  </Transition>
</template>
