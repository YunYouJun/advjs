<script setup lang="ts">
import { useAppStore } from '@advjs/client'
import AdvModal from './AdvModal.vue'

const app = useAppStore()
</script>

<template>
  <AdvModal v-model:open="app.showGlossary" :header="app.glossaryTerm?.identifier" @click.stop>
    <p class="adv-glossary-definition">
      {{ app.glossaryTerm?.definition }}
    </p>
  </AdvModal>
</template>

<style scoped>
.adv-glossary-definition {
  max-width: 48em;
  padding: 1em;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-family: var(--adv-font-family, inherit);
  font-size: calc(20px / var(--adv-screen-scale, 1));
  line-height: 1.6;
}
</style>
