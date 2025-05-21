<script lang="ts" setup>
import { onKeyStroke } from '@vueuse/core'
import { onMounted } from 'vue'

const props = withDefaults(defineProps<{
  show?: boolean
  header?: string
}>(), {
  show: false,
  header: '',
})

const emit = defineEmits(['close'])

onMounted(() => {
  onKeyStroke('Escape', (_e) => {
    if (props.show)
      emit('close')
  })
})
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="modal-mask">
      <div class="modal-container">
        <AdvIconButton class="modal-close-button" @click="emit('close')">
          <div i-ri-close-line />
        </AdvIconButton>
        <slot name="header">
          <template v-if="header">
            <h1
              class="adv-font-serif my-4 font-medium"
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
  backdrop-filter: blur(30px);
  background-color: var(--adv-modal-bg-color);
  transition: all 0.2s ease;
}

.modal-container {
  width: 100%;
  height: 100%;
  /* padding: 1rem; */
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

.modal-enter-active .modal-container {
  -webkit-transform: scale(0.9);
  transform: scale(0.9);
}

.modal-leave-active .modal-container {
  transform: translate(0, 50px);
}
</style>
