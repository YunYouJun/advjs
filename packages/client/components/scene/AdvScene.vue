<script lang="ts" setup>
import { defineAsyncComponent } from 'vue'
import { useAdvCtx, useAppStore } from '@advjs/client'

const app = useAppStore()

const $adv = useAdvCtx()

// dynamic import AdvCanvas
const AdvBabylonCanvas = $adv.config.features.babylon
  ? defineAsyncComponent(() => import('@advjs/plugin-babylon/components/AdvBabylonCanvas.vue'))
  : () => null
</script>

<template>
  <AdvBg />
  <AdvBabylonCanvas v-if="app.showCanvas" />
</template>
