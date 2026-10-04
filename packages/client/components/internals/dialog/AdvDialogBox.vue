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
  --adv-dialog-padding-block: 3.4rem calc(54px / var(--adv-screen-scale, 1));
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
  padding-block: var(--adv-dialog-padding-block);
  padding-inline: var(--adv-dialog-padding-inline);
  font-size: max(1rem, calc(12px / var(--adv-screen-scale, 1)));

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

  .dialog-content.text-xl {
    font-size: max(1.25rem, calc(12px / var(--adv-screen-scale, 1)));
  }

  .dialog-content.text-2xl {
    font-size: max(1.5rem, calc(13px / var(--adv-screen-scale, 1)));
  }

  .dialog-content.text-3xl {
    font-size: max(1.875rem, calc(14px / var(--adv-screen-scale, 1)));
  }

  .dialog-content.text-4xl {
    font-size: max(2.25rem, calc(16px / var(--adv-screen-scale, 1)));
  }

  .typed-cursor {
    position: static;
    display: block;
    font-size: 0.6em;
    text-align: right;
  }
}

@container (max-width: 800px) {
  .adv-dialog-box {
    --adv-dialog-min-height: 12rem;
    --adv-dialog-padding-block: 1.8rem calc(54px / var(--adv-screen-scale, 1));
    --adv-dialog-padding-inline: calc(24px / var(--adv-screen-scale, 1));
    grid-template-columns: 1fr;
    row-gap: 0.4rem;

    .dialog-name-wrap {
      justify-content: flex-start;
      text-align: left;
    }

    .dialog-name-wrap:empty {
      display: none;
    }

    .dialog-name {
      font-size: 1em;
      line-height: 1.45;
    }
  }
}
@container (max-width: 380px) {
  .adv-dialog-box {
    padding-bottom: calc(86px / var(--adv-screen-scale, 1));
  }
}
</style>
