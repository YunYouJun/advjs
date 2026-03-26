<script setup lang="ts">
import { ToolbarRoot } from 'reka-ui'

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
  if (entry?.fileHandle) {
    cStore.selectedCharacterHandle = entry.fileHandle
  }
  app.activeInspector = 'character'
}

function createNewCharacter() {
  app.activeInspector = 'character-create'
}

function openDirectory() {
  cStore.openDirectory()
}
</script>

<template>
  <div class="h-full flex flex-col">
    <ToolbarRoot class="flex items-center gap-1 border-b border-b-dark-300 p-1">
      <AGUIInput
        v-model="localSearch"
        class="flex flex-grow"
        :placeholder="$t('characters.search')"
      />
      <AGUIIconButton
        size="mini"
        icon="i-ri-add-line"
        :title="$t('characters.createNew')"
        @click="createNewCharacter"
      />
      <AGUIIconButton
        size="mini"
        icon="i-ri-folder-open-line"
        :title="$t('characters.openDir')"
        @click="openDirectory"
      />
      <AGUIIconButton
        size="mini"
        icon="i-ri-refresh-line"
        @click="cStore.dirHandle ? cStore.fetchCharactersFromHandle() : cStore.fetchCharacters()"
      />
    </ToolbarRoot>

    <div class="flex-1 overflow-auto">
      <!-- Empty state -->
      <div v-if="!cStore.characters.length && !cStore.loading" class="flex flex-col items-center justify-center gap-3 p-4 op-50">
        <div class="i-ri-user-3-line text-2xl" />
        <span class="text-center text-xs">{{ $t('characters.emptyHint') }}</span>
        <div class="flex gap-2">
          <AGUIButton size="small" icon="i-ri-add-line" @click="createNewCharacter">
            {{ $t('characters.createNew') }}
          </AGUIButton>
          <AGUIButton size="small" icon="i-ri-folder-open-line" @click="openDirectory">
            {{ $t('characters.openDir') }}
          </AGUIButton>
        </div>
      </div>

      <!-- Loading -->
      <div v-else-if="cStore.loading" class="flex items-center justify-center p-4">
        <div class="i-svg-spinners:3-dots-scale text-2xl" />
      </div>

      <!-- Character list -->
      <div v-else>
        <div
          v-for="char in filteredCharacters"
          :key="char.id"
          class="flex cursor-pointer items-center gap-2 px-2 py-1 transition-colors hover:bg-dark-300"
          :class="cStore.selectedCharacter?.id === char.id ? 'bg-dark-300' : ''"
          @click="selectCharacter(char)"
        >
          <img
            v-if="char.avatar"
            class="size-6 rounded-full object-cover"
            :src="char.avatar"
            :alt="char.name"
          >
          <div v-else class="size-6 flex items-center justify-center rounded-full bg-dark-200">
            <div class="i-ri-user-3-line text-xs op-40" />
          </div>
          <span class="flex-1 truncate text-sm">{{ char.name }}</span>
          <AGUITag v-if="char.faction">
            {{ char.faction }}
          </AGUITag>
        </div>
      </div>
    </div>
  </div>
</template>
