<script lang="ts" setup>
import { useAppStore } from '~/stores/app'
const app = useAppStore()
</script>

<template>
  <AdvBg />
  <AdvCanvas v-if="app.showCanvas" />
</template>
