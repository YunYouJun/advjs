<script setup lang="ts">
import { resolveSceneBackground, useAdvContext, useAppStore } from '@advjs/client'
import { computed, watch } from 'vue'

const { $adv } = useAdvContext()
const app = useAppStore()
const background = computed(() => $adv.store.state.stage.background)
const backgroundSource = computed(() => resolveSceneBackground(
  background.value,
  $adv.gameConfig.value.scenes,
))
const advGameStyle = computed(() => ({
  backgroundImage: `url("${backgroundSource.value}")`,
}))

watch(background, (value, previous) => {
  if (!value || value === previous)
    return
  if (app.showBg)
    app.toggleBg()
  setTimeout(() => app.toggleBg(), 200)
}, { immediate: true })
</script>

<template>
  <Transition enter-active-class="animate-fade-in" leave-active-class="animate-fade-out">
    <div
      v-if="app.showBg && background"
      class="adv-background absolute animate-duration-200"
      h="full"
      w="full"
      bg="cover center no-repeat"
      :style="advGameStyle"
    />
  </Transition>
</template>

<style scoped>
.adv-background {
  background-position: center;
  background-size: cover;
}
</style>
