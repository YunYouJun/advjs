<script setup lang="ts">
import { AdvGameLoadStatusEnum, useAdvContext } from '@advjs/client'
import { CharacterFrontmatterSchema, parseCharacterMd } from '@advjs/parser'

const props = defineProps<{
  fileHandle?: FileSystemFileHandle
}>()

const { $adv } = useAdvContext()

const gameStore = useGameStore()
const fileStore = useFileStore()
const monacoStore = useMonacoStore()

const fileHandleInfo = useInspectorFileHandle(props.fileHandle)
const onlineFileInfo = useInspectorOnlineFile()
const characterView = shallowRef<'visual' | 'source'>('source')
const character = computed(() => {
  if (!(props.fileHandle?.name || fileStore.fileName)?.endsWith('.character.md'))
    return undefined
  try {
    const parsed = parseCharacterMd(monacoStore.fileContent)
    return CharacterFrontmatterSchema.safeParse(parsed).success ? parsed : undefined
  }
  catch {
    return undefined
  }
})

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
  if (!gameStore.startChapter || !gameStore.startNode)
    return
  $adv.runtime.go({
    chapterId: gameStore.startChapter,
    nodeId: gameStore.startNode,
  })
}
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <div class="p-2 border-b border-b-stone-300 flex gap-2 items-center justify-between dark:border-b-dark-300">
      <div class="flex gap-2 items-center">
        <AGUIFileItemIcon :file-icon="fileIcon" />
        <div class="text-sm op-80">
          {{ fileName }}
        </div>
      </div>

      <div class="flex gap-2 items-center">
        <AGUIButton
          v-if="fileStore.openedFileHandle && fileName?.endsWith('.md')"
          @click="fileStore.saveOpenedFile()"
        >
          Save
        </AGUIButton>
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

    <div
      v-if="fileStore.externalConflict"
      class="text-xs text-amber-200 px-3 py-2 border-b border-amber-500/30 bg-amber-500/10 flex gap-3 items-center justify-between"
      role="alert"
    >
      <span>This file changed outside the Editor while you have unsaved edits.</span>
      <span class="flex gap-2">
        <AGUIButton @click="fileStore.acceptExternalChange()">
          Use external
        </AGUIButton>
        <AGUIButton @click="fileStore.keepLocalChange()">
          Keep mine
        </AGUIButton>
      </span>
    </div>

    <div v-if="character" class="p-2 border-b border-dark-300 flex gap-2">
      <AGUIButton :theme="characterView === 'visual' ? 'primary' : undefined" @click="characterView = 'visual'">
        {{ $t('characters.visual.title') }}
      </AGUIButton>
      <AGUIButton :theme="characterView === 'source' ? 'primary' : undefined" @click="characterView = 'source'">
        {{ $t('characters.visual.source') }}
      </AGUIButton>
    </div>
    <div v-if="character && characterView === 'visual'" class="flex-1 min-h-0 overflow-auto">
      <CharacterVisualPanel :character="character" />
    </div>
    <ClientOnly v-else>
      <LazyMonacoEditor
        class="flex flex-grow"
        :model-value="monacoStore.fileContent"
        :lang="monacoStore.language || fileLanguage"
        :options="monacoStore.options"
        :editor-options="{ automaticLayout: true }"
        @update:model-value="monacoStore.fileContent = $event"
      />
      <template #fallback>
        <div class="op-50 flex flex-1 items-center justify-center">
          <div i-svg-spinners:3-dots-scale class="text-2xl" />
        </div>
      </template>
    </ClientOnly>
  </div>
</template>
