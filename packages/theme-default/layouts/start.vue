<template>
  <!-- 开始菜单 -->
  <AdvContainer class="w-full h-full animate-slow animate-fadeIn">
    <div class="adv-start-bg absolute w-full h-full -z-1" :class="isDark ? 'filter invert' : ''" bg="cover no-repeat center" :style="{ backgroundImage: 'url(' + bgImageUrl + ')' }" />
    <main
      class="page-start w-full h-full text-gray-900 dark:text-gray-200"
    >
      <router-view />
    </main>
  </AdvContainer>
</template>

<script setup lang="ts">
import { isDark } from '~/composables'
const bgImageUrl = computed(() => 'https://cdn.jsdelivr.net/gh/YunYouJun/cdn/img/bg/stars-timing-0-blur-30px.jpg')
</script>
