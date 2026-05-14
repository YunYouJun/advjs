<script lang="ts" setup>
import type { AdvAst } from '@advjs/types'
import { useAdvContext } from '@advjs/client'
import { consola } from 'consola'

defineProps<{
  node: AdvAst.Choices
}>()

const { $adv } = useAdvContext()

function resolveCrossChapterTarget(target: string) {
  const chapters = $adv.gameConfig.value.chapters
  if (!chapters?.length)
    return null
  // Exact id match (e.g. "adv/chapters/02.adv.md")
  let match = chapters.find(c => c.id === target)
  if (!match) {
    // Title or filename match (e.g. "02", "02.adv.md")
    match = chapters.find(c =>
      c.title === target
      || c.id.endsWith(`/${target}`)
      || c.id.endsWith(`/${target}.adv.md`),
    )
  }
  if (!match)
    return null
  const nodeId = match.startNodeId ?? match.nodes[0]?.id
  if (!nodeId)
    return null
  return { chapterId: match.id, nodeId }
}

function onChoiceClick(choice: AdvAst.Choice) {
  if (choice.do && choice.do.value) {
    $adv.$logic.handleCode(choice.do)
    return
  }
  if (!choice.target) {
    $adv.$nav.next()
    return
  }

  // 1) In-fountain scene jump (parser populates ast.scene[name] = nodeIndex)
  const cur = $adv.store.curFlowNode
  if (cur?.type === 'fountain') {
    const sceneOrder = cur.ast?.scene?.[choice.target]
    if (typeof sceneOrder === 'number' && !Number.isNaN(sceneOrder)) {
      $adv.$logic.goToFountainOrder(sceneOrder)
      return
    }
  }

  // 2) Cross-chapter jump (try matching loaded chapters by id, title, or filename)
  const crossChapter = resolveCrossChapterTarget(choice.target)
  if (crossChapter) {
    consola.info('go to chapter', crossChapter)
    $adv.$nav.go(crossChapter)
    return
  }

  // 3) Fallback: pass through as flow node id
  consola.info('go to', choice.target)
  $adv.$nav.go(choice.target)
}
</script>

<template>
  <div
    v-if="node && node.choices && node.choices.length"
    class="adv-choice items-center justify-center absolute"
    flex="~ col"
    w="full"
    h="full"
    text="4xl"
    font="bold"
  >
    <ul class="adv-options-container">
      <li
        v-for="choice, i in node.choices" :key="i"
        class="adv-option"
        @click="onChoiceClick(choice)"
      >
        {{ choice.text }}
      </li>
    </ul>
  </div>
</template>

<style lang="scss">
.adv-choice {
  .adv-options-container {
    width: 100%;

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    z-index: var(--adv-options-z, 5);
  }

  .adv-option {
    cursor: pointer;

    margin: 1rem;
    padding: 1rem;
    background-color: rgba(0, 0, 0, 0.8);

    width: 50%;
    border: 1px solid white;

    @apply shadow transition-all duration-200 ease-in-out;

    &:hover {
      @apply shadow-lg bg-blue-500/80;
    }
  }
}
</style>
