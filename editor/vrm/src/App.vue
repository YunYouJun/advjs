<script setup lang="ts">
// https://github.com/vueuse/head
// you can use this to manipulate the document head in any components,
// they will be rendered correctly in the html results with vite-ssg
import { useHead } from '@unhead/vue'

useHead({
  title: 'VRM Editor | ADV.JS',
  meta: [
    { name: 'description', content: 'VRM Editor | ADV.JS' },
  ],
})
</script>

<template>
  <RouterView />
</template>
