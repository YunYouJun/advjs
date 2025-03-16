<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { useAdvContext } from './composables'

// const config = useAdvConfig()

const { $adv } = useAdvContext()

useHead({
  title: $adv.gameConfig.value.title,
  meta: [
    { name: 'description', content: $adv.gameConfig.value.description },
  ],
})

if (__DEV__) {
  // @ts-expect-error expose global
  window.__adv__ = $adv
}
</script>

<template>
  <RouterView />
</template>
