<script lang="ts" setup>
import type { AdvAst } from '@advjs/types'
import { useAdvContext } from '@advjs/client'
import { consola } from 'consola'

defineProps<{
  node: AdvAst.Choices
}>()

const { $adv } = useAdvContext()

function onChoiceClick(choice: AdvAst.Choice) {
  if (choice.do && choice.do.value) {
    $adv.$logic.handleCode(choice.do)
  }
  else if (choice.target) {
    consola.info('go to', choice.target)
    $adv.$nav.go(choice.target)
  }
  else {
    $adv.$nav.next()
  }
}
</script>

<template>
  <div
    v-if="node && node.choices && node.choices.length"
    class="adv-choice absolute items-center justify-center"
    flex="~ col"
    w="full"
    h="full"
    text="3xl"
    font="bold"
  >
    <ul class="adv-options-container">
      <li v-for="choice, i in node.choices" :key="i" class="adv-option" @click="onChoiceClick(choice)">
        {{ choice.text }}
      </li>
    </ul>
  </div>
</template>

<style lang="scss">
.adv-choice {
  .adv-options-container {
    width: 100%;

    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;

    z-index: var(--adv-options-z, 5);
  }

  .adv-option {
    cursor: pointer;

    margin: 1rem;
    padding: 1rem;
    background-color: rgba(0, 0, 0, 0.8);

    width: 50%;
    border: 1px solid white;

    @apply shadow;

    &:hover {
      @apply shadow-lg;
    }
  }
}
</style>
