<template>
  <div class="saved-card shadow-md hover:shadow-lg" grid="~ cols-2" border="~ black dark:white" m="x-2 y-1" h="26">
    <div class="preview-image-container h-full overflow-hidden shadow" bg="white dark:black" @click="onCardClick">
      <img class="w-full h-full object-cover" :src="meta?.thumbnail || defaultBgUrl">
    </div>
    <div class="overflow-hidden" flex="~ col">
      <h3 text="base" class="flex justify-between items-center" bg="white" @click="onCardClick">
        <span p="x-2" bg="black" font="mono" text="sm white "># {{ no }}</span>
        <span v-if="meta?.createdAt" p="x-2" text="xs dark-400 dark:white">{{ dayjs(meta?.createdAt).format('YYYY/MM/DD HH:mm:ss') }}</span>
      </h3>
      <p class="preview-narration" flex="~ col" h="full" bg="white" @click="onCardClick">
        <template v-if="record">
          <span class="flex truncate" text="xs" m="1">{{ record.dialog?.character.name }}</span>
          <span class="truncate" m="x-1">{{ record.dialog?.children[0].value }}</span>
        </template>
      </p>
      <h3 text="base" class="flex justify-between items-center" bg="white">
        <input v-model="memo" p="x-1" class="adv-record-memo" text="xs dark-400 dark:white" @input="isEditing = true">
        <span p="x-2" bg="black" font="mono" text="xs white" @click="saveCardMeta">{{ isEditing ? '保存' :'备注' }}</span>
      </h3>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { defaultBgUrl } from '@advjs/theme-default'
import dayjs from 'dayjs'
import type { AdvGameRecord, AdvGameRecordMeta } from '@advjs/core'
import { screenshotGameThumb } from '@advjs/core'
import { useGameStore } from '~/stores/game'
import { useAppStore } from '~/stores/app'
import { adv } from '~/setup/adv'

const app = useAppStore()

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

const game = useGameStore()

const record = ref<AdvGameRecord>()
const meta = ref<AdvGameRecordMeta>()
const memo = ref('')
const isEditing = ref(false)

onMounted(async() => {
  const savedRecord = await game.readRecord(props.no)
  record.value = savedRecord
  const savedMeta = await game.readRecordMeta(props.no)
  meta.value = savedMeta
  memo.value = savedMeta.memo || ''
})

const saveCardMeta = async() => {
  await game.saveRecordMeta(props.no, {
    memo: memo.value,
  })
  isEditing.value = false
}

/**
 * 存储至该卡片
 */
const saveToCard = async() => {
  const dataUrl = await screenshotGameThumb()
  const curRecord = adv.store.cur.value
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

const loadFromCard = () => {
  if (!record.value) return
  adv.store.cur.value = record.value

  // 关闭加载菜单
  app.toggleShowLoadMenu()

  if (route.path !== '/game')
    router.push('/game')
}

const onCardClick = () => {
  if (props.type === 'save')
    saveToCard()
  else
    loadFromCard()
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
  transition: 0.2s;

  &:hover {
    filter: brightness(0.5);
  }
}

.preview-narration {
  text-align: left;

  border-top: 1px solid var(--adv-text-color);
  border-bottom: 1px solid var(--adv-text-color);
  @apply text-sm;
}

.adv-record-memo {
  &:focus {
    outline: none;
  }
}
</style>
