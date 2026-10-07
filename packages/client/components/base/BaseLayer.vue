<script setup lang="ts">
import { useAppStore } from '@advjs/client'
import { useGameControlsI18n } from '../../composables/useGameControlsI18n'

const app = useAppStore()
const { t } = useGameControlsI18n()
</script>

<template>
  <button type="button" class="hide-ui-layer" :aria-label="t('controls.restore')" @click.stop="app.toggleUi()" />
</template>

<style>
.hide-ui-layer {
  z-index: 9999;
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  bottom: 0;
  border: 0;
  background: transparent;
  cursor: pointer;
}
</style>
