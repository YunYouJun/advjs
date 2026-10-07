<script lang="ts" setup>
import { useSound } from '@advjs/client'
import { computed } from 'vue'
import { useThemeConfig } from '../../composables'

defineProps<{
  title?: string
  disabled?: boolean
}>()

const themeConfig = useThemeConfig()
const sVolume = computed(() => themeConfig.value?.audio?.volume ?? 0.5)
const popDownUrl = computed(() => themeConfig.value?.assets?.audio?.popDownUrl || '')

const popDown = useSound(popDownUrl, { volume: sVolume })
</script>

<template>
  <button type="button" class="adv-icon-button" :disabled="disabled" :title="title" :aria-label="title" @click="popDown.play()">
    <AdvIcon aria-hidden="true">
      <slot />
    </AdvIcon>
  </button>
</template>

<style lang="scss">
.adv-icon-button {
  display: inline-flex;
  justify-content: center;
  align-items: center;

  border: 0;
  color: inherit;
  background: transparent;
  font-family: inherit;
  font-size: calc(22px / var(--adv-screen-scale, 1));
  width: calc(36px / var(--adv-screen-scale, 1));
  height: calc(36px / var(--adv-screen-scale, 1));
  flex: none;
  border-radius: calc(var(--adv-control-radius, 4px) / var(--adv-screen-scale, 1));
  padding: 0;

  .adv-icon {
    font-size: inherit;
  }
  cursor: pointer;

  transition: 0.2s;

  &:hover:not(:disabled) {
    background: var(--adv-icon-button-hover-bg, rgb(123 123 123 / 20%));
  }

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}
</style>
