<script setup lang="ts">
const AEAboutDialog = defineAsyncComponent(() => import('./AEAboutDialog.vue'))
const AESettingsDialog = defineAsyncComponent(() => import('./AESettingsDialog.vue'))
const AEProjectSettingsDialog = defineAsyncComponent(() => import('./AEProjectSettingsDialog.vue'))
const AEGitHubReposDialog = defineAsyncComponent(() => import('./AEGitHubReposDialog.vue'))
const AEPreferencesDialog = defineAsyncComponent(() => import('./AEPreferencesDialog.vue'))

const dialogStore = useDialogStore()
</script>

<template>
  <AEAboutDialog v-if="dialogStore.openStates.about" v-model:open="dialogStore.openStates.about" />
  <AESettingsDialog v-if="dialogStore.openStates.settings" v-model:open="dialogStore.openStates.settings" />
  <AEProjectSettingsDialog v-if="dialogStore.openStates.projectSettings" v-model:open="dialogStore.openStates.projectSettings" />
  <AEGitHubReposDialog v-if="dialogStore.openStates.githubRepos" v-model:open="dialogStore.openStates.githubRepos" />
  <AEPreferencesDialog v-if="dialogStore.openStates.preferences" v-model:open="dialogStore.openStates.preferences" />
</template>
