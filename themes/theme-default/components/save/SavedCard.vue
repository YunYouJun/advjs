<script lang="ts" setup>
import type { AdvGameSaveRecord, AdvGameSaveSlot } from '@advjs/client'
import { createManualSaveSlot, screenshotGameThumb, useAdvContext, useAppStore, useGameStore } from '@advjs/client'
import dayjs from 'dayjs'
import { computed, onMounted, shallowRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

const props = withDefaults(defineProps<{
  /**
   * 类型
   */
  type?: 'save' | 'load'
  recordSlot?: AdvGameSaveSlot
}>(), {
  type: 'save',
  recordSlot: () => createManualSaveSlot(1),
})

const { $adv } = useAdvContext()

const app = useAppStore()

const game = useGameStore()
const { t } = useI18n()

const record = shallowRef<AdvGameSaveRecord>()
const memo = shallowRef('')
const isEditing = shallowRef(false)
const busy = shallowRef(false)

const preview = computed(() => {
  const snapshot = record.value?.snapshot
  if (!snapshot)
    return undefined
  const { chapterId, nodeId } = snapshot.state.cursor
  const node = $adv.store.program?.chapters[chapterId]?.nodes[nodeId]
  return {
    character: typeof node?.data?.character === 'string' ? node.data.character : '',
    text: typeof node?.data?.text === 'string' ? node.data.text : '',
  }
})

const slotLabel = computed(() => {
  if (props.recordSlot.kind === 'quick')
    return t('save.quick_slot')
  if (props.recordSlot.kind === 'auto')
    return t('save.auto_slot', { index: props.recordSlot.index })
  return t('save.manual_slot', { index: props.recordSlot.index })
})

const emptyLabel = computed(() => {
  if (props.recordSlot.kind === 'quick')
    return t('save.empty_quick')
  if (props.recordSlot.kind === 'auto')
    return t('save.empty_auto')
  return t('save.empty_manual')
})

const actionLabel = computed(() => t(
  props.type === 'save' ? 'save.save_to_slot' : 'save.load_from_slot',
  { slot: slotLabel.value },
))

const formattedTime = computed(() => record.value?.updatedAt
  ? dayjs(record.value.updatedAt).format('MM/DD HH:mm')
  : '')

const fullFormattedTime = computed(() => record.value?.updatedAt
  ? dayjs(record.value.updatedAt).format('YYYY/MM/DD HH:mm:ss')
  : '')

const isFilled = computed(() => Boolean(record.value))

const cardStateLabel = computed(() => {
  if (busy.value)
    return props.type === 'save' ? t('save.saving') : t('save.loading')
  return emptyLabel.value
})

onMounted(async () => {
  record.value = await game.read(props.recordSlot)
  memo.value = record.value?.meta.memo || ''
})

async function saveCardMeta() {
  if (!record.value || busy.value)
    return
  record.value = await game.updateMeta(props.recordSlot, {
    memo: memo.value,
  })
  isEditing.value = false
}

/**
 * 存储至该卡片
 */
async function saveToCard() {
  const curRecord = $adv.runtime.snapshot()
  try {
    record.value = await game.save(props.recordSlot, curRecord)
  }
  catch (e) {
    console.error(e)
    return
  }

  // A thumbnail is useful metadata, never a prerequisite for a valid save.
  // Cross-origin media or unsupported CSS can make DOM capture fail.
  try {
    const dataUrl = await screenshotGameThumb()
    record.value = await game.updateMeta(props.recordSlot, { thumbnail: dataUrl })
  }
  catch (e) {
    console.warn('[advjs] Save created without a thumbnail', e)
  }
}

const route = useRoute()
const router = useRouter()

async function loadFromCard() {
  if (!record.value)
    return
  $adv.runtime.restore(record.value.snapshot)

  // 关闭加载菜单
  app.toggleShowLoadMenu()

  if (route.path !== '/game')
    await router.push('/game')
}

async function onCardClick() {
  if (busy.value)
    return
  busy.value = true
  try {
    if (props.type === 'save')
      await saveToCard()
    else
      await loadFromCard()
  }
  finally {
    busy.value = false
  }
}
</script>

<template>
  <article
    class="saved-card"
    :data-save-kind="recordSlot.kind"
    :data-save-index="recordSlot.kind === 'quick' ? undefined : recordSlot.index"
    :data-save-filled="isFilled"
    :data-busy="busy"
  >
    <button
      type="button"
      class="saved-card__content"
      :aria-label="actionLabel"
      :disabled="busy || (type === 'load' && !record)"
      @click="onCardClick"
    >
      <span class="preview-image-container">
        <img v-if="record?.meta.thumbnail" :src="record.meta.thumbnail" alt="">
        <span v-else class="saved-card__empty-visual" aria-hidden="true">
          <span i-ri-bookmark-line />
        </span>
      </span>

      <span class="saved-card__details">
        <span class="saved-card__header">
          <strong class="saved-card__slot">{{ slotLabel }}</strong>
          <time v-if="record?.updatedAt" :datetime="dayjs(record.updatedAt).toISOString()" :title="fullFormattedTime">
            {{ formattedTime }}
          </time>
        </span>

        <span class="saved-card__preview">
          <span v-if="record" class="saved-card__preview-content">
            <strong v-if="preview?.character" class="saved-card__character">{{ preview.character }}</strong>
            <span class="saved-card__line">{{ preview?.text || t('save.saved_position') }}</span>
          </span>
          <span v-else class="saved-card__empty-copy">{{ cardStateLabel }}</span>
        </span>
      </span>
    </button>

    <footer class="saved-card__footer">
      <template v-if="recordSlot.kind === 'manual'">
        <input
          v-model="memo"
          class="adv-record-memo"
          :aria-label="t('save.memo')"
          :placeholder="t('save.memo_placeholder')"
          :disabled="!record || busy"
          @input="isEditing = true"
        >
        <button
          type="button"
          class="saved-card__meta-action"
          :disabled="!record || busy || !isEditing"
          @click="saveCardMeta"
        >
          {{ isEditing ? t('save.save_memo') : t('save.memo') }}
        </button>
      </template>
      <span v-else class="saved-card__managed">
        <span i-ri-shield-check-line aria-hidden="true" />
        {{ t('save.system_managed') }}
      </span>
    </footer>

    <span v-if="busy" class="saved-card__busy" role="status">
      <span i-ri-loader-4-line class="animate-spin" aria-hidden="true" />
      {{ cardStateLabel }}
    </span>
  </article>
</template>

<style scoped>
.saved-card {
  position: relative;
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--adv-save-border-color, color-mix(in srgb, var(--adv-c-text) 16%, transparent));
  border-radius: calc(var(--adv-save-card-radius, var(--adv-control-radius, 4px)) / var(--adv-screen-scale, 1));
  background: var(--adv-save-card-bg, var(--adv-c-bg-alt));
  box-shadow: var(--adv-save-card-shadow, none);
  color: var(--adv-c-text);
  font-size: calc(14px / var(--adv-screen-scale, 1));
  line-height: 1.4;
  isolation: isolate;
  transition:
    border-color var(--adv-save-motion-duration, 180ms) ease,
    box-shadow var(--adv-save-motion-duration, 180ms) ease;
}

.saved-card:hover {
  border-color: var(--adv-c-primary);
  box-shadow: var(--adv-save-card-shadow-hover, none);
}

.saved-card__content {
  display: grid;
  width: 100%;
  min-height: 0;
  flex: 1 1 auto;
  overflow: hidden;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  grid-template-columns: minmax(0, 36%) minmax(0, 1fr);
  text-align: left;
}

.saved-card__content:disabled {
  cursor: default;
}

.saved-card__content:focus-visible,
.saved-card__meta-action:focus-visible,
.adv-record-memo:focus-visible {
  outline: calc(2px / var(--adv-screen-scale, 1)) solid var(--adv-c-focus, var(--adv-c-primary));
  outline-offset: -2px;
}

.preview-image-container {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-right: 1px solid var(--adv-save-border-color);
  background: color-mix(in srgb, var(--adv-c-text) 4%, var(--adv-c-bg-alt));
}

.preview-image-container img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition:
    filter var(--adv-save-motion-duration, 180ms) ease,
    transform var(--adv-save-motion-duration, 180ms) ease;
}

.saved-card:hover .preview-image-container img {
  transform: scale(1.025);
}

.saved-card__empty-visual {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: var(--adv-c-text-3);
  font-size: 1.6em;
}

.saved-card__details {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
}

.saved-card__header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 0.4em;
  padding: 0.3em 0.65em;
  border-bottom: 1px solid var(--adv-save-border-color);
}

.saved-card__slot {
  overflow: hidden;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 1em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.saved-card__header time {
  flex: 0 0 auto;
  color: var(--adv-c-text-3);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 0.85em;
  white-space: nowrap;
}

.saved-card__preview {
  display: flex;
  min-height: 0;
  flex: 1 1 auto;
  align-items: center;
  overflow: hidden;
  padding: 0.5em 0.65em;
}

.saved-card__preview-content {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 0.25em;
}

.saved-card__character {
  color: var(--adv-c-primary);
  font-size: 0.9em;
}

.saved-card__line {
  display: -webkit-box;
  overflow: hidden;
  color: var(--adv-c-text-2);
  font-size: 1em;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.saved-card__empty-copy {
  color: var(--adv-c-text-3);
  font-size: 0.9em;
  line-height: 1.45;
}

.saved-card__footer {
  display: flex;
  min-height: 2em;
  flex: 0 0 auto;
  align-items: center;
  border-top: 1px solid var(--adv-save-border-color);
}

.adv-record-memo {
  min-width: 0;
  flex: 1 1 auto;
  padding: 0.3em 0.65em;
  border: 0;
  background: transparent;
  color: var(--adv-c-text-2);
  font: inherit;
  font-size: 0.85em;
}

.adv-record-memo::placeholder {
  color: var(--adv-c-text-3);
}

.adv-record-memo:disabled {
  opacity: 0.65;
}

.saved-card__meta-action {
  align-self: stretch;
  padding: 0 0.65em;
  border: 0;
  border-left: 1px solid var(--adv-save-border-color);
  background: transparent;
  color: var(--adv-c-primary);
  cursor: pointer;
  font: inherit;
  font-size: 0.85em;
  white-space: nowrap;
}

.saved-card__meta-action:disabled {
  color: var(--adv-c-text-3);
  cursor: default;
}

.saved-card__managed {
  display: inline-flex;
  align-items: center;
  gap: 0.35em;
  padding: 0 0.65em;
  color: var(--adv-c-text-3);
  font-size: 0.85em;
}

.saved-card__busy {
  position: absolute;
  z-index: 2;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45em;
  background: rgb(0 0 0 / 62%);
  color: white;
  font-size: 1em;
}

@container adv-game (max-width: 400px) {
  .saved-card__header {
    align-items: flex-start;
    flex-direction: column;
    gap: 0.2em;
  }
}

@container adv-game (min-width: 600px) and (max-width: 959px) {
  .saved-card__preview {
    padding-block: 0.3em;
  }

  .saved-card__preview-content {
    width: 100%;
    align-items: center;
    flex-direction: row;
    gap: 0.5em;
  }

  .saved-card__character {
    max-width: 40%;
    flex: none;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .saved-card__line {
    -webkit-line-clamp: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .saved-card,
  .preview-image-container img {
    transition: none;
  }
}
</style>
