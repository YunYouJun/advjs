<script setup lang="ts">
definePageMeta({
  layout: 'editor',
})

const app = useAppStore()
const project = useProjectStore()
const desktop = import.meta.client && !!window.advDesktop
const showWelcome = computed(() => desktop && !project.project && !app.showEmptyWorkspace)
const nativeMenu = import.meta.client && window.advDesktop?.nativeMenu === true
const { onboarded } = useEditorLocale()

const showOnboarding = ref(false)

// The root mounts this page only after preferences and workspace are ready.
onMounted(() => {
  if (!onboarded.value) {
    showOnboarding.value = true
  }
})
</script>

<template>
  <main class="flex flex-col h-full w-full" :class="{ 'has-native-menu': nativeMenu }">
    <EditorMenubar />
    <EditorToolbar />

    <AEOpenProject v-if="showWelcome" full-page />
    <AGUILayout v-else v-model:layout="app.layout" class="advjs-editor-layout flex">
      <template #right>
        <PanelInspector />
      </template>

      <template #hierarchy>
        <PanelHierarchy />
      </template>

      <template #scene>
        <PanelScene />
      </template>

      <template #project>
        <PanelProject />
      </template>
    </AGUILayout>

    <AEOnboardingDialog v-model:open="showOnboarding" />
  </main>
</template>

<style lang="scss">
.has-native-menu .advjs-editor-layout {
  --agui-menu-bar-height: 0px;
}

.advjs-editor-layout {
  --agui-menu-bar-height: 26px;
  --agui-toolbar-height: 28px;

  flex: 1;
  min-height: 0;
}
</style>
