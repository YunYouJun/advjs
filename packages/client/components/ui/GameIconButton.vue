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

<style scoped>
.game-icon-button {
  box-sizing: border-box;
  display: inline-flex;
  width: var(--adv-toolbar-target, 44px);
  height: var(--adv-toolbar-target, 44px);
  flex: none;
  align-items: center;
  justify-content: center;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: white;
  cursor: pointer;
  touch-action: manipulation;
}

.game-icon {
  display: flex;
  font-size: 24px;
  filter: drop-shadow(0 1px 3px rgb(0 0 0 / 85%));
}

.game-icon-button:hover {
  background: rgb(16 19 23 / 55%);
}

.game-icon-button:focus-visible {
  outline: 2px solid #f1d8a4;
  outline-offset: 2px;
}

.game-icon-button[aria-pressed='true'],
.game-icon-button[aria-expanded='true'] {
  color: #f1d8a4;
  border-color: #d9bd83;
  background: rgb(16 19 23 / 38%);
}

.game-icon-button:disabled {
  opacity: 0.5;
  cursor: wait;
}
</style>
