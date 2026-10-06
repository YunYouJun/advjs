<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import { computed } from 'vue'
import { useCharacterVisualReferences } from '../../composables/useCharacterVisualReferences'

const props = defineProps<{ character: AdvCharacter }>()
const projectStore = useProjectStore()
const variants = computed(() => Object.entries(props.character.avatars ?? {}).map(([status, portrait]) => ({
  status,
  path: portrait.src,
  description: portrait.label || status,
})))
const { previews } = useCharacterVisualReferences(
  () => variants.value,
  () => projectStore.workspace,
)
</script>

<template>
  <section v-if="variants.length" class="character-avatar-panel">
    <h3 class="text-sm font-bold mb-2 op-60">
      {{ $t('characters.detail.avatars') }} ({{ variants.length }})
    </h3>
    <div class="flex flex-wrap gap-2">
      <figure v-for="(portrait, index) in variants" :key="portrait.status" class="portrait-variant m-0 p-2 flex flex-col gap-1 items-center">
        <a v-if="previews[index]?.src" :href="previews[index]?.src" target="_blank" rel="noopener noreferrer">
          <img :src="previews[index]?.src" :alt="`${character.name} · ${portrait.description}`" class="rounded size-18 object-cover">
        </a>
        <p v-else-if="previews[index]?.error" class="text-xs text-amber-500 max-w-32" role="status">
          {{ previews[index]?.error }}
        </p>
        <p v-else class="text-xs op-60" role="status">
          {{ $t('characters.visual.loading') }}
        </p>
        <figcaption class="text-xs text-center">
          {{ portrait.description }}
          <code class="mt-1 op-60 block">{{ portrait.status }}</code>
        </figcaption>
      </figure>
    </div>
  </section>
</template>

<style scoped>
.portrait-variant {
  background: var(--agui-c-bg-soft);
  border: 1px solid var(--agui-c-divider-light);
}
</style>
