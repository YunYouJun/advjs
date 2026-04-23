<script setup lang="ts">
defineProps<{
  label?: string
  error?: string
  hint?: string
}>()
</script>

<template>
  <div class="s-form-field" :class="{ 's-form-field--error': error }">
    <label v-if="label" class="s-form-field__label">{{ label }}</label>
    <div class="s-form-field__control">
      <slot />
    </div>
    <p v-if="error" class="s-form-field__error">
      {{ error }}
    </p>
    <p v-else-if="hint" class="s-form-field__hint">
      {{ hint }}
    </p>
  </div>
</template>

<style scoped>
.s-form-field {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-xs);
}

.s-form-field__label {
  font-size: var(--adv-font-body-sm);
  font-weight: 600;
  color: var(--adv-text-secondary);
}

.s-form-field__control {
  display: flex;
  gap: var(--adv-space-sm);
  align-items: center;
}

.s-form-field__error {
  font-size: var(--adv-font-caption);
  color: var(--ion-color-danger, #ef4444);
  margin: 0;
}

.s-form-field__hint {
  font-size: var(--adv-font-caption);
  color: var(--adv-text-tertiary);
  margin: 0;
}

/* Error state — tint control border */
.s-form-field--error :deep(.s-input) {
  border-color: var(--ion-color-danger, #ef4444);
}

.s-form-field--error :deep(.s-input:focus-within) {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.12);
}
</style>
