<script setup lang="ts">
import GameControlHint from './GameControlHint.vue'

defineOptions({ inheritAttrs: false })
defineProps<{ label: string, description?: string }>()
</script>

<template>
  <GameControlHint :label="label" :description="description">
    <button v-bind="$attrs" type="button" class="game-icon-button" :aria-label="label">
      <span class="game-icon" aria-hidden="true"><slot /></span>
    </button>
  </GameControlHint>
</template>

<style lang="scss" scoped>
@use '../../styles/control-button.scss' as control;

.game-icon-button {
  @include control.feedback(rgb(16 19 23 / 48%), rgb(16 19 23 / 65%));
  box-sizing: border-box;
  display: inline-flex;
  width: var(--adv-toolbar-target, 44px);
  height: var(--adv-toolbar-target, 44px);
  flex: none;
  align-items: center;
  justify-content: center;
  color: var(--adv-control-color, white);
}

.game-icon {
  display: flex;
  font-size: var(--adv-toolbar-icon, 24px);
  filter: drop-shadow(0 1px 2px rgb(0 0 0 / 60%));
}
</style>
