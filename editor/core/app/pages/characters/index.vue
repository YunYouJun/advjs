<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import type { FileTreeNode } from '~/stores/useCharacterStore'
import { Toast } from '@advjs/gui'

definePageMeta({
  layout: 'default',
})

const { t, locale } = useI18n()
const cStore = useCharacterStore()
const router = useRouter()

const showCreateDialog = ref(false)
const directoryDraft = ref(cStore.charactersDir)

// Selected tree node for highlighting
const selectedTreeNode = ref<string>()

onMounted(() => {
  if (cStore.charactersDir && !cStore.dirHandle) {
    cStore.fetchCharacters()
  }
})

function onSelectCharacter(character: AdvCharacter) {
  cStore.selectedCharacter = character
  router.push(`/characters/${character.id}`)
}

async function onCreateCharacter(data: Partial<AdvCharacter>) {
  await cStore.createCharacter(data)
  showCreateDialog.value = false
  Toast({ title: t('characters.created'), type: 'success' })
}

function onConnectDir() {
  cStore.charactersDir = directoryDraft.value.trim()
  if (cStore.charactersDir) {
    cStore.fetchCharacters()
    Toast({ title: t('characters.connectedToDir'), type: 'success' })
  }
}

async function onOpenDirectory() {
  await cStore.openDirectory()
}

function onTreeNodeClick(node: FileTreeNode) {
  if (node.kind === 'file' && node.characterId) {
    selectedTreeNode.value = node.path
    const character = cStore.characters.find(c => c.id === node.characterId)
    if (character) {
      onSelectCharacter(character)
    }
  }
}

function toggleLocale() {
  locale.value = locale.value === 'en' ? 'zh-CN' : 'en'
}

const hasSource = computed(() => !!cStore.dirHandle || !!cStore.charactersDir)
</script>

<template>
  <div class="ae-resource-panel character-page">
    <AGUIToolbar :items="[]" :label="$t('characters.title')">
      <template #before-toolbar>
        <NuxtLink to="/" class="agui-button" :aria-label="$t('characters.back')">
          <span class="i-ri-arrow-left-line" aria-hidden="true" />
        </NuxtLink>
        <h1>{{ $t('characters.title') }}</h1>
      </template>
      <template #after-toolbar>
        <AGUIInput v-model="cStore.searchQuery" :aria-label="$t('characters.search')" :placeholder="$t('characters.search')" class="character-search" />
        <AGUIButton icon="i-ri-add-line" @click="showCreateDialog = true">
          {{ $t('characters.newCharacter') }}
        </AGUIButton>
        <AGUIIconButton icon="i-ri-refresh-line" :title="$t('characters.refresh')" :disabled="cStore.loading" @click="cStore.dirHandle ? cStore.fetchCharactersFromHandle() : cStore.fetchCharacters()" />
        <AGUIButton icon="i-ri-global-line" @click="toggleLocale">
          {{ locale === 'en' ? 'EN' : '中' }}
        </AGUIButton>
      </template>
    </AGUIToolbar>
    <div class="character-workspace">
      <aside>
        <template v-if="cStore.dirHandle">
          <div class="ae-resource-row">
            {{ cStore.dirHandle.name }}
          </div>
          <CharacterFileTree :nodes="cStore.fileTree" :selected="selectedTreeNode" @select="onTreeNodeClick" />
        </template>
        <div v-else class="ae-resource-empty">
          <AGUIButton icon="i-ri-folder-open-line" @click="onOpenDirectory">
            {{ $t('characters.openLocalDir') }}
          </AGUIButton>
          <p>{{ $t('characters.dirHint') }}</p>
        </div>
      </aside>
      <main>
        <form v-if="!hasSource" class="directory-form" @submit.prevent="onConnectDir">
          <label for="characters-directory">{{ $t('characters.dirHint') }}</label>
          <AGUIInput id="characters-directory" v-model="directoryDraft" :placeholder="$t('characters.dirPlaceholder')" />
          <div class="ae-resource-actions">
            <AGUIButton type="submit" :disabled="!directoryDraft.trim()">
              {{ $t('characters.connect') }}
            </AGUIButton>
          </div>
          <p class="ae-resource-caption">
            {{ $t('characters.examplePaths') }} ./demo/flow/adv/characters
          </p>
        </form>
        <CharacterList v-else :characters="cStore.filteredCharacters" :loading="cStore.loading" @select="onSelectCharacter" />
      </main>
    </div>
    <AGUIDialog v-model:open="showCreateDialog" :title="$t('characters.newCharacter')" content-class="w-lg max-h-[80vh]">
      <CharacterForm mode="create" @submit="onCreateCharacter" @cancel="showCreateDialog = false" />
    </AGUIDialog>
  </div>
</template>

<style scoped>
.character-page {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  container: character-page / inline-size;
}
h1 {
  margin: 0;
  font-size: 13px;
  font-weight: 500;
}
.character-search {
  flex: 1;
  min-width: 120px;
}
.character-workspace {
  display: grid;
  grid-template-columns: minmax(160px, 220px) minmax(0, 1fr);
  flex: 1;
  min-height: 0;
}
aside {
  border-right: 1px solid var(--agui-c-divider);
}
aside,
main {
  overflow: auto;
  min-width: 0;
}
.directory-form {
  max-width: 560px;
  padding: 12px;
}
.directory-form label {
  display: block;
  margin-bottom: 8px;
}
@container character-page (max-width: 560px) {
  .character-workspace {
    grid-template-columns: minmax(0, 1fr);
    grid-template-rows: auto 1fr;
  }
  aside {
    max-height: 160px;
    border-right: 0;
    border-bottom: 1px solid var(--agui-c-divider);
  }
}
</style>
