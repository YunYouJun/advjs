<script lang="ts" setup>
import { useGameStore } from '../../stores'

const gameStore = useGameStore()
</script>

<template>
  <Transition name="fade">
    <div
      v-if="gameStore.isLoading"
      w="full"
      class="bg-black/80 size-full"
      flex="~" justify="center" items="center"
      z="99999"
    >
      <div i-svg-spinners:blocks-shuffle-2 class="text-8xl" />
    </div>
  </Transition>
</template>
