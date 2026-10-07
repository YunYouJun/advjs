<script setup lang="ts">
const show = defineModel('show', {
  type: Boolean,
  default: false,
})
</script>

<template>
  <Transition
    class="animate-duration-200"
    enter-active-class="animate-fade-in"
    leave-active-class="animate-fade-out"
  >
    <div v-if="show" class="text-$agui-c-text-1 bg-$agui-c-bg-panel flex size-full items-center justify-center">
      <div i-svg-spinners:3-dots-scale class="text-4xl" />
    </div>
  </Transition>
</template>
