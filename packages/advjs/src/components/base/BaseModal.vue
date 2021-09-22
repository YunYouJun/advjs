<template>
  <transition name="modal">
    <div class="modal-mask">
      <div class="modal-container">
        <button
          class="adv-icon-button modal-close-button"
          @click="$emit('close')"
        >
          <AdvIcon><i-ri-close-line /></AdvIcon>
        </button>
        <div class="modal-body">
          <slot name="body"></slot>
        </div>
      </div>
    </div>
  </transition>
</template>

<style>
.modal-mask {
  position: fixed;
  z-index: 1000;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  backdrop-filter: blur(30px);
  background-color: rgba(0, 0, 0, 0.6);
  transition: all 0.2s ease;
}

.modal-container {
  width: 100%;
  height: 100%;
  padding: 1rem;
  transition: all 0.2s ease;
}

.modal-body {
  color: white;
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

.modal-enter-active {
  opacity: 0;
}

.modal-leave-active {
  opacity: 0;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  -webkit-transform: scale(0.9);
  transform: scale(0.9);
}
</style>
