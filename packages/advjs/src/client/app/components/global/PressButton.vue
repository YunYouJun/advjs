<script setup lang="ts">
defineProps<{
  link?: string
  blank?: boolean
}>()
</script>

<template>
  <a
    class="
      press-button
      hover:no-underline
      text-white
      font-bold
      py-2
      px-4
      border-b-4
      rounded
      transform
      focus:outline-none
      active:(border-b-1
      translate-y-1)
    "
    :href="link"
    :target="blank ? '_target' : undefined"
  >
    <slot />
  </a>
</template>

<style lang="scss">
.press-button {
  display: inline-flex;
  justify-content: center;
  align-items: center;

  @apply bg-blue-500 hover:bg-blue-400 border-blue-700 hover:border-blue-500;
}
</style>
