<template>
  <div class="grid grid-cols-3 gap-0 h-full">
    <div
      class="
        relative
        h-full
        col-span-2
        flex flex-col
        justify-center
        items-center
      "
    >
      <img class="w-40 z-1" src="https://www.yunyoujun.cn/yun.svg" />
      <i-ri-video-chat-line class="adv-logo text-5xl" alt="ADV logo" />
      <h1 class="text-4xl mt-10 z-1">
        Doki Doki ADV.JS
      </h1>
      <small class="mt-10">假装这里有立绘，而且是会动的</small>
      <div class="w-full h-2/3 absolute bottom-0">
        <img
          class="h-80 absolute left-5 bottom-0 h-full animate-bounce"
          src="/img/characters/he/he.png"
          style="animation-delay: 0.5s"
        />
        <img
          class="h-80 absolute right-5 bottom-0 h-full animate-bounce"
          src="/img/characters/she/she.png"
        />
      </div>
    </div>
    <div>
      <StartMenu></StartMenu>
    </div>
  </div>
</template>

<route lang="yaml">
meta:
  layout: start
</route>

<script setup lang="ts">
onMounted(async() => {})
</script>
