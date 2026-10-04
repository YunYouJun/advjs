<script setup lang="ts">
defineProps<{ label: string }>()
</script>

<template>
  <button type="button" class="game-icon-button" :aria-label="label" :title="label">
    <span class="game-icon" aria-hidden="true"><slot /></span>
  </button>
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
  border: 1px solid rgb(255 255 255 / 18%);
  border-radius: 8px;
  background: rgb(16 19 23 / 62%);
  color: white;
  cursor: pointer;
  touch-action: manipulation;
}

.game-icon {
  display: flex;
  font-size: 20px;
}

.game-icon-button:hover {
  background: rgb(16 19 23 / 85%);
}

.game-icon-button:focus-visible {
  outline: 2px solid #f1d8a4;
  outline-offset: 2px;
}

.game-icon-button[aria-pressed='true'],
.game-icon-button[aria-expanded='true'] {
  color: #f1d8a4;
  border-color: #d9bd83;
}

.game-icon-button:disabled {
  opacity: 0.5;
  cursor: wait;
}
</style>
