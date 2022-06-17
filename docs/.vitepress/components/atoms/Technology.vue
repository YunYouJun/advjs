<script setup lang="ts">
defineProps<{
  title: string
  link: string
}>()
</script>

<template>
  <a
    class="
      m-2
      inline-flex
      flex-col
      justify-center
      items-center
      border-2 border-gray-500 border-opacity-10
      rounded-lg
      p-2
      w-22
      transition-all
      duration-500
      cursor-pointer
      hover:(shadow-lg
      no-underline)
      dark:hover:(bg-gray-400
      bg-opacity-10)
    "
    :href="link"
    target="_blank"
  >
    <div class="!m-auto text-2xl block inline-flex justify-center items-center">
      <slot name="icon" />
    </div>
    <div class="inline-flex mt-2 font-bold text-xs">
      {{ title }}
    </div>
  </a>
</template>
