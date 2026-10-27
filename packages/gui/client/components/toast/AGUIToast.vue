<script setup lang="ts">
import type { ToastOptions } from '../../composables'
import { usePreferredReducedMotion } from '@vueuse/core'
import { ToastClose, ToastDescription, ToastProvider, ToastRoot, ToastTitle, ToastViewport } from 'reka-ui'
import { ref } from 'vue'
import AGUIIconButton from '../button/AGUIIconButton.vue'

const toastOptions = ref<ToastOptions>({
  title: '',
  description: '',
  duration: 5000,
  type: 'default',
})

const toastList = ref<Array<ToastOptions & { open: boolean }>>([])
const reducedMotion = usePreferredReducedMotion()
let sequence = 0

function add(options: ToastOptions) {
  if (options.id && toastList.value.some(item => item.id === options.id))
    return
  toastList.value.push({
    ...toastOptions.value,
    ...options,
    open: true,
    id: options.id ?? `toast-${++sequence}`,
  })
  if (toastList.value.length > 3)
    toastList.value.shift()
}

// Presence owns the exit. Content unmount also covers animation:none and
// interrupted exits without an animation-event handler or a cleanup timer.
function remove(item: ToastOptions) {
  toastList.value = toastList.value.filter(toast => toast !== item)
}

defineExpose({
  add,
  toastList,
})

function getIconFromType(type: ToastOptions['type']) {
  switch (type) {
    case 'info':
      return 'i-ri-information-fill'
    case 'success':
      return 'i-ri-check-fill'
    case 'warning':
      return 'i-ri-alert-fill'
    case 'error':
      return 'i-ri-error-warning-fill'
    default:
      return 'i-ri-information-line'
  }
}
</script>

<template>
  <div class="fixed z-999">
    <ToastProvider v-if="toastList.length">
      <ToastRoot
        v-for="item in toastList" :key="`${item.id}:${!item.open && reducedMotion === 'reduce'}`"
        v-model:open="item.open"
        class="ToastRoot flex flex-col relative"
        :class="`agui-toast--${item.type || 'default'}`"
        :duration="item.duration"
      >
        <div class="ToastContent" @vue:unmounted="remove(item)">
          <ToastTitle v-if="item.title" class="ToastTitle flex items-center">
            <div mr-1 :class="getIconFromType(item.type)" />
            {{ item.title || '' }}
          </ToastTitle>
          <ToastDescription v-if="item.description" class="ToastDescription text-xs ml-21px flex">
            {{ item.description || '' }}
          </ToastDescription>
          <div v-if="$slots.actions" class="ToastActions">
            <slot name="actions" :item="item" />
          </div>
          <ToastClose as-child>
            <AGUIIconButton icon="i-ri-close-fill" title="Close" class="right-2 top-3.5 absolute" />
          </ToastClose>
        </div>
      </ToastRoot>
      <ToastViewport class="ToastViewport" />
    </ToastProvider>
  </div>
</template>

<style lang="scss">
.ToastViewport {
  pointer-events: none;
  --viewport-padding: 10px;
  position: fixed;
  bottom: var(--agui-status-bar-height, 0px);
  right: 0;
  display: flex;
  flex-direction: column;
  padding: var(--viewport-padding);
  gap: 10px;
  width: 350px;
  max-width: 100vw;
  max-height: min(50dvh, calc(100dvh - var(--agui-status-bar-height, 0px)));
  overflow: auto;
  margin: 0;
  list-style: none;
  z-index: 2147483647;
  outline: none;
}

.ToastRoot {
  font-family: var(--agui-font-family-ui);
  pointer-events: auto;
  flex-shrink: 0;
  --toast-accent: var(--agui-c-text-2);
  color: var(--agui-c-text-1);
  background: var(--agui-c-popup);
  border: 1px solid var(--agui-c-border);
  border-inline-start: 3px solid var(--toast-accent);
  border-radius: 4px;
  box-shadow: var(--agui-shadow-popup);
  padding: 12px;
}
.agui-toast--info {
  --toast-accent: var(--agui-c-link);
}
.agui-toast--success {
  --toast-accent: var(--agui-c-success-text);
}
.agui-toast--warning {
  --toast-accent: var(--agui-c-warning-text);
}
.agui-toast--error {
  --toast-accent: var(--agui-c-danger-text);
}

.ToastRoot[data-state='open'] {
  animation: agui-toast-in var(--agui-motion-popup-duration) var(--agui-motion-ease);
}
.ToastRoot[data-state='closed'] {
  pointer-events: none;
  animation: agui-toast-out var(--agui-motion-exit-duration) var(--agui-motion-exit-ease);
}
.ToastRoot[data-swipe='move'] {
  transform: translateX(var(--reka-toast-swipe-move-x));
}
.ToastRoot[data-swipe='cancel'] {
  transform: translateX(0);
  transition: transform var(--agui-motion-duration) var(--agui-motion-ease);
}
.ToastRoot[data-swipe='end'] {
  animation: agui-toast-swipe-out var(--agui-motion-exit-duration) var(--agui-motion-exit-ease);
}

@keyframes agui-toast-out {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes agui-toast-in {
  from {
    opacity: 0;
    transform: translateX(3px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

@keyframes agui-toast-swipe-out {
  from {
    transform: translateX(var(--reka-toast-swipe-end-x));
  }
  to {
    transform: translateX(calc(100% + var(--viewport-padding)));
  }
}

.ToastTitle {
  grid-area: title;
  font-weight: 500;
  color: var(--agui-c-text-1);
  font-size: 14px;
  padding-right: 24px;
}
.ToastTitle > div {
  color: var(--toast-accent);
}

.ToastDescription {
  grid-area: description;
  margin: 0;
  color: var(--agui-c-text-2);
  font-size: 12px;
  line-height: 1.3;
  overflow-wrap: anywhere;
  max-height: 120px;
  overflow: auto;
}
.ToastActions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.ToastActions:not(:empty) {
  margin-top: 8px;
}

.ToastAction {
  grid-area: action;
}
.ToastContent {
  display: contents;
}

@media (prefers-reduced-motion: reduce) {
  .ToastRoot[data-state],
  .ToastRoot[data-swipe] {
    animation: none;
    transition: none;
  }
  .ToastRoot[data-swipe='cancel'] {
    transform: none;
  }
}
</style>
