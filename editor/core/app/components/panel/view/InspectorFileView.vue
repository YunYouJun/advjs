<script setup lang="ts">
import { useAdvContext } from '@advjs/client'

const props = defineProps<{
  fileHandle?: FileSystemFileHandle
}>()

const { $adv } = useAdvContext()

const gameStore = useGameStore()
const fileStore = useFileStore()

const fileHandleInfo = useInspectorFileHandle(props.fileHandle)
const onlineFileInfo = useInspectorOnlineFile()

const fileName = computed(() => {
  return props.fileHandle
    ? fileHandleInfo?.name.value
    : onlineFileInfo?.name.value
})
const fileIcon = computed(() => {
  return props.fileHandle
    ? fileHandleInfo?.icon.value
    : onlineFileInfo?.icon.value
})
const fileContent = computed(() => {
  return props.fileHandle
    ? fileHandleInfo?.content.value
    : onlineFileInfo?.content.value
})
const fileLanguage = computed(() => {
  return props.fileHandle
    ? fileHandleInfo?.language.value
    : onlineFileInfo?.language.value
})

function goToNode() {
  $adv.$nav.start(gameStore.startNode)
}
</script>

<template>
  <div class="h-full w-full flex flex-col">
    <div class="flex items-center justify-between gap-2 p-2">
      <div class="flex items-center gap-2">
        <AGUIFileItemIcon :file-icon="fileIcon" />
        <div class="text-sm op-80">
          {{ fileName }}
        </div>
      </div>

      <div class="flex items-center gap-2">
        <AGUIButton
          v-if="fileName?.endsWith('.adv.json')"
          @click="gameStore.loadGameFromJSONStr(fileStore.configFileContent)"
        >
          Load
        </AGUIButton>
        <AGUIButton v-if="gameStore.loadStatus === 'success'" @click="goToNode">
          Start
        </AGUIButton>
      </div>
    </div>

    <AEAdvConfigActions v-if="gameStore.loadStatus === 'success'" />

    <MonacoEditor
      class="flex flex-grow"
      :model-value="fileContent"
      :lang="fileLanguage"
      :options="{ theme: 'vs-dark' }"
      :editor-options="{ automaticLayout: true }"
    />
  </div>
</template>
