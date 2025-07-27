<script lang="ts" setup>
import type { AdvAst } from '@advjs/types'
import { useAdvContext, useDialogStore } from '@advjs/client'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { $adv } = useAdvContext()
const { t } = useI18n()
const ast = computed(() => $adv.store.ast)
const dialogStore = useDialogStore()

const containerRef = ref<HTMLDivElement>()

interface HistoryDialog {
  type: 'dialog'
  character: { name: string }
  children: { value: string }[]
}

/**
 * 当前章节 历史所有会话内容
 */
const historyDialogsList = ref<HistoryDialog[]>([])

onMounted(() => {
  const curChapter = $adv.store.curChapter
  const startNodeId = $adv.store.curChapter?.nodes[0].id || ''
  const startNode = $adv.runtime.chaptersMap.get(curChapter?.id || '')?.nodesMap.get(startNodeId)

  if (startNode?.type === 'fountain') {
    if (startNode.ast) {
      for (let i = 0; i < startNode.ast.children.length; i++) {
        if (i > (startNode.order || 0)) {
          // break
          break
        }

        const child = startNode.ast.children[i]
        if (child.type === 'dialog') {
          historyDialogsList.value.push(child as AdvAst.Dialog)
        }
        else if (child.type === 'text') {
        // 处理文本节点
          historyDialogsList.value.push({
            type: 'dialog',
            character: { name: '' },
            children: [{ value: child.value }],
          } as AdvAst.Dialog)
        }
      }
    }
  }
  else if (startNode?.type === 'dialogues') {
    // 从当前节点向上查找，获取所有对话内容
    let prevNode = $adv.store.curNode
    let prevChapterId = $adv.store.curChapter?.id || ''
    do {
      const list: HistoryDialog[] = []
      if (prevNode?.type === 'dialogues') {
        for (let i = 0; i < prevNode.dialogues.length; i++) {
          const dialogue = prevNode.dialogues[i]
          // get character by speakerId or speaker
          const characterId = dialogue.speakerId || dialogue.speaker || ''
          const character = $adv.$characters.get(characterId)

          let pushDialog = true
          if (prevNode === $adv.store.curNode) {
            // 如果是对话节点，使用 order
            if (i > dialogStore.iOrder) {
              pushDialog = false
            }
          }

          if (pushDialog) {
            list.push({
              type: 'dialog',
              character: { name: character?.name || '' },
              children: [
                { value: dialogue.text },
              ],
            })
          }
        }
      }

      historyDialogsList.value.unshift(...list)

      // prevNode.prev && (prevNode = $adv.runtime.chaptersMap.get(curChapter?.id || '')?.nodesMap.get(prevNode.prev))
      if (prevNode?.type === 'dialogues') {
        const prevId = typeof prevNode.prev === 'string' ? prevNode.prev : prevNode.prev?.nodeId
        if (typeof prevNode.prev === 'object' && prevChapterId) {
          prevChapterId = prevNode.prev?.chapterId || prevChapterId
        }
        prevNode = $adv.$nodes.get({
          chapterId: prevChapterId,
          nodeId: prevId || '',
        })
      }
      else {
        prevNode = undefined
      }
    } while (prevNode)
  }

  // 总是滚动至最低部
  setTimeout(() => {
    if (containerRef.value) {
      containerRef.value.scrollTo({
        top: containerRef.value?.scrollHeight,
        behavior: 'auto',
      })
    }
  }, 50)
})
</script>

<template>
  <div
    ref="containerRef"
    h="full" p="8" flex="~ col" gap="3"
    class="adv-history-panel w-9/10 overflow-y-auto"
  >
    <template v-for="i in $adv.store.cur.order" :key="i">
      <div
        v-if="ast.children.length && ast.children[i] && ast.children[i].type === 'dialog'"
        class="flex" gap="8"
      >
        <p class="justify-end" flex="~" w="1/6" text="right">
          <span class="truncate" text="lg">
            {{ (ast.children[i] as AdvAst.Dialog).character.name }}
          </span>
        </p>
        <p class="items-center justify-start" flex="~ grow" text="left" w="5/6">
          <span v-for="item, j in (ast.children[i] as AdvAst.Dialog).children" :key="j">
            {{ item.value }}
          </span>
        </p>
      </div>
    </template>

    <div v-if="historyDialogsList.length" class="flex flex-col gap-9">
      <div v-for="(item, index) in historyDialogsList" :key="index" class="flex" gap="8">
        <p class="justify-end" flex="~" w="1/6" text="right">
          <span v-if="item.character.name" class="truncate font-bold" text="3xl">
            【{{ item.character.name }}】
          </span>
        </p>
        <p
          v-if="item.character.name"
          class="items-center justify-start" flex="~ grow" text="left 3xl" w="5/6"
        >
          <span v-for="(child, childIndex) in item.children" :key="childIndex">
            「{{ child.value }}」
          </span>
        </p>
        <div v-else class="items-center justify-start italic" flex="~ grow" text="left 3xl" w="5/6">
          <span v-for="(child, childIndex) in item.children" :key="childIndex">
            {{ child.value }}
          </span>
        </div>
      </div>
    </div>
    <div v-else class="h-full flex items-center justify-center text-center text-6xl dark:text-gray-200">
      {{ t('settings.history.empty') }}
    </div>
  </div>
</template>
