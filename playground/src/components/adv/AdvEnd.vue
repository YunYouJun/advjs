<script setup lang="ts">
const playStore = usePlayStore()
</script>

<template>
  <AdvOverlay>
    <div class="flex flex-col gap-10">
      <div>- END -</div>

      <!-- restart -->
      <PominisBtn class="text-4xl text-white" @click="playStore.restartGame">
        Restart Game
      </PominisBtn>
    </div>
  </AdvOverlay>
</template>
