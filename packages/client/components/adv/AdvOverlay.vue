<script setup lang="ts">
// overlay
</script>

<template>
  <div class="absolute bottom-0 left-0 right-0 top-0 z-50 animate-duration-200">
    <div class="h-full w-full flex items-center justify-center bg-black/60 text-8xl font-bold">
      <slot />
    </div>
  </div>
</template>
