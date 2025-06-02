<script lang="ts" setup>
import type { AdvAst } from '@advjs/types'
import { useAdvContext } from '@advjs/client'
import { computed, onMounted, ref } from 'vue'

const { $adv } = useAdvContext()

const ast = computed(() => $adv.store.ast)

const containerRef = ref<HTMLDivElement>()

/**
 * 当前章节 历史所有会话内容
 */
const historyDialogsList = ref<{
  type: 'dialog'
  character: { name: string }
  children: { value: string }[]
}[]>([])

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
    <div v-else class="h-full flex items-center justify-center text-center text-6xl text-gray-500">
      暂无历史记录
    </div>
  </div>
</template>
