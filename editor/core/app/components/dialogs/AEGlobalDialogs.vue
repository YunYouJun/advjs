<script setup lang="ts">
const dialogStore = useDialogStore()
</script>

<template>
  <AEAboutDialog v-model:open="dialogStore.openStates.about" />
  <AESettingsDialog v-model:open="dialogStore.openStates.settings" />
  <AEProjectSettingsDialog v-model:open="dialogStore.openStates.projectSettings" />
</template>
