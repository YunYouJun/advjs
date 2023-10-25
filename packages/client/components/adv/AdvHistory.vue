<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import type { AdvAst } from '@advjs/types'
import { useAdvCtx, useAppStore } from '@advjs/client'

const $adv = useAdvCtx()

const app = useAppStore()

const ast = computed(() => $adv.store.ast)

const containerRef = ref<HTMLDivElement>()

watch(() => containerRef.value, (val) => {
  if (!val)
    return
  val.scrollTop = val.scrollHeight
})
</script>

<template>
  <AdvModal :show="app.showHistory" header="历史会话" @close="app.toggleHistory">
    <div v-if="$adv.store.cur.order" ref="containerRef" h="full" m="x-16" p="4" class="adv-history-panel overflow-y-auto">
      <template v-for="i in $adv.store.cur.order" :key="i">
        <div v-if="ast.children.length && ast.children[i] && ast.children[i].type === 'dialog'" class="flex" gap="8">
          <p class="flex justify-end" w="1/4" text="right">
            <span class="truncate" text="lg" m="1">
              {{ (ast.children[i] as AdvAst.Dialog).character.name }}
            </span>
          </p>
          <p class="flex justify-start items-center" flex="~ grow" text="left" col="span-3">
            <span v-for="item, j in (ast.children[i] as AdvAst.Dialog).children" :key="j">
              {{ item.value }}
            </span>
          </p>
        </div>
      </template>
    </div>
  </AdvModal>
</template>
