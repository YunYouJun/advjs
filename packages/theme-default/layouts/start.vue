<script setup lang="ts">
// 开始菜单
import { isDark } from '~/composables'
const bgImageUrl = computed(() => 'https://fastly.jsdelivr.net/gh/YunYouJun/cdn/img/bg/stars-timing-0-blur-30px.jpg')
</script>

<template>
  <div class="w-full h-full animate-animated animate-fadeIn">
    <AdvAdblock />
    <AdvContainer class="w-full h-full">
      <div class="adv-start-bg absolute w-full h-full -z-1" :class="isDark ? 'filter invert' : ''" bg="cover no-repeat center" :style="{ backgroundImage: `url(${bgImageUrl})` }" />
      <main
        class="page-start w-full h-full text-gray-900 dark:text-gray-200"
      >
        <router-view />
      </main>
    </AdvContainer>
  </div>
</template>
