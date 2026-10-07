<script setup lang="ts">
import type { RuntimeChoice, RuntimeNode } from '@advjs/types'
import { useAdvContext } from '@advjs/client'
import { computed } from 'vue'
import { useAdvMotionPreference } from '../../composables/useAdvMotionPreference'

const props = defineProps<{
  node: RuntimeNode
}>()

const { $adv } = useAdvContext()
const motion = useAdvMotionPreference()
const choices = computed(() => {
  const options = props.node.data?.options
  return Array.isArray(options) ? options as unknown as RuntimeChoice[] : []
})

function choose(choice: RuntimeChoice) {
  return $adv.runtime.choose(choice.id)
}
</script>

<template>
  <div
    v-if="choices.length"
    class="adv-choice items-center justify-center absolute"
    :data-motion="motion"
    flex="~ col"
    w="full"
    h="full"
    text="4xl"
    font="bold"
  >
    <ul class="adv-options-container">
      <li v-for="choice in choices" :key="choice.id" class="adv-option-item">
        <button class="adv-option" type="button" @click="choose(choice)">
          {{ choice.label }}
        </button>
      </li>
    </ul>
  </div>
</template>

<style lang="scss" scoped>
.adv-choice {
  &.adv-choice-enter-active {
    transition: opacity 160ms ease-out;
  }

  &.adv-choice-leave-active {
    transition: opacity 80ms ease-in;
    pointer-events: none;
  }

  &.adv-choice-enter-from,
  &.adv-choice-leave-to {
    opacity: 0;
  }

  &[data-motion='reduced'] {
    &.adv-choice-enter-active,
    &.adv-choice-leave-active {
      transition-duration: 80ms;
    }
  }

  &[data-motion='none'] {
    &.adv-choice-enter-active,
    &.adv-choice-leave-active,
    .adv-option {
      transition: none;
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .adv-choice.adv-choice-enter-active,
  .adv-choice.adv-choice-leave-active,
  .adv-choice .adv-option {
    transition: none;
  }
}

.adv-options-container {
  display: flex;
  z-index: var(--adv-options-z, 5);
  width: 100%;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.adv-option-item {
  display: contents;
}

.adv-option {
  width: 50%;
  margin: 1rem;
  border: 1px solid var(--adv-choice-border, white);
  border-radius: var(--adv-choice-radius, 0);
  padding: 1rem;
  cursor: pointer;
  background-color: var(--adv-choice-bg, rgb(0 0 0 / 80%));
  color: var(--adv-choice-color, inherit);
  @apply shadow;
  transition:
    background-color 120ms ease-out,
    border-color 120ms ease-out,
    color 120ms ease-out,
    box-shadow 120ms ease-out;

  &:hover {
    background-color: var(--adv-choice-hover-bg, rgb(59 130 246 / 80%));
    @apply shadow-lg;
  }
}
</style>
