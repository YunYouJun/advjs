<script setup lang="ts">
import type { RuntimeNode } from '@advjs/types'
import { useAdvContext, useSettingsStore } from '@advjs/client'
import { computed, shallowRef, watch } from 'vue'
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

const avatarFailed = shallowRef(false)
watch(characterAvatar, () => {
  avatarFailed.value = false
})
const showAvatar = computed(() => !!($adv.config.value.showCharacterAvatar && characterAvatar.value && !avatarFailed.value))

// 当前对话框中的台词
const curWords = computed(() => {
  const text = props.node.data?.text
  return typeof text === 'string' ? text : curDialog.value?.text
})
</script>

<template>
  <div
    class="adv-dialog-box adv-dialog-reading cursor-pointer select-none"
    :class="[fontSizeClass, { 'has-avatar': showAvatar }]"
    @click="next"
  >
    <div v-if="curCharacter" class="dialog-name-wrap">
      <template v-if="showAvatar">
        <div class="dialog-avatar-wrap">
          <img class="dialog-avatar rounded shadow" :src="characterAvatar" alt="" @error="avatarFailed = true">
          <span class="dialog-name">{{ curCharacter.name }}</span>
        </div>
      </template>
      <template v-else>
        <Transition name="fade">
          <span v-if="transitionFlag" class="dialog-name">{{ curCharacter.name }}</span>
        </Transition>
      </template>
    </div>
    <div
      class="dialog-content text-left"
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
  --adv-dialog-name-width: clamp(6rem, 14cqi, 10rem);
  --adv-dialog-min-height: 15rem;
  --adv-dialog-footer-space: calc(
    var(--adv-dialog-controls-height, 32px) + var(--adv-control-bottom, 8px) + 12px / var(--adv-screen-scale, 1)
  );
  --adv-dialog-padding-block: 3.4rem var(--adv-dialog-footer-space);
  --adv-dialog-padding-inline: clamp(1.5rem, 6cqi, 6rem);
  position: absolute;
  left: -1px;
  right: -1px;
  bottom: -5px;
  display: grid;
  min-height: var(--adv-dialog-min-height);
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  align-items: start;
  column-gap: clamp(1.25rem, 3cqi, 3rem);
  row-gap: 0.4em;
  padding-block: var(--adv-dialog-padding-block);
  padding-inline: var(--adv-dialog-padding-inline);

  background: var(
    --adv-dialog-bg,
    linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.75) 35%, black) no-repeat bottom
  );
  // 硬件加速，修复 1px 空白问题
  transform: translateZ(0);

  text-shadow: var(--adv-dialog-text-shadow, 0 0 0.2rem black);

  &.has-avatar {
    grid-template-columns: var(--adv-dialog-name-width) minmax(0, 1fr);
  }

  .dialog-name-wrap {
    display: flex;
    min-width: 0;
    align-items: baseline;
    justify-content: flex-start;
    text-align: left;
  }

  .dialog-name {
    color: var(--adv-dialog-name-color, #e5e7eb);
    font-size: calc(1em * 10 / 11);
    font-weight: 600;
    line-height: 1.4;
    overflow-wrap: anywhere;
  }

  .dialog-avatar-wrap {
    display: flex;
    align-items: center;
    flex-direction: column;
    gap: 0.75rem;
    text-align: center;
  }

  .dialog-avatar {
    width: 4em;
    height: 4em;
    max-width: 100%;
    object-fit: cover;
    object-position: top;
  }

  &.has-avatar .dialog-name-wrap {
    justify-content: flex-end;
  }

  .dialog-content {
    color: var(--adv-dialog-color, white);
    line-height: inherit;
    letter-spacing: 0.025em;

    text-shadow: var(--adv-dialog-text-shadow, 0 0 0.2rem black);
  }

  .typed-cursor {
    bottom: var(--adv-dialog-footer-space);
  }
}

@mixin compact-dialog {
  .adv-dialog-box {
    --adv-dialog-min-height: 12rem;
    --adv-dialog-padding-block: 1.8rem var(--adv-dialog-footer-space);
    --adv-dialog-padding-inline: 1.5rem;
    &.has-avatar {
      grid-template-columns: minmax(0, 1fr);
    }
    row-gap: 0.4rem;

    &.has-avatar .dialog-name-wrap {
      justify-content: flex-start;
      text-align: left;
    }

    .dialog-avatar-wrap {
      flex-direction: row;
      gap: 0.75em;
      text-align: left;
    }

    .dialog-avatar {
      width: 2.5em;
      height: 2.5em;
    }
  }
}

@supports not (container-type: inline-size) {
  @media (max-width: 800px) {
    @include compact-dialog;
  }
}

@container adv-game (max-width: 800px) {
  @include compact-dialog;
}
</style>
