<script lang="ts" setup>
import { useSound } from '@advjs/core'
import { computed } from 'vue'
import { useThemeConfig } from '../../composables'

const themeConfig = useThemeConfig()
const sVolume = computed(() => themeConfig.value?.audio?.volume || 0.5)
const popDownUrl = computed(() => themeConfig.value?.assets.audio?.popDownUrl || '')

const popDown = useSound(popDownUrl, { volume: sVolume })
</script>

<template>
  <div class="adv-icon-button" @click="popDown.play()">
    <AdvIcon>
      <slot />
    </AdvIcon>
  </div>
</template>

<style lang="scss">
.adv-icon-button {
  display: inline-flex;
  justify-content: center;
  align-items: center;

  border-radius: 50%;
  padding: 0.6rem;
  cursor: pointer;

  transition: 0.2s;
  &:hover {
    background: rgba(123, 123, 123, 0.2);
  }
}
</style>
