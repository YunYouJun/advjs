<script lang="ts" setup>
import { useAppStore } from '@advjs/client'

const app = useAppStore()

function onClick() {
  app.rotate()
}
</script>

<template>
  <AdvIconButton @click="onClick()">
    <div i-ri-clockwise-line />
  </AdvIconButton>
</template>
