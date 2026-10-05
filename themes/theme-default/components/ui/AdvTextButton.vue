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
  padding: 0.35rem 0.6rem 0.2rem 0.6rem;
  transition: 0.2s;
  border-bottom: 2px solid transparent;

  &:hover {
    cursor: pointer;
    border-bottom: 2px solid var(--adv-c-primary);
  }

  &.active {
    border-bottom: 2px solid var(--adv-c-primary);
    background-color: var(--adv-c-primary-light);
  }
}
</style>
