<script setup lang="ts">
import { ToastClose, ToastDescription, ToastProvider, ToastRoot, ToastTitle, ToastViewport } from 'radix-vue'
import { ref } from 'vue'
import type { ToastOptions } from '../../composables'

const toastOptions = ref<ToastOptions>({
  title: '',
  description: '',
  duration: 5000,
  type: 'default',
})

const toastList = ref<ToastOptions[]>([])

function add(options: ToastOptions) {
  toastList.value.push({
    ...toastOptions.value,
    ...options,
  })
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

function getClassesFromType(type: ToastOptions['type']) {
  const cls: string[] = []
  switch (type) {
    case 'info':
      cls.push('bg-blue-500')
      break
    case 'success':
      cls.push('bg-green-500')
      break
    case 'warning':
      cls.push('bg-yellow-500')
      break
    case 'error':
      cls.push('bg-red-500')
      break
    default:
      cls.push('bg-$agui-c-bg')
  }
  return cls
}
</script>

<template>
  <div class="fixed">
    <ToastProvider>
      <ToastRoot
        v-for="item, i in toastList" :key="i"
        class="ToastRoot relative flex flex-col shadow-xl"
        :class="getClassesFromType(item.type)"
        :duration="item.duration"
      >
        <ToastTitle class="ToastTitle flex items-center">
          <div mr-1 :class="getIconFromType(item.type)" />
          {{ item.title || '' }}
        </ToastTitle>
        <ToastDescription class="ml-21px flex text-xs">
          {{ item.description || '' }}
        </ToastDescription>
        <!-- <slot /> -->
        <ToastClose class="absolute right-2 top-2 cursor-pointer">
          <div i-ri-close-fill />
        </ToastClose>
      </ToastRoot>
      <ToastViewport class="ToastViewport" />
    </ToastProvider>
  </div>
</template>

<style lang="scss">
/* reset */
button {
  all: unset;
}

.ToastViewport {
  --viewport-padding: 10px;
  position: fixed;
  bottom: 0;
  right: 0;
  display: flex;
  flex-direction: column;
  padding: var(--viewport-padding);
  gap: 10px;
  width: 350px;
  max-width: 100vw;
  margin: 0;
  list-style: none;
  z-index: 2147483647;
  outline: none;
}

.ToastRoot {
  color: white;
  border-radius: 6px;
  box-shadow:
    hsl(206 22% 7% / 35%) 0px 10px 38px -10px,
    hsl(206 22% 7% / 20%) 0px 10px 20px -15px;
  padding: 12px;
}

.ToastRoot[data-state='open'] {
  animation: slideIn 150ms cubic-bezier(0.16, 1, 0.3, 1);
}
.ToastRoot[data-state='closed'] {
  animation: hide 100ms ease-in;
}
.ToastRoot[data-swipe='move'] {
  transform: translateX(var(--radix-toast-swipe-move-x));
}
.ToastRoot[data-swipe='cancel'] {
  transform: translateX(0);
  transition: transform 200ms ease-out;
}
.ToastRoot[data-swipe='end'] {
  animation: swipeOut 100ms ease-out;
}

@keyframes hide {
  from {
    opacity: 1;
  }
  to {
    opacity: 0;
  }
}

@keyframes slideIn {
  from {
    transform: translateX(calc(100% + var(--viewport-padding)));
  }
  to {
    transform: translateX(0);
  }
}

@keyframes swipeOut {
  from {
    transform: translateX(var(--radix-toast-swipe-end-x));
  }
  to {
    transform: translateX(calc(100% + var(--viewport-padding)));
  }
}

.ToastTitle {
  grid-area: title;
  margin-bottom: 5px;
  font-weight: 500;
  color: var(--slate-12);
  font-size: 14px;
}

.ToastDescription {
  grid-area: description;
  margin: 0;
  color: var(--slate-11);
  font-size: 12px;
  line-height: 1.3;
}

.ToastAction {
  grid-area: action;
}
</style>
