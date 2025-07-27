<script lang="ts" setup>
/**
 * 与 dialog fix 超出屏幕不同，
 * modal 覆盖的是游戏全屏
 */

import { onKeyStroke } from '@vueuse/core'
import { onMounted } from 'vue'

withDefaults(defineProps<{
  icon?: string
  header?: string
}>(), {
  icon: '',
  header: '',
})

const emit = defineEmits(['close'])

const open = defineModel('open', {
  type: Boolean,
  default: false,
})

onMounted(() => {
  onKeyStroke('Escape', (_e) => {
    if (open.value)
      emit('close')
  })
})
</script>

<template>
  <Transition name="modal">
    <div v-if="open" class="modal-mask">
      <div class="modal-container z-9999 size-full flex flex-col">
        <AdvIconButton v-if="!header" class="modal-close-button absolute right-4 top-4" @click="emit('close')">
          <div i-ri-close-line class="text-6xl" />
        </AdvIconButton>

        <slot name="header">
          <div v-if="header" class="flex items-center justify-between">
            <h1
              class="flex items-center gap-2 p-6 font-black adv-font-serif"
              text="6xl"
            >
              <div :class="icon" />
              <span>{{ header }}</span>
            </h1>

            <AdvIconButton class="modal-close-button" @click="emit('close')">
              <div i-ri-close-line class="text-6xl" />
            </AdvIconButton>
          </div>

          <HorizontalDivider v-if="header" />
        </slot>

        <div class="modal-body w-full flex flex-grow justify-center overflow-auto">
          <slot />
        </div>
      </div>
    </div>
  </Transition>
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
  transition: all 0.2s ease;
}

.modal-container {
  /* padding: 1rem; */
  transition: all 0.2s ease;
}

.modal-close-button {
  outline: none;
}

/*
 * The following styles are auto-applied to elements with
 * transition="modal" when their visibility is toggled
 * by Vue.js.
 *
 * You can easily play with the modal transition by editing
 * these styles.
 */

.modal-enter-active,
.modal-leave-active {
  opacity: 0;
}

.modal-enter-active .modal-container {
  -webkit-transform: scale(0.9);
  transform: scale(0.9);
}

.modal-leave-active .modal-container {
  transform: translate(0, 50px);
}
</style>
