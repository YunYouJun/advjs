<script setup lang="ts">
import { useAdvConfig } from '../composables'

const advConfig = useAdvConfig()
</script>

<template>
  <AdvGame :config="advConfig" />
</template>
