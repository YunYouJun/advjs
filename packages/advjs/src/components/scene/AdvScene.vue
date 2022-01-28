<template>
  <AdvBg />
  <AdvCanvas v-if="app.showCanvas" />
</template>

<script lang="ts" setup>
import { useAppStore } from '~/stores/app'
const app = useAppStore()
</script>
