<script setup lang="ts">
defineProps<{
  title: string
  link: string
}>()
</script>

<template>
  <a
    class="m-2 w-22 inline-flex flex-col cursor-pointer items-center justify-center border-2 border-gray-500 border-opacity-10 rounded-lg p-2 transition-all duration-500 hover:(no-underline shadow-lg) dark:hover:(bg-gray-400 bg-opacity-10)"
    :href="link"
    target="_blank"
  >
    <div class="block inline-flex items-center justify-center text-2xl !m-auto">
      <slot name="icon" />
    </div>
    <div class="mt-2 inline-flex text-xs font-bold">
      {{ title }}
    </div>
  </a>
</template>
