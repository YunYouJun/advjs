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
      <NewYunLogo class="text-8xl" alt="YunYouJun Logo" />
      <h1 class="text-4xl mt-10 z-1">
        Doki Doki ADV.JS
      </h1>
      <small class="mt-10">假装这里有立绘，而且是会动的</small>
      <div class="w-full h-2/3 absolute bottom-0">
        <img
          class="h-80 absolute left-5 bottom-0 h-full animate-bounce"
          src="/img/characters/he/he.png"
          style="animation-delay: 0.5s"
        >
        <img
          class="h-80 absolute right-5 bottom-0 h-full animate-bounce"
          src="/img/characters/she/she.png"
        >
      </div>
    </div>
    <div>
      <StartMenu />
    </div>

    <BaseModal v-show="app.showMenu" @close="app.toggleShowMenu">
      <template #body>
        <MenuPanel />
      </template>
    </BaseModal>
  </div>
</template>

<route lang="yaml">
meta:
  layout: start
</route>

<script lang="ts" setup>
import { useAppStore } from '~/stores/app'
import NewYunLogo from '~/client/app/components/icons/NewYunLogo.vue'
const app = useAppStore()
</script>
