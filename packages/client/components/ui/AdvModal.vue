<script lang="ts" setup>
/**
 * 与 dialog fix 超出屏幕不同，
 * modal 覆盖的是游戏全屏
 */

import { DialogClose, DialogContent, DialogRoot, DialogTitle } from 'reka-ui'
import { useI18n } from 'vue-i18n'
import { useAdvMotionPreference } from '../../composables/useAdvMotionPreference'

withDefaults(defineProps<{
  icon?: string
  header?: string
  label?: string
}>(), {
  icon: '',
  header: '',
})

const emit = defineEmits<{ close: [] }>()
const motion = useAdvMotionPreference()
const { t } = useI18n()
let returnFocus: HTMLElement | null = null

const open = defineModel('open', {
  type: Boolean,
  default: false,
})

function updateOpen(value: boolean) {
  open.value = value
  if (!value)
    emit('close')
}

function rememberFocus() {
  returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
}

function restoreFocus(event: Event) {
  event.preventDefault()
  if (returnFocus?.isConnected)
    returnFocus.focus({ preventScroll: true })
}
</script>

<template>
  <DialogRoot :open="open" @update:open="updateOpen">
    <Transition name="modal">
      <DialogContent
        v-if="open"
        force-mount
        class="modal-mask"
        :aria-describedby="undefined"
        :data-motion="motion"
        @open-auto-focus="rememberFocus"
        @close-auto-focus="restoreFocus"
      >
        <DialogTitle class="adv-modal-accessible-title">
          {{ label || header || t('ui.dialog') }}
        </DialogTitle>
        <div class="modal-container flex flex-col size-full z-9999">
          <DialogClose v-if="!header" as-child>
            <AdvIconButton :title="t('button.close')" class="modal-close-button right-4 top-4 absolute">
              <div i-ri-close-line class="text-6xl" />
            </AdvIconButton>
          </DialogClose>

          <slot name="header">
            <div v-if="header" class="flex items-center justify-between">
              <h1
                class="adv-font-serif font-black p-6 flex gap-2 items-center"
                text="6xl"
              >
                <div :class="icon" />
                <span>{{ header }}</span>
              </h1>

              <DialogClose as-child>
                <AdvIconButton :title="t('button.close')" class="modal-close-button">
                  <div i-ri-close-line class="text-6xl" />
                </AdvIconButton>
              </DialogClose>
            </div>

            <HorizontalDivider v-if="header" />
          </slot>

          <div class="modal-body flex flex-grow min-h-0 w-full justify-center overflow-auto">
            <slot />
          </div>
        </div>
      </DialogContent>
    </Transition>
  </DialogRoot>
</template>

<style>
.modal-mask {
  color: var(--adv-c-text);
  position: fixed;
  z-index: 1000;

  /* -1px for 1px problem */
  top: -1px;
  left: -1px;
  right: -1px;
  bottom: -1px;
  backdrop-filter: blur(100px);
  background-color: var(--adv-modal-bg-color);
  transition: opacity var(--adv-modal-motion-duration, 180ms) ease;
}

.modal-container {
  /* padding: 1rem; */
  transition:
    opacity var(--adv-modal-motion-duration, 180ms) ease,
    transform var(--adv-modal-motion-duration, 180ms) ease;
}

.adv-modal-accessible-title {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/*
 * The following styles are auto-applied to elements with
 * transition="modal" when their visibility is toggled
 * by Vue.js.
 *
 * You can easily play with the modal transition by editing
 * these styles.
 */

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container {
  opacity: 0;
  transform: scale(0.97);
}

.modal-leave-to .modal-container {
  opacity: 0;
  transform: translateY(16px);
}

.modal-mask[data-motion='reduced'] .modal-container {
  transform: none;
}

.modal-mask[data-motion='none'],
.modal-mask[data-motion='none'] .modal-container {
  transition: none;
}

.modal-mask[data-motion='none'].modal-enter-from,
.modal-mask[data-motion='none'].modal-leave-to,
.modal-mask[data-motion='none'].modal-enter-from .modal-container,
.modal-mask[data-motion='none'].modal-leave-to .modal-container {
  opacity: 1;
  transform: none;
}

@media (prefers-reduced-motion: reduce) {
  .modal-mask,
  .modal-container {
    transition: none;
  }

  .modal-enter-from,
  .modal-leave-to,
  .modal-enter-from .modal-container,
  .modal-leave-to .modal-container {
    opacity: 1;
    transform: none;
  }
}
</style>
