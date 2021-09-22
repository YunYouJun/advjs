<template>
  <div class="col-span-4 text-right adv-menu-item">
    <label for="speechSynthesisSwitch">是否全屏</label>
  </div>
  <div class="col-span-8 text-left">
    <!-- 3rem -->
    <span @click="settings.toggleFullScreen">
      <ri-checkbox-line v-if="settings.fullScreen" />
      <ri-checkbox-blank-line v-else />
    </span>
  </div>
</template>

<script setup lang="ts">
import { useSettingsStore } from '~/stores/settings'
const settings = useSettingsStore()
</script>
