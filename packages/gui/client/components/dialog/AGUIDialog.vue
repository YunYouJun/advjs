<script setup lang="ts">
import { usePreferredReducedMotion } from '@vueuse/core'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  // DialogTrigger,
} from 'reka-ui'
import { shallowRef } from 'vue'
import AGUIButton from '../button/AGUIButton.vue'
import '../../styles/motion.scss'

const props = defineProps<{
  title: string
  description?: string

  contentClass?: string
  /** Focus origin captured by a lazy host before its async content loads. */
  returnFocus?: HTMLElement
}>()
const emit = defineEmits<{ afterClose: [] }>()

const open = defineModel('open', {
  type: Boolean,
  default: false,
})

const returnFocus = shallowRef<HTMLElement>()
let menubar: HTMLElement | null = null
let menuIndex = -1
function rememberFocus() {
  const active = props.returnFocus ?? document.activeElement
  if (!(active instanceof HTMLElement))
    return
  // A programmatic dialog may open from a menu item that unmounts on select.
  // Its menu's accessible label identifies the surviving trigger.
  const menuLabel = active.closest('[role="menu"]')?.getAttribute('aria-labelledby')
  returnFocus.value = (menuLabel ? document.getElementById(menuLabel) : undefined) ?? active
  menubar = returnFocus.value.closest('[role="menubar"]')
  menuIndex = menubar ? Array.from(menubar.querySelectorAll('[role="menuitem"]')).indexOf(returnFocus.value) : -1
}
function restoreFocus(event: Event) {
  if (event.defaultPrevented)
    return
  event.preventDefault()
  // An overlapping dialog owns focus once it opens during this one's exit.
  if (document.activeElement?.closest('[role="dialog"][data-state="open"]'))
    return
  if (returnFocus.value?.isConnected)
    returnFocus.value.focus({ preventScroll: true })
  else if (menubar?.isConnected && menuIndex >= 0)
    menubar.querySelectorAll<HTMLElement>('[role="menuitem"]')[menuIndex]?.focus({ preventScroll: true })
}
const reducedMotion = usePreferredReducedMotion()
</script>

<template>
  <DialogRoot v-model:open="open">
    <DialogPortal :key="Number(!open && reducedMotion === 'reduce')">
      <DialogOverlay class="agui-dialog-overlay" />
      <DialogContent
        class="agui-dialog-content"
        :class="contentClass || 'w-4xl h-md'"
        v-bind="description ? {} : { 'aria-describedby': undefined }"
        :aria-hidden="!open"
        :disable-outside-pointer-events="open"
        @open-auto-focus="rememberFocus"
        @close-auto-focus="restoreFocus"
      >
        <header class="agui-dialog-header">
          <DialogTitle class="agui-dialog-title">
            {{ title }}
          </DialogTitle>
          <DialogClose as-child>
            <AGUIButton variant="text" icon="i-ri-close-line" aria-label="Close" title="Close" />
          </DialogClose>
        </header>

        <DialogDescription
          v-if="description"
          class="agui-dialog-description"
        >
          {{ description }}
        </DialogDescription>

        <div class="agui-dialog-body" @vue:unmounted="emit('afterClose')">
          <slot />
        </div>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>

<style>
.agui-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 99;
  background: var(--agui-c-overlay);
}
.agui-dialog-content {
  font-family: var(--agui-font-family-ui);
  position: fixed;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 100;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-width: calc(100vw - 24px);
  max-height: calc(100dvh - 24px);
  color: var(--agui-c-text-1);
  background: var(--agui-c-bg-panel);
  border: 1px solid var(--agui-c-border);
  border-radius: var(--agui-radius-lg);
  box-shadow: var(--agui-shadow-popup);
  font-size: 13px;
}
.agui-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
  min-height: 28px;
  padding: 0 4px 0 12px;
  border-bottom: 1px solid var(--agui-c-divider);
  background: var(--agui-c-bg-panel-title);
}
.agui-dialog-title {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}
.agui-dialog-description {
  margin: 0;
  padding: 8px 12px;
  color: var(--agui-c-text-2);
}
.agui-dialog-body {
  flex: 1;
  position: relative;
  min-height: 0;
  overflow: auto;
}
</style>
