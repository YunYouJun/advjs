<script lang="ts" setup>
import { defineAsyncComponent } from 'vue'
import { useAdvCtx, useAppStore } from '@advjs/client'

const app = useAppStore()

const $adv = useAdvCtx()

// dynamic import AdvCanvas
const AdvCanvas = $adv.config.features.babylon
  ? defineAsyncComponent(() => import('../babylon/AdvCanvas.vue'))
  : () => null
</script>

<template>
  <AdvBg />
  <AdvCanvas v-if="app.showCanvas" />
</template>
