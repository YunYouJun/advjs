<script lang="ts" setup>
import type { ComponentInstance } from 'vue'
import AdvIconButton from '@advjs/theme-default/components/ui/AdvIconButton.vue'
import { useFullscreen } from '@vueuse/core'
import { onMounted, ref } from 'vue'

const buttonRef = ref<ComponentInstance<typeof AdvIconButton>>()
const targetEl = ref<HTMLElement>()
const { isFullscreen, toggle } = useFullscreen(targetEl)

onMounted(() => {
  targetEl.value = buttonRef.value?.$el?.closest('.adv-screen') as HTMLElement
})
</script>

<template>
  <AdvIconButton ref="buttonRef" @click="toggle()">
    <div v-if="!isFullscreen" i-ri-fullscreen-line />
    <div v-else i-ri-fullscreen-exit-line />
  </AdvIconButton>
</template>
