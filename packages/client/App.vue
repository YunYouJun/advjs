<script setup lang="ts">
// https://github.com/vueuse/head
// you can use this to manipulate the document head in any components,
// they will be rendered correctly in the html results with vite-ssg
import { useHead } from '@unhead/vue'
import { useAdvConfig, useAdvCtx } from './composables'

const config = useAdvConfig()

useHead({
  title: config.value.title,
  meta: [
    { name: 'description', content: config.value.description },
  ],
})

const $adv = useAdvCtx()
$adv.onMounted()

if (__DEV__) {
  // @ts-expect-error expose global
  window.__adv__ = $adv
}
</script>

<template>
  <RouterView />
</template>
