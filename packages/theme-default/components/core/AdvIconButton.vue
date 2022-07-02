<script lang="ts" setup>
import { useAudioStore } from '@advjs/client/stores/audio'
const audio = useAudioStore()
</script>

<template>
  <div class="adv-icon-button" @click="audio.popDown.play()">
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
