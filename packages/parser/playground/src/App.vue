<script setup lang="ts">
// https://github.com/vueuse/head
// you can use this to manipulate the document head in any components,
// they will be rendered correctly in the html results with vite-ssg
import { useHead } from '@unhead/vue'
import { isDark } from './composables'

// github corners is web component, use null to not render reverse attribute

useHead({
  title: 'Playground | ADV.JS Parser',
  meta: [
    { name: 'description', content: 'Playground for ADV.JS Parser' },
  ],
})
</script>

<template>
  <GithubCorners repo="YunYouJun/advjs/tree/main/packages/parser" blank :reverse="isDark || null" />
  <RouterView />
</template>
