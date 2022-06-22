<script setup lang="ts">
// @ts-expect-error virtual module
import Drama from '/@advjs/drama'
</script>

<template>
  <Drama />
</template>

<route lang="yaml">
meta:
  layout: adv
</route>
