<script setup lang="ts">
import type { Component } from 'vue'
import { shallowRef, watch } from 'vue'

defineOptions({ inheritAttrs: false })
defineProps<{ dialog: Component }>()
const open = defineModel<boolean>('open', { default: false })
const rendered = shallowRef(false)
const returnFocus = shallowRef<HTMLElement>()

// Keep only the feature instance alive while Reka Presence removes its content.
// Business state closes immediately; no animation events or timers drive it.
watch(open, (value) => {
  if (value) {
    if (document.activeElement instanceof HTMLElement)
      returnFocus.value = document.activeElement
    rendered.value = true
  }
}, { immediate: true, flush: 'sync' })

function release() {
  if (!open.value)
    rendered.value = false
}
</script>

<template>
  <component
    :is="dialog" v-if="rendered" v-model:open="open" v-bind="$attrs" :return-focus="returnFocus"
    @after-close="release" @vue:mounted="release"
  />
</template>
