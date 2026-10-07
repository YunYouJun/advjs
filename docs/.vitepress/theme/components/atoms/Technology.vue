<script setup lang="ts">
defineProps<{
  title: string
  link: string
}>()
</script>

<template>
  <a
    class="m-2 p-2 border-2 border-gray-500 border-opacity-10 rounded-lg inline-flex flex-col w-22 cursor-pointer transition-all duration-500 items-center justify-center hover:(no-underline shadow-lg) dark:hover:(bg-gray-400 bg-opacity-10)"
    :href="link"
    target="_blank"
  >
    <div class="text-2xl inline-flex block items-center justify-center !m-auto">
      <slot name="icon" />
    </div>
    <div class="text-xs font-bold mt-2 inline-flex">
      {{ title }}
    </div>
  </a>
</template>
