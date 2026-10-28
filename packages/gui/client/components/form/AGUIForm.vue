<script setup lang="ts">
withDefaults(defineProps<{
  as?: string
  padded?: boolean
}>(), { as: 'div' })
</script>

<template>
  <component :is="as" class="agui-form" :class="{ 'agui-form--padded': padded }">
    <slot />
  </component>
</template>

<style lang="scss">
.agui-form {
  display: grid;
  align-content: start;
  gap: var(--agui-form-row-gap);
  min-width: 0;
  container: agui-properties / inline-size;
  color: var(--agui-c-text-1);

  &--padded {
    padding: var(--agui-space-2);
  }

  > .agui-button,
  > .agui-icon-button {
    justify-self: start;
    max-width: 100%;
  }
}

// Reset native fieldsets without overriding callers' spacing and divider utilities.
:where(.agui-form) {
  margin: 0;
  padding: 0;
  border: 0;
}
</style>
