<script setup lang="ts">
// overlay
</script>

<template>
  <div class="bottom-0 left-0 right-0 top-0 absolute z-50 animate-duration-200">
    <div class="text-8xl font-bold bg-black/60 flex h-full w-full items-center justify-center">
      <slot />
    </div>
  </div>
</template>
