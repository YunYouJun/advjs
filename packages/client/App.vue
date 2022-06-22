<script setup lang="ts">
// https://github.com/vueuse/head
// you can use this to manipulate the document head in any components,
// they will be rendered correctly in the html results with vite-ssg
import { useHead } from '@vueuse/head'
useHead({
  title: 'ADV.JS',
  meta: [
    { name: 'description', content: '面向未来与前端的 ADV 文字冒险游戏引擎' },
  ],
})
</script>

<template>
  <router-view />
</template>
