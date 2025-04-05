<script setup lang="ts">
import type { FSFileItem } from '@advjs/gui'
import { useAdvContext } from '@advjs/client'
import { getIconFromFSItem } from '@advjs/gui/client/components/explorer/utils.js'
import consola from 'consola'

const props = defineProps<{
  file: FSFileItem
}>()

const fileIcon = ref()
const fileContent = ref()

const gameStore = useGameStore()
const { $adv } = useAdvContext()

watchEffect(async () => {
  const file = await props.file.handle?.getFile()

  const text = await file?.text()
  fileContent.value = text

  // gameStore.gameConfig

  const icon = await getIconFromFSItem(props.file)
  fileIcon.value = icon
})

const language = computed(() => {
  const ext = props.file.name.split('.').pop()
  return ext === 'js' ? 'javascript' : ext
})

async function loadGameFromJSON() {
  const data = JSON.parse(fileContent.value)
  consola.log('Loading game from JSON:', data)
  try {
    gameStore.gameConfig = data

    await $adv.init()
    await $adv.$nav.start('background_01')
  }
  catch (e) {
    consola.error('Failed to parse game config:', e)
  }
}

const startChapter = ref()
const chapterOptions = computed(() => {
  const chapters = gameStore.gameConfig?.chapters || []

  const options = chapters.map(chapter => ({
    value: chapter.id,
    label: chapter.title,
    icon: 'i-ri:book-line',
  }))

  // eslint-disable-next-line vue/no-side-effects-in-computed-properties
  startChapter.value = options[0]?.value

  return options
})

const startNode = ref()
const nodeOptions = computed(() => {
  const curChapter = gameStore.gameConfig.chapters?.find(chapter => chapter.id === startChapter.value)
  if (!curChapter || typeof curChapter.data === 'string') {
    return []
  }

  const nodes = curChapter?.data.nodes?.map(node => ({
    value: node.id,
    label: `${node.id} (${node.type})`,
    icon: 'i-ri:git-commit-line',
  }))

  // eslint-disable-next-line vue/no-side-effects-in-computed-properties
  startNode.value = nodes[0]?.value

  return nodes
})

function goToNode() {
  $adv.$nav.start(startNode.value)
}
</script>

<template>
  <div class="h-full w-full flex flex-col">
    <div class="flex items-center justify-between gap-2 p-2">
      <div class="flex items-center gap-2">
        <AGUIFileItemIcon :file-icon="fileIcon" />
        <div class="text-sm op-80">
          {{ file?.name }}
        </div>
      </div>

      <div class="flex items-center gap-2">
        <AGUIButton v-if="file.name.endsWith('.adv.json')" @click="loadGameFromJSON">
          Load
        </AGUIButton>
        <AGUIButton v-if="file.name.endsWith('.adv.json')" @click="goToNode">
          Start
        </AGUIButton>
      </div>
    </div>

    <div class="p-2">
      <AGUIForm>
        <AGUIFormItem>
          <template #label>
            <label
              class="agui-label w-1/3 flex items-center gap-2 text-$agui-c-label"
            >
              <div class="i-ri:book-line" />
              <span>Start Chapter</span>
            </label>
          </template>
          <AGUISelect v-model="startChapter" :options="chapterOptions" />
        </AGUIFormItem>

        <AGUIFormItem>
          <template #label>
            <label
              class="agui-label w-1/3 flex items-center gap-2 text-$agui-c-label"
            >
              <div class="i-ri:git-commit-line" />
              <span>Start Node</span>
            </label>
          </template>
          <AGUISelect v-model="startNode" :options="nodeOptions" />
        </AGUIFormItem>
      </AGUIForm>
    </div>

    <MonacoEditor
      class="flex flex-grow"
      :model-value="fileContent"
      :lang="language"
      :options="{ theme: 'vs-dark' }"
      :editor-options="{ automaticLayout: true }"
    />
  </div>
</template>
