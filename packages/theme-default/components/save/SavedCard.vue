<template>
  <div class="saved-card shadow-md hover:shadow-lg" grid="~ cols-2" border="~ black dark:white" m="auto" w="100" h="26" @click="saveToCard">
    <div class="preview-image-container h-full overflow-hidden shadow" bg="white dark:black">
      <img class="w-full h-full object-cover" :src="defaultBgUrl">
    </div>
    <div class="overflow-hidden" flex="~ col">
      <h3 text="base" class="flex justify-between items-center" bg="white">
        <span p="x-2" bg="black" font="mono" text="sm white "># {{ no }}</span>
        <span p="x-2" text="xs dark-400 dark:white">{{ dayjs(time).format('YYYY/MM/DD HH:mm:ss') }}</span>
      </h3>
      <p class="preview-narration" flex="~ grow" bg="white">
        <span v-if="record">{{ record.dialog?.children[0].value }}</span>
      </p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { defaultBgUrl } from '@advjs/theme-default'
import dayjs from 'dayjs'
import type { AdvGameRecord } from '@advjs/core'
import { useGameStore } from '~/stores/game'

import { adv } from '~/setup/adv'

const props = withDefaults(defineProps<{
  no?: number
  time?: number
}>(), {
  no: 1,
  time: 0,
})

const game = useGameStore()

const record = ref<Partial<AdvGameRecord>>({})

onMounted(async() => {
  const savedRecord = await game.readRecord(props.no)
  record.value = savedRecord
})

/**
 * 存储至该卡片
 */
const saveToCard = async() => {
  const curRecord = adv.store.cur
  try {
    await game.saveRecord(props.no, curRecord)
    record.value = curRecord
  }
  catch (e) {
    console.error(e)
  }
}
</script>

<style lang="scss">
.saved-card {
  cursor: pointer;

  transition: ease-out 0.4s;

  &:hover {
    transform: scale(1.05);
  }
}

.preview-image-container {
  border-right: 1px solid var(--adv-text-color);
}

.preview-narration {
  padding: 0.5rem;
  text-align: left;

  border-top: 1px solid var(--adv-text-color);
  @apply text-sm;
}
</style>
