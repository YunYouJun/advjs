<script setup lang="ts">
/* these are necessary styles for vue flow */
import '@vue-flow/core/dist/style.css'
/* this contains the default theme, these are optional styles */
import '@vue-flow/core/dist/theme-default.css'
</script>

<template>
  <!-- BaseHeader reads the game color mode, which the empty layout does not provide. -->
  <AdvThemeScope class="adv-route-page size-full overflow-hidden">
    <BaseHeader />
    <AdvFlowChart />
  </AdvThemeScope>
</template>

<route lang="yaml">
meta:
  layout: empty
</route>

<style scoped>
.adv-route-page {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
}
</style>
