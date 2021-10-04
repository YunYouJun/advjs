<template>
  <div class="adv-ui relative">
    <div class="inline-flex absolute left-5 top-5">
      <DisplayHistory class="mr-4" />
      <HideUi />
    </div>

    <div class="inline-flex absolute top-5 right-5">
      <MenuSetting @click="showMenu = true" />
    </div>
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

<style lang="scss">
.adv-ui {
  display: flex;
  position: absolute;

  top: 0;
  right: 0;
  bottom: 0;
  left: 0;

  z-index: 10;
}
</style>
