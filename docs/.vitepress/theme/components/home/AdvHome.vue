<script setup lang="ts">
import { useHomeCopy } from '../../composables/home'
import { provideHomeSkin } from '../../composables/skin'
import HomeCapabilities from './HomeCapabilities.vue'
import HomeCast from './HomeCast.vue'
import HomeEcosystem from './HomeEcosystem.vue'
import HomeFinale from './HomeFinale.vue'
import HomeHero from './HomeHero.vue'
import HomeModular from './HomeModular.vue'
import HomeScriptDemo from './HomeScriptDemo.vue'
import HomeWorkflow from './HomeWorkflow.vue'

const t = useHomeCopy()
const { skin, ready, phase, duration } = provideHomeSkin()
</script>

<template>
  <div
    class="adv-home"
    :class="{ 'is-ready': ready }"
    :data-locale="t.locale"
    :data-skin="skin"
    :data-phase="phase"
    :style="{ '--skin-phase': `${duration}ms` }"
  >
    <HomeHero />
    <HomeScriptDemo />
    <HomeCapabilities />
    <HomeWorkflow />
    <HomeModular />
    <HomeCast />
    <HomeEcosystem />
    <HomeFinale />
  </div>
</template>
