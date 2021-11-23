<template>
  <div class="adv-ui flex absolute top-5 justify-between w-full" p="x-5">
    <div class="inline-flex">
      <DisplayHistory class="mr-4" />
      <HideUi />
    </div>

    <MenuSetting @click="showMenu = true" />

    <!-- <div class="inline-flex absolute top-5 right-5">
    </div> -->
    <BaseModal v-show="showMenu" @close="showMenu = false">
      <template #body>
        <MenuPanel />
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
const showMenu = ref(false)
</script>
