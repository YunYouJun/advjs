<script setup lang="ts">
// 开始菜单
import { isDark } from '~/composables'

withDefaults(defineProps<{
  bgImage?: string
}>(), {
  bgImage: 'https://cdn.yunyoujun.cn/img/bg/stars-timing-0-blur-30px.jpg',
})
</script>

<template>
  <AdvHelper class="z-1 fixed left-5 bottom-5" text="white" />

  <div class="w-full h-full animate__animated animate__fadeIn">
    <AdvAdblock />
    <AdvContainer class="w-full h-full">
      <div class="adv-start-bg absolute w-full h-full -z-1" :class="isDark ? 'filter invert' : ''" bg="cover no-repeat center" :style="{ backgroundImage: `url(${bgImage})` }" />
      <main
        class="page-start w-full h-full text-gray-900 dark:text-gray-200"
      >
        <router-view />
      </main>
    </AdvContainer>
  </div>
</template>
