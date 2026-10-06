<script setup lang="ts">
import type { ToolbarItem } from '@advjs/gui'

const { t } = useI18n()
const cStore = useCharacterStore()
const app = useAppStore()

const localSearch = ref('')

const filteredCharacters = computed(() => {
  const query = localSearch.value.trim().toLowerCase()
  if (!query)
    return cStore.characters

  return cStore.characters.filter((c) => {
    return c.name.toLowerCase().includes(query)
      || c.id.toLowerCase().includes(query)
      || c.faction?.toLowerCase().includes(query)
  })
})

function selectCharacter(character: typeof cStore.characters[number]) {
  cStore.selectedCharacter = character
  // Get file handle if available
  const entry = cStore.fileEntries.get(character.id)
  cStore.selectedCharacterHandle = entry?.fileHandle
  app.activeInspector = 'character'
}

function createNewCharacter() {
  app.activeInspector = 'character-create'
}

function openDirectory() {
  cStore.openDirectory()
}
const toolbarItems = computed<ToolbarItem[]>(() => [
  { type: 'button', icon: 'i-ri-add-line', title: t('characters.createNew'), onClick: createNewCharacter },
  { type: 'button', icon: 'i-ri-folder-open-line', title: t('characters.openDir'), onClick: openDirectory },
])
</script>

<template>
  <div class="ae-resource-panel flex flex-col h-full">
    <AGUIToolbar :items="toolbarItems" :label="$t('characters.title')">
      <template #before-toolbar>
        <AGUIInput v-model="localSearch" class="flex-1 min-w-0" :aria-label="$t('characters.search')" :placeholder="$t('characters.search')" />
      </template>
      <template #after-toolbar>
        <AGUIIconButton icon="i-ri-refresh-line" :title="$t('characters.refresh')" :disabled="cStore.loading" @click="cStore.dirHandle ? cStore.fetchCharactersFromHandle() : cStore.fetchCharacters()" />
      </template>
    </AGUIToolbar>
    <div class="flex-1 overflow-auto">
      <div v-if="!cStore.characters.length && !cStore.loading" class="ae-resource-empty">
        <p>{{ $t('characters.emptyHint') }}</p>
        <AGUIButton icon="i-ri-add-line" @click="createNewCharacter">
          {{ $t('characters.createNew') }}
        </AGUIButton>
      </div>
      <CharacterList v-else :characters="filteredCharacters" :loading="cStore.loading" :selected="cStore.selectedCharacter?.id" initial-view="list" @select="selectCharacter" />
    </div>
  </div>
</template>
