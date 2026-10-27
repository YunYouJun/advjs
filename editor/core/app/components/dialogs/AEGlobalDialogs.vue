<script setup lang="ts">
import { useEditorCapabilities } from '../../composables/useEditorCapabilities'
import { useContentCreationStore } from '../../stores/useContentCreationStore'
import AELazyDialog from './AELazyDialog.vue'

const AEAboutDialog = defineAsyncComponent(() => import('./AEAboutDialog.vue'))
const AESettingsDialog = defineAsyncComponent(() => import('./AESettingsDialog.vue'))
const AEProjectSettingsDialog = defineAsyncComponent(() => import('./AEProjectSettingsDialog.vue'))
const AEGitHubReposDialog = defineAsyncComponent(() => import('./AEGitHubReposDialog.vue'))
const AEPreferencesDialog = defineAsyncComponent(() => import('./AEPreferencesDialog.vue'))
const AECodexWorkflowDialog = defineAsyncComponent(() => import('./AECodexWorkflowDialog.vue'))
const AECreateContentDialog = defineAsyncComponent(() => import('./AECreateContentDialog.vue'))

const dialogStore = useDialogStore()
const capabilities = useEditorCapabilities()
const creation = useContentCreationStore()
</script>

<template>
  <AELazyDialog v-model:open="dialogStore.openStates.about" :dialog="AEAboutDialog" />
  <AELazyDialog v-model:open="dialogStore.openStates.settings" :dialog="AESettingsDialog" />
  <AELazyDialog v-model:open="dialogStore.openStates.projectSettings" :dialog="AEProjectSettingsDialog" />
  <AELazyDialog v-if="capabilities.integrations.github" v-model:open="dialogStore.openStates.githubRepos" :dialog="AEGitHubReposDialog" />
  <AELazyDialog v-model:open="dialogStore.openStates.preferences" :dialog="AEPreferencesDialog" />
  <AELazyDialog v-model:open="dialogStore.openStates.codexWorkflow" :dialog="AECodexWorkflowDialog" />
  <AECreateContentDialog v-if="creation.draft" />
</template>
