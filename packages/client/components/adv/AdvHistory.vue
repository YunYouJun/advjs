<script setup lang="ts">
import type { RuntimeNode } from '@advjs/types'
import { computed, nextTick, onMounted, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAdvContext } from '../../composables'

interface HistoryEntry {
  address: string
  character: string
  text: string
  kind: RuntimeNode['kind']
}

const { $adv } = useAdvContext()
const { t } = useI18n()
const containerRef = useTemplateRef<HTMLDivElement>('containerRef')

function resolveVisitedNode(address: string): RuntimeNode | undefined {
  const separator = address.indexOf('#')
  if (separator < 1)
    return undefined
  const chapterId = address.slice(0, separator)
  const nodeId = address.slice(separator + 1)
  return $adv.store.program?.chapters[chapterId]?.nodes[nodeId]
}

const history = computed<HistoryEntry[]>(() => (
  $adv.store.state.visited.flatMap((address) => {
    const node = resolveVisitedNode(address)
    if (!node || !['dialog', 'text', 'narration'].includes(node.kind))
      return []
    const text = typeof node.data?.text === 'string' ? node.data.text : ''
    if (!text)
      return []
    return [{
      address,
      character: typeof node.data?.character === 'string' ? node.data.character : '',
      text,
      kind: node.kind,
    }]
  })
))

onMounted(async () => {
  await nextTick()
  containerRef.value?.scrollTo({
    top: containerRef.value.scrollHeight,
    behavior: 'auto',
  })
})
</script>

<template>
  <div
    ref="containerRef"
    h="full" p="8" flex="~ col" gap="9"
    class="adv-history-panel w-9/10 overflow-y-auto"
  >
    <div v-for="entry in history" :key="entry.address" class="flex" gap="8">
      <p class="justify-end" flex="~" w="1/6" text="right">
        <span v-if="entry.character" class="font-bold truncate" text="3xl">
          【{{ entry.character }}】
        </span>
      </p>
      <p
        v-if="entry.character"
        class="items-center justify-start" flex="~ grow" text="left 3xl" w="5/6"
      >
        「{{ entry.text }}」
      </p>
      <p v-else class="italic items-center justify-start" flex="~ grow" text="left 3xl" w="5/6">
        {{ entry.text }}
      </p>
    </div>

    <div v-if="!history.length" class="text-6xl text-center flex h-full items-center justify-center dark:text-gray-200">
      {{ t('settings.history.empty') }}
    </div>
  </div>
</template>
