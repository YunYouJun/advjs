<script setup lang="ts">
const gameStore = useGameStore()

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
      <AGUIFormItem>
        <template #label>
          <label
            class="agui-label w-1/3 flex items-center gap-2 text-$agui-c-label"
          >
            <div class="i-ri:book-line" />
            <span>Start Chapter</span>
          </label>
        </template>
        <AGUISelect v-model="gameStore.startChapter" :options="chapterOptions" />
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
        <AGUISelect v-model="gameStore.startNode" :options="nodeOptions" />
      </AGUIFormItem>
    </AGUIForm>
  </div>
</template>
