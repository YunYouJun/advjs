<template>
  <AdvModal :show="app.showHistory" header="历史会话" @close="app.toggleHistory">
    <div ref="containerRef" h="max-full" grid="~ cols-4 gap-x-8 gap-y-4" m="x-16" p="4" class="adv-history-panel overflow-y-auto">
      <template v-for="i in adv.store.cur.value.order" :key="i">
        <template v-if="ast.children[i].type === 'dialog'">
          <p col="span-1" text="right">
            <span class="truncate" text="lg" m="1">{{ ast.children[i].character.name }}</span>
          </p>
          <p class="flex justify-start items-center" text="left" col="span-3">
            <span v-for="item, j in ast.children[i].children" :key="j">
              {{ item.value }}
            </span>
          </p>
        </template>
      </template>
    </div>
  </AdvModal>
</template>

<script lang="ts" setup>
import { adv } from '~/setup/adv'
import { useAppStore } from '~/stores/app'

const app = useAppStore()

const ast = computed(() => adv.store.ast.value)

const containerRef = ref<HTMLDivElement>()

watch(() => containerRef.value, (val) => {
  if (!val) return
  val.scrollTop = val.scrollHeight
})
</script>
