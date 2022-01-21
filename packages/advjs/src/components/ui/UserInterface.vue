<template>
  <div class="adv-ui flex absolute top-5 justify-between w-full" p="x-5">
    <div class="inline-flex">
      <AdvIconButton class="mr-4" @click="app.toggleHistory()">
        <i-ri-message-2-line />
      </AdvIconButton>

      <AdvIconButton class="mr-4" @click="app.toggleUi()">
        <i-ri-eye-close-line />
      </AdvIconButton>

      <AdvIconButton @click="app.toggleTachie()">
        <i-ri-file-user-line v-if="app.showTachie" />
        <i-ri-file-user-fill v-else />
      </AdvIconButton>
    </div>

    <AdvIconButton class="menu-setting-button" @click="app.toggleShowMenu()">
      <i-ri-settings-3-line />
    </AdvIconButton>

    <AdvModal :show="app.showMenu" @close="app.toggleShowMenu">
      <MenuPanel />
    </AdvModal>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '~/stores/app'

const app = useAppStore()
</script>
