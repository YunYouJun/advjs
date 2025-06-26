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
    <div v-if="show" class="size-full flex items-center justify-center bg-white">
      <div i-svg-spinners:3-dots-scale class="text-4xl" />
    </div>
  </Transition>
</template>
