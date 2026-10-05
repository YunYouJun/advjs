<script setup lang="ts">
import type { RuntimeChoice, RuntimeNode } from '@advjs/types'
import { useAdvContext } from '@advjs/client'
import { computed } from 'vue'

const props = defineProps<{
  node: RuntimeNode
}>()

const { $adv } = useAdvContext()
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
  @apply shadow transition-all duration-200 ease-in-out;

  &:hover {
    background-color: var(--adv-choice-hover-bg, rgb(59 130 246 / 80%));
    @apply shadow-lg;
  }
}
</style>
