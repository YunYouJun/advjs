<template>
  <div class="ui fixed w-screen top-0 z-10">
    <div class="flex flex-row p-4">
      <DisplayHistory class="mr-4" />
      <HideUi />
    </div>

    <MenuSetting @click="showMenu = true" />
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
.ui {
  position: relative;
}

.adv-icon-button {
  display: inline-block;
  border-radius: 50%;
  padding: 0.6rem;
  cursor: pointer;
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
}
</style>
