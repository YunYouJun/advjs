<script lang="ts" setup>
import { onMounted } from 'vue'
import { onKeyStroke } from '@vueuse/core'

const props = withDefaults(defineProps<{
  show?: boolean
  header?: string
}>(), {
  show: false,
  header: '',
})

const emit = defineEmits(['close'])

onMounted(() => {
  onKeyStroke('Escape', (e) => {
    if (props.show)
      emit('close')
  })
})
</script>

<template>
  <transition name="modal">
    <div v-if="show" class="modal-mask">
      <div class="modal-container">
        <AdvIconButton class="modal-close-button" @click="emit('close')">
          <i-ri-close-line />
        </AdvIconButton>
        <slot name="header">
          <template v-if="header">
            <h1
              class="adv-font-serif font-black mt-2"
              text="4xl"
            >
              {{ header }}
            </h1>
            <HorizontalDivider />
          </template>
        </slot>

        <div class="modal-body" :h="header ? '15/17' : 'full'">
          <slot />
        </div>
      </div>
    </div>
  </transition>
</template>

<style>
.modal-mask {
  color: var(--adv-c-text);
  position: fixed;
  z-index: 1000;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  backdrop-filter: blur(30px);
  background-color: var(--adv-modal-bg-color);
  transition: all 0.2s ease;
}

.modal-container {
  width: 100%;
  height: 100%;
  padding: 1rem;
  transition: all 0.2s ease;
}

.modal-close-button {
  position: absolute;
  top: 1rem;
  right: 1rem;
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

.modal-enter-active .modal-container{
  -webkit-transform: scale(0.9);
  transform: scale(0.9);
}

.modal-leave-active .modal-container {
  transform: translate(0, 50px);
}
</style>
