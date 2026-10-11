<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import { CharacterAvatarsSchema } from '@advjs/parser'
import { computed } from 'vue'
import { useCharacterVisualReferences } from '../../composables/useCharacterVisualReferences'

const props = defineProps<{ character: AdvCharacter }>()
const projectStore = useProjectStore()
const variants = computed(() => {
  const parsed = CharacterAvatarsSchema.safeParse(props.character.avatars)
  return Object.entries(parsed.success ? parsed.data : {}).map(([status, portrait]) => ({
    status,
    path: portrait.src,
    description: portrait.label || status,
  }))
})
const { previews } = useCharacterVisualReferences(
  () => variants.value,
  () => projectStore.workspace,
  () => projectStore.resourceRevision,
)
</script>

<template>
  <section v-if="variants.length" class="character-avatar-panel">
    <div class="flex flex-wrap gap-2">
      <figure v-for="(portrait, index) in variants" :key="portrait.status" class="portrait-variant m-0 p-2 flex flex-col gap-1 items-center">
        <a v-if="previews[index]?.src" :href="previews[index]?.src" target="_blank" rel="noopener noreferrer">
          <img :src="previews[index]?.src" :alt="`${character.name} · ${portrait.description}`" class="rounded size-18 object-cover">
        </a>
        <p v-else-if="previews[index]?.error" class="ae-resource-error text-xs max-w-32" role="status">
          {{ previews[index]?.error }}
        </p>
        <p v-else class="character-muted text-xs" role="status">
          {{ $t('characters.visual.loading') }}
        </p>
        <figcaption class="text-xs text-center">
          {{ portrait.description }}
          <code class="character-muted mt-1 block">{{ portrait.status }}</code>
        </figcaption>
      </figure>
    </div>
  </section>
</template>

<style scoped>
.character-muted {
  color: var(--agui-c-text-2);
}
.portrait-variant {
  background: var(--agui-c-field);
  border: 1px solid var(--agui-c-divider);
}
</style>
