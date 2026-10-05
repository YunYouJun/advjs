<script lang="ts" setup>
import { useFullscreen } from '@vueuse/core'

import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const buttonRef = ref()
const targetEl = ref<HTMLElement>()
const { isFullscreen, toggle } = useFullscreen(targetEl)

onMounted(() => {
  targetEl.value = buttonRef.value?.$el?.closest('.adv-screen') as HTMLElement
})
</script>

<template>
  <AdvIconButton ref="buttonRef" :title="t('button.fullscreen')" :aria-pressed="isFullscreen" @click="toggle()">
    <div v-if="!isFullscreen" i-ri-fullscreen-line />
    <div v-else i-ri-fullscreen-exit-line />
  </AdvIconButton>
</template>
