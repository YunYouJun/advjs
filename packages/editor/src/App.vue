<script setup lang="ts">
// https://github.com/vueuse/head
// you can use this to manipulate the document head in any components,
// they will be rendered correctly in the html results with vite-ssg
useHead({
  title: 'ADV.JS Editor',
  meta: [
    { name: 'description', content: 'ADV.JS 在线编辑器' },
  ],
})
</script>

<template>
  <main class="px-2 text-center text-gray-700 dark:text-gray-200">
    <router-view />
  </main>
</template>
