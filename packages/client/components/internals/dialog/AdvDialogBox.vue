<script setup lang="ts">
import type { RuntimeNode } from '@advjs/types'
import { useAdvContext, useSettingsStore } from '@advjs/client'
import { computed } from 'vue'
import { useAdvDialogBox } from '../../../composables/useAdvDialogBox'

const props = defineProps<{
  node: RuntimeNode
}>()

const { $adv } = useAdvContext()

const settings = useSettingsStore()

const {
  next,
  curCharacter,
  characterAvatar,
  printed,
  animation,
  transitionFlag,
  fontSizeClass,
  showNextCursor,
  curDialog,
} = useAdvDialogBox()

// 当前对话框中的台词
const curWords = computed(() => {
  const text = props.node.data?.text
  return typeof text === 'string' ? text : curDialog.value?.text
})
</script>

<template>
  <div
    class="adv-dialog-box cursor-pointer select-none shadow-xl"
    @click="next"
  >
    <div class="dialog-name-wrap">
      <template v-if="$adv.config?.value?.showCharacterAvatar && characterAvatar">
        <div class="dialog-avatar-wrap">
          <img class="rounded size-40 shadow" object="cover top" :src="characterAvatar">
          <span>{{ curCharacter?.name }}</span>
        </div>
      </template>
      <template v-else>
        <Transition name="fade">
          <span v-if="transitionFlag" class="dialog-name text-gray-200 font-medium">{{ curCharacter?.name }}</span>
        </Transition>
      </template>
    </div>
    <div
      class="dialog-content text-left"
      :class="fontSizeClass"
    >
      <PrintWords
        v-model:printed="printed"
        :animation="animation"
        :speed="settings.storage.text.curSpeed"
        :words="curWords"
        @end="$adv.$auto.notifyPrintDone()"
      />
      <span
        v-if="showNextCursor"
        class="typed-cursor"
      >
        ▼
      </span>
    </div>
  </div>
</template>

<style lang="scss">
.adv-dialog-box {
  --adv-dialog-name-width: clamp(8rem, 18vw, 13rem);
  --adv-dialog-min-height: 15rem;
  --adv-dialog-padding-block: 3.4rem 2.25rem;
  --adv-dialog-padding-inline: clamp(1.5rem, 6vw, 6rem);
  position: absolute;
  left: -1px;
  right: -1px;
  bottom: -5px;
  display: grid;
  min-height: var(--adv-dialog-min-height);
  grid-template-columns: var(--adv-dialog-name-width) minmax(0, 1fr);
  align-items: start;
  column-gap: clamp(1.25rem, 3vw, 3rem);
  padding: var(--adv-dialog-padding-block) var(--adv-dialog-padding-inline);

  // background-color: rgba(0, 0, 0, 0.7);
  background: linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.75) 35%, black) repeat bottom;
  // 硬件加速，修复 1px 空白问题
  transform: translateZ(0);

  text-shadow: 0 0 0.2rem black;

  .dialog-name-wrap {
    display: flex;
    min-height: 1.75em;
    align-items: baseline;
    justify-content: flex-end;
    text-align: right;
  }

  .dialog-name {
    font-size: 1.25em;
    line-height: 1.75;
  }

  .dialog-avatar-wrap {
    display: flex;
    align-items: flex-end;
    flex-direction: column;
    gap: 0.75rem;
    text-align: center;
  }

  .dialog-content {
    color: white;
    line-height: 1.75;
    letter-spacing: 0.025em;

    text-shadow: 0 0 0.2rem black;
  }
}

@media (max-width: 800px) {
  .adv-dialog-box {
    --adv-dialog-min-height: 12rem;
    --adv-dialog-padding-block: 1.8rem 1.5rem;
    --adv-dialog-padding-inline: 1.5rem;
    grid-template-columns: 1fr;
    row-gap: 0.4rem;

    .dialog-name-wrap {
      justify-content: flex-start;
      text-align: left;
    }

    .dialog-name {
      font-size: 1em;
      line-height: 1.45;
    }
  }
}
</style>
