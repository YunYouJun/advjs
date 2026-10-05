<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import { Toast } from '@advjs/gui'
import { CharacterVisualSchema, exportCharacterVisualForAI } from '@advjs/parser'
import { useCharacterVisualReferences } from '../../composables/useCharacterVisualReferences'

const props = defineProps<{ character: AdvCharacter }>()
const projectStore = useProjectStore()
const { t } = useI18n()
const visual = computed(() => {
  const result = CharacterVisualSchema.safeParse(props.character.visual)
  return result.success ? result.data : undefined
})
const { previews } = useCharacterVisualReferences(
  () => visual.value?.references ?? [],
  () => projectStore.workspace,
)

async function copyBrief() {
  try {
    await navigator.clipboard.writeText(exportCharacterVisualForAI(props.character))
    Toast({ title: t('characters.visual.copied'), type: 'success' })
  }
  catch {
    Toast({ title: t('characters.exportFailed'), type: 'warning' })
  }
}
</script>

<template>
  <section class="character-visual-panel text-xs p-3 flex flex-col gap-3">
    <div class="flex gap-2 items-center justify-between">
      <h3 class="font-bold">
        {{ character.name }} · {{ $t('characters.visual.title') }}
      </h3>
      <AGUIButton v-if="visual || character.imagePrompt" size="mini" @click="copyBrief">
        {{ $t('characters.visual.copy') }}
      </AGUIButton>
    </div>
    <template v-if="visual">
      <div class="text-xs font-mono op-70">
        {{ visual.version }}
      </div>
      <figure v-for="(reference, index) in previews" :key="`${index}:${reference.path}`" class="character-reference m-0 p-2">
        <a v-if="reference.src" :href="reference.src" target="_blank" rel="noopener noreferrer">
          <img :src="reference.src" :alt="reference.description || character.name" class="rounded max-h-72 w-full object-contain">
        </a>
        <p v-else-if="reference.error" class="text-amber-500" role="status">
          {{ reference.error }}
        </p>
        <p v-else class="op-60" role="status">
          {{ $t('characters.visual.loading') }}
        </p>
        <figcaption class="text-xs mt-2 break-words">
          <div v-if="reference.description" class="mb-1">
            {{ reference.description }}
          </div>
          <code class="op-60">{{ reference.path }}</code>
        </figcaption>
      </figure>
      <div v-if="visual.fixedTraits?.length">
        <h4 class="font-bold mb-1">
          {{ $t('characters.visual.fixed') }}
        </h4>
        <ul class="leading-relaxed pl-4 list-disc">
          <li v-for="(trait, index) in visual.fixedTraits" :key="index">
            {{ trait }}
          </li>
        </ul>
      </div>
      <div v-if="visual.allowedChanges?.length">
        <h4 class="font-bold mb-1">
          {{ $t('characters.visual.allowed') }}
        </h4>
        <ul class="leading-relaxed pl-4 list-disc">
          <li v-for="(change, index) in visual.allowedChanges" :key="index">
            {{ change }}
          </li>
        </ul>
      </div>
    </template>
    <p v-else class="op-60">
      {{ $t('characters.visual.empty') }}
    </p>
    <details v-if="character.imagePrompt">
      <summary class="font-bold cursor-pointer">
        {{ $t('characters.visual.prompt') }}
      </summary>
      <p class="text-xs leading-relaxed mt-2 op-80 whitespace-pre-wrap">
        {{ character.imagePrompt }}
      </p>
    </details>
    <p v-if="previews.length" class="text-xs leading-relaxed op-60">
      {{ $t('characters.visual.attachmentHint') }}
    </p>
  </section>
</template>

<style scoped>
.character-visual-panel {
  color: var(--agui-c-text);
}
.character-reference {
  background: var(--agui-c-bg-soft);
  border: 1px solid var(--agui-c-divider-light);
}
</style>
