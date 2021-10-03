<template>
  <!-- 启动界面 -->
  <main
    class="page-start w-full h-screen text-gray-900 dark:text-gray-200"
    :style="pageStartStyles"
  >
    <router-view />
  </main>
</template>

<script setup lang="ts">
const pageStartStyles = computed(() => {
  return {
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: 'cover',
    backgroundImage:
      'url("https://cdn.jsdelivr.net/gh/YunYouJun/cdn/img/bg/stars-timing-0-blur-30px.jpg")',
  }
})
</script>
