<script lang="ts" setup>
defineProps<{
  active?: boolean
}>()

const emit = defineEmits(['click'])

function onClick(event: Event) {
  emit('click', event)
}
</script>

<template>
  <button type="button" class="adv-text-button" :class="active && 'active'" @click="onClick">
    <slot />
  </button>
</template>

<style lang="scss">
.adv-text-button {
  min-height: 2.25em;
  padding: 0.35em 0.625em;
  color: inherit;
  font: inherit;
  line-height: 1.4;
  border-radius: calc(var(--adv-control-radius, 4px) / var(--adv-screen-scale, 1));
  transition: 0.2s;
  border-bottom: 2px solid transparent;

  &:hover {
    cursor: pointer;
    border-bottom: 2px solid var(--adv-c-primary);
  }

  &:focus-visible {
    outline: 2px solid var(--adv-c-focus, var(--adv-c-primary));
    outline-offset: 2px;
  }

  &.active {
    border-bottom: 2px solid var(--adv-c-primary);
    background-color: var(--adv-control-active-bg, color-mix(in srgb, var(--adv-c-primary) 12%, transparent));
  }
}
</style>
