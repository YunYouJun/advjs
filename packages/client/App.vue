<script setup lang="ts">
// https://github.com/vueuse/head
// you can use this to manipulate the document head in any components,
// they will be rendered correctly in the html results with vite-ssg
import { useHead } from '@vueuse/head'
import { useAdvCtx } from './setup'
useHead({
  title: 'ADV.JS',
  meta: [
    { name: 'description', content: '面向未来与前端的 ADV 文字冒险游戏引擎' },
  ],
})

const $adv = useAdvCtx()
$adv.onMounted()
</script>

<template>
  <router-view />
</template>
