<script setup lang="ts">
import AGUIForm from '@advjs/gui/client/components/form/AGUIForm.vue'
import AGUIFormItem from '@advjs/gui/client/components/form/AGUIFormItem.vue'

const fileStore = useFileStore()
const gameStore = useGameStore()
const id = useId()

const chapterOptions = computed(() => {
  const chapters = gameStore.gameConfig?.chapters || []

  const options = chapters.map(chapter => ({
    value: chapter.id,
    label: chapter.title,
    icon: 'i-ri:book-line',
  }))

  // eslint-disable-next-line vue/no-side-effects-in-computed-properties
  gameStore.startChapter = options[0]?.value

  return options
})

const nodeOptions = computed(() => {
  const curChapter = gameStore.gameConfig.chapters?.find(chapter => chapter.id === gameStore.startChapter)
  if (!curChapter) {
    return []
  }
  // typeof curChapter.data === 'string'

  const nodes = curChapter?.nodes?.map(node => ({
    value: node.id,
    label: `${node.id} (${node.type})`,
    icon: 'i-ri:git-commit-line',
  }))

  // eslint-disable-next-line vue/no-side-effects-in-computed-properties
  gameStore.startNode = nodes[0]?.value

  return nodes
})
</script>

<template>
  <div class="p-2">
    <AGUIForm>
      <AGUIFormItem :for="`${id}-chapter`" label="Start Chapter">
        <template #after-label>
          <span class="i-ri:book-line" aria-hidden="true" />
        </template>
        <AGUISelect :id="`${id}-chapter`" v-model="gameStore.startChapter" :options="chapterOptions" label="Start Chapter" />
      </AGUIFormItem>

      <AGUIFormItem :for="`${id}-node`" label="Start Node">
        <template #after-label>
          <span class="i-ri:git-commit-line" aria-hidden="true" />
        </template>
        <AGUISelect :id="`${id}-node`" v-model="gameStore.startNode" :options="nodeOptions" label="Start Node" />
      </AGUIFormItem>

      <AGUIFormItem :for="`${id}-raw`" label="Raw File">
        <template #after-label>
          <span class="i-ri:file-text-line" aria-hidden="true" />
        </template>
        <AGUICheckbox :id="`${id}-raw`" v-model:checked="fileStore.showRawConfigFile" aria-label="Raw File" />
      </AGUIFormItem>
    </AGUIForm>
  </div>
</template>
