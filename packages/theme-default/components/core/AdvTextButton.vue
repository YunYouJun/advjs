<script lang="ts" setup>
defineProps<{
  active?: boolean
}>()

const emit = defineEmits(['click'])

const onClick = (event: Event) => {
  emit('click', event)
}
</script>

<template>
  <button class="adv-text-button" :class="active && 'active'" @click="onClick">
    <slot />
  </button>
</template>

<style lang="scss">
@use "sass:map";
@use "@advjs/theme-default/styles/vars.scss" as *;

.adv-text-button {
  padding: 0.35rem 0.6rem 0.2rem 0.6rem;
  transition: 0.2s;
  border-bottom: 2px solid transparent;
  @apply text-xl;

  &:hover {
    cursor: pointer;
    border-bottom: 2px solid map.get($adv-colors, 'primary');
  }

  &.active {
    border-bottom: 2px solid map.get($adv-colors, 'primary');
    background-color: rgba(map.get($adv-colors, 'primary'), 0.1);
  }
}
</style>
