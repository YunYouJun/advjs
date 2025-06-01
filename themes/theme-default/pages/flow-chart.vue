<script setup lang="ts">
/* these are necessary styles for vue flow */
import '@vue-flow/core/dist/style.css'
/* this contains the default theme, these are optional styles */
import '@vue-flow/core/dist/theme-default.css'
</script>

<template>
  <div class="size-full overflow-hidden">
    <div class="absolute left-0 top-0 z-10 w-full bg-white/10 backdrop-blur-sm">
      <BaseHeader />
    </div>
    <AdvFlowChart />
  </div>
</template>

<route lang="yaml">
meta:
  layout: empty
</route>
