<script setup lang="ts">
import { ref } from 'vue'
import { useParallax } from '@vueuse/core'

const target = ref(null)
const parallax = useParallax(target)
</script>

<template>
  <main ref="target" class="home" aria-labelledby="main-title">
    <HomeHero :parallax="parallax" />
    <slot name="hero" />
    <HomeFeatures />
    <div class="home-content">
      <Content />
    </div>
    <slot name="features" />
    <HomeFooter />
    <slot name="footer" />
  </main>
</template>

<style scoped>
.home {
  padding-top: var(--header-height);
}

.home-content {
  max-width: 960px;
  margin: 0px auto;
  padding: 0 1.5rem;
}
</style>
