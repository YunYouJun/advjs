<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import { ref } from 'vue'

const props = withDefaults(defineProps<{
  characters: AdvCharacter[]
  loading?: boolean
  selected?: string
  initialView?: 'grid' | 'list'
}>(), { initialView: 'grid' })

defineEmits<{ select: [character: AdvCharacter] }>()
const viewMode = ref(props.initialView)
</script>

<template>
  <div class="ae-resource-panel">
    <AGUIToolbar :items="[]" :label="$t('characters.view')">
      <template #before-toolbar>
        <span>{{ characters.length }} {{ $t('characters.title') }}</span>
      </template>
      <template #after-toolbar>
        <span class="flex-1" />
        <AGUIIconButton icon="i-ri-grid-line" :title="$t('characters.grid')" :active="viewMode === 'grid'" @click="viewMode = 'grid'" />
        <AGUIIconButton icon="i-ri-list-unordered" :title="$t('characters.list')" :active="viewMode === 'list'" @click="viewMode = 'list'" />
      </template>
    </AGUIToolbar>
    <p v-if="loading" class="ae-resource-empty" role="status">
      {{ $t('characters.loading') }}
    </p>
    <p v-else-if="!characters.length" class="ae-resource-empty" role="status">
      {{ $t('characters.noCharacters') }}
    </p>
    <ul v-else class="character-items" :class="viewMode">
      <li v-for="character in characters" :key="character.id">
        <CharacterCard :character="character" :mode="viewMode" :selected="selected ? selected === character.id : undefined" @click="$emit('select', character)" />
      </li>
    </ul>
  </div>
</template>

<style scoped>
.character-items {
  display: grid;
  gap: 4px;
  padding: 6px;
  margin: 0;
  list-style: none;
}
.character-items.grid {
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 120px), 1fr));
}
.character-items li {
  min-width: 0;
}
</style>
