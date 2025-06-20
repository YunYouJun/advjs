<script setup lang="ts">
import { AdvGameLoadStatusEnum, useAdvContext } from '@advjs/client'

const props = defineProps<{
  fileHandle?: FileSystemFileHandle
}>()

const { $adv } = useAdvContext()

const gameStore = useGameStore()
const fileStore = useFileStore()
const monacoStore = useMonacoStore()

const fileHandleInfo = useInspectorFileHandle(props.fileHandle)
const onlineFileInfo = useInspectorOnlineFile()

const fileName = computed(() => {
  return fileStore.fileName || (props.fileHandle
    ? fileHandleInfo?.name.value
    : onlineFileInfo?.name.value)
})
const fileIcon = computed(() => {
  return props.fileHandle
    ? fileHandleInfo?.icon.value
    : onlineFileInfo?.icon.value
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
    <div class="flex items-center justify-between gap-2 border-b border-b-stone-300 p-2 dark:border-b-dark-300">
      <div class="flex items-center gap-2">
        <AGUIFileItemIcon :file-icon="fileIcon" />
        <div class="text-sm op-80">
          {{ fileName }}
        </div>
      </div>

      <div class="flex items-center gap-2">
        <AGUIButton
          v-if="fileName?.endsWith('.adv.json')"
          @click="gameStore.loadGameFromJSONStr(fileStore.rawConfigFileContent)"
        >
          Load
        </AGUIButton>
        <AGUIButton v-if="gameStore.client.loadStatus === AdvGameLoadStatusEnum.SUCCESS" @click="goToNode">
          Start
        </AGUIButton>
      </div>
    </div>

    <AEAdvConfigActions v-if="gameStore.client.loadStatus === AdvGameLoadStatusEnum.SUCCESS" />

    <ClientOnly>
      <MonacoEditor
        class="flex flex-grow"
        :model-value="monacoStore.fileContent"
        :lang="monacoStore.language || fileLanguage"
        :options="monacoStore.options"
        :editor-options="{ automaticLayout: true }"
      />
    </ClientOnly>
  </div>
</template>
