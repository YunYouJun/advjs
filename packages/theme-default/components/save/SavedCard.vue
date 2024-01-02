<script lang="ts" setup>
import dayjs from 'dayjs'
import { screenshotGameThumb } from '@advjs/core'
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAdvCtx, useAppStore, useGameStore } from '@advjs/client'
import type { AdvGameRecord, AdvGameRecordMeta } from '@advjs/client'
import { assets } from '@advjs/theme-default'

const props = withDefaults(defineProps<{
  /**
   * 类型
   */
  type?: 'save' | 'load'
  no?: number
}>(), {
  type: 'save',
  no: 1,
})

const images = assets.images

const $adv = useAdvCtx()

const app = useAppStore()

const game = useGameStore()

const record = ref<AdvGameRecord>()
const meta = ref<AdvGameRecordMeta>()
const memo = ref('')
const isEditing = ref(false)

onMounted(async () => {
  const savedRecord = await game.readRecord(props.no)
  record.value = savedRecord
  const savedMeta = await game.readRecordMeta(props.no)
  meta.value = savedMeta
  memo.value = savedMeta.memo || ''
})

async function saveCardMeta() {
  await game.saveRecordMeta(props.no, {
    memo: memo.value,
  })
  isEditing.value = false
}

/**
 * 存储至该卡片
 */
async function saveToCard() {
  const dataUrl = await screenshotGameThumb()
  const curRecord = $adv.store.cur
  try {
    await game.saveRecord(props.no, curRecord)
    record.value = curRecord

    game.saveRecordMeta(props.no, {
      thumbnail: dataUrl,
    })

    meta.value = await game.readRecordMeta(props.no)
  }
  catch (e) {
    console.error(e)
  }
}

const route = useRoute()
const router = useRouter()

function loadFromCard() {
  if (!record.value)
    return
  $adv.store.cur = record.value

  // 关闭加载菜单
  app.toggleShowLoadMenu()

  if (route.path !== '/game')
    router.push('/game')
}

function onCardClick() {
  if (props.type === 'save')
    saveToCard()
  else
    loadFromCard()
}
</script>

<template>
  <div class="saved-card shadow-md hover:shadow-lg" grid="~ cols-2" border="~ black dark:white" m="x-2 y-1" h="26">
    <div class="preview-image-container h-full overflow-hidden shadow" bg="white dark:black" @click="onCardClick">
      <img class="h-full w-full object-cover" :src="meta?.thumbnail || images.defaultBgUrl">
    </div>
    <div class="overflow-hidden" flex="~ col">
      <h3 text="base" class="flex items-center justify-between" bg="white" @click="onCardClick">
        <span p="x-2" bg="black" font="mono" text="sm white "># {{ no }}</span>
        <span v-if="meta?.createdAt" p="x-2" text="xs dark-400 dark:white">{{ dayjs(meta?.createdAt).format('YYYY/MM/DD HH:mm:ss') }}</span>
      </h3>
      <p class="preview-narration" flex="~ col" h="full" bg="white" @click="onCardClick">
        <template v-if="record">
          <span class="flex truncate" text="xs" m="1">{{ record.dialog?.character.name }}</span>
          <span class="truncate" m="x-1">{{ record.dialog?.children[0].value }}</span>
        </template>
      </p>
      <h3 text="base" class="flex items-center justify-between" bg="white">
        <input v-model="memo" p="x-1" class="adv-record-memo" text="xs dark-400 dark:white" @input="isEditing = true">
        <span p="x-2" bg="black" font="mono" text="xs white" @click="saveCardMeta">{{ isEditing ? '保存' : '备注' }}</span>
      </h3>
    </div>
  </div>
</template>

<style lang="scss">
.saved-card {
  cursor: pointer;

  transition: ease-out 0.4s;

  &:hover {
    transform: scale(1.05);
  }
}

.preview-image-container {
  border-right: 1px solid var(--adv-c-text);
  transition: 0.2s;

  &:hover {
    filter: brightness(0.5);
  }
}

.preview-narration {
  text-align: left;

  border-top: 1px solid var(--adv-c-text);
  border-bottom: 1px solid var(--adv-c-text);
  @apply text-sm;
}

.adv-record-memo {
  &:focus {
    outline: none;
  }
}
</style>
