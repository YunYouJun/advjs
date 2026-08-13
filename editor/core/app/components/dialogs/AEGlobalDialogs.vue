<script setup lang="ts">
import { useEditorCapabilities } from '../../composables/useEditorCapabilities'

const AEAboutDialog = defineAsyncComponent(() => import('./AEAboutDialog.vue'))
const AESettingsDialog = defineAsyncComponent(() => import('./AESettingsDialog.vue'))
const AEProjectSettingsDialog = defineAsyncComponent(() => import('./AEProjectSettingsDialog.vue'))
const AEGitHubReposDialog = defineAsyncComponent(() => import('./AEGitHubReposDialog.vue'))
const AEPreferencesDialog = defineAsyncComponent(() => import('./AEPreferencesDialog.vue'))
const AECodexWorkflowDialog = defineAsyncComponent(() => import('./AECodexWorkflowDialog.vue'))

const dialogStore = useDialogStore()
const capabilities = useEditorCapabilities()
</script>

<template>
  <AEAboutDialog v-if="dialogStore.openStates.about" v-model:open="dialogStore.openStates.about" />
  <AESettingsDialog v-if="dialogStore.openStates.settings" v-model:open="dialogStore.openStates.settings" />
  <AEProjectSettingsDialog v-if="dialogStore.openStates.projectSettings" v-model:open="dialogStore.openStates.projectSettings" />
  <AEGitHubReposDialog v-if="capabilities.integrations.github && dialogStore.openStates.githubRepos" v-model:open="dialogStore.openStates.githubRepos" />
  <AEPreferencesDialog v-if="dialogStore.openStates.preferences" v-model:open="dialogStore.openStates.preferences" />
  <AECodexWorkflowDialog v-if="dialogStore.openStates.codexWorkflow" v-model:open="dialogStore.openStates.codexWorkflow" />
</template>
