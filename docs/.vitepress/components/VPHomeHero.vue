<script setup lang="ts">
import { useData } from 'vitepress'
import VPHero from './VPHero.vue'

const { frontmatter: fm } = useData()
</script>

<template>
  <div v-if="fm.adv" class="VPHomeHero">
    <VPHero
      :name="fm.adv.name"
      :text="fm.adv.text"
      :tagline="fm.adv.tagline"
      :actions="fm.adv.actions"
    />
  </div>
</template>
