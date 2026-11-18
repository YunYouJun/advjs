<script setup lang="ts">
import { useHomeSkin } from '../../composables/skin'
import { skinComponents } from './data/skin-components'
import HomeSkinSwitcher from './HomeSkinSwitcher.vue'
import HomeTransitionCue from './HomeTransitionCue.vue'

const { skin } = useHomeSkin()
</script>

<template>
  <section class="hero" aria-label="ADV.JS">
    <HomeSkinSwitcher class="switcher" />
    <div class="slot">
      <component :is="skinComponents[skin].hero" class="h-skinned h-stage" />
      <HomeTransitionCue />
    </div>
  </section>
</template>

<style scoped>
.hero {
  box-sizing: border-box;
  max-width: calc(1400px + var(--h-gutter) * 2);
  margin: 0 auto;
  padding: 8px var(--h-gutter) 0;
}

.switcher {
  margin-bottom: 12px;
}

.slot {
  position: relative;
}
</style>
