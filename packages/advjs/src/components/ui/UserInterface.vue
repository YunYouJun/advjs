<template>
  <div class="adv-ui flex absolute top-5 justify-between w-full" p="x-5">
    <div class="inline-flex">
      <DisplayHistory class="mr-4" />
      <HideUi />
    </div>

    <MenuSetting @click="app.toggleShowMenu()" />

    <!-- <div class="inline-flex absolute top-5 right-5">
    </div> -->
    <BaseModal v-show="app.showMenu" @close="app.toggleShowMenu">
      <template #body>
        <MenuPanel />
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { useAppStore } from '~/stores/app'

const app = useAppStore()
</script>
