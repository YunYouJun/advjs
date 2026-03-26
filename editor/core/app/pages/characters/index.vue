<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import type { FileTreeNode } from '~/stores/useCharacterStore'
import { Toast } from '@advjs/gui/client/composables'

definePageMeta({
  layout: 'default',
})

const { t, locale } = useI18n()
const cStore = useCharacterStore()
const router = useRouter()

const showCreateDialog = ref(false)

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
  <div class="h-screen flex flex-col bg-dark-500 text-white">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-dark-300 px-6 py-4">
      <div class="flex items-center gap-3">
        <NuxtLink to="/" class="op-50 transition-opacity hover:op-100">
          <div class="i-ri-arrow-left-line text-lg" />
        </NuxtLink>
        <h1 class="text-lg font-bold">
          {{ $t('characters.title') }}
        </h1>
        <span v-if="cStore.characters.length" class="rounded-full bg-dark-300 px-2 py-0.5 text-xs op-50">
          {{ cStore.filteredCharacters.length }} / {{ cStore.characters.length }}
        </span>
      </div>

      <div class="flex items-center gap-3">
        <AGUIInput
          v-model="cStore.searchQuery"
          :placeholder="$t('characters.search')"
          prefix-icon="i-ri-search-line"
          class="w-60"
        />

        <AGUIButton theme="primary" @click="showCreateDialog = true">
          <div class="i-ri-add-line mr-1" />
          {{ $t('characters.newCharacter') }}
        </AGUIButton>

        <AGUIButton
          :loading="cStore.loading"
          @click="cStore.dirHandle ? cStore.fetchCharactersFromHandle() : cStore.fetchCharacters()"
        >
          <div class="i-ri-refresh-line" />
        </AGUIButton>

        <!-- Language toggle -->
        <AGUIButton variant="outline" size="small" @click="toggleLocale">
          <div class="i-ri-global-line mr-1" />
          {{ locale === 'en' ? 'EN' : '中' }}
        </AGUIButton>
      </div>
    </div>

    <!-- Main content: left tree + right cards -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Left sidebar: File tree -->
      <div class="w-60 flex flex-col border-r border-dark-300">
        <div v-if="cStore.dirHandle" class="flex-1 overflow-auto">
          <!-- Directory name header -->
          <div class="flex items-center gap-2 border-b border-dark-300 px-3 py-2 text-xs op-60">
            <div class="i-ri-folder-open-line" />
            <span class="truncate">{{ cStore.dirHandle.name }}</span>
          </div>
          <!-- File tree -->
          <div class="p-1">
            <CharacterFileTree
              :nodes="cStore.fileTree"
              :selected="selectedTreeNode"
              @select="onTreeNodeClick"
            />
          </div>
        </div>
        <div v-else class="flex flex-1 flex-col items-center justify-center gap-3 p-4">
          <div class="i-ri-folder-open-line text-3xl op-30" />
          <AGUIButton theme="primary" size="small" @click="onOpenDirectory">
            <div class="i-ri-folder-add-line mr-1" />
            {{ $t('characters.openLocalDir') }}
          </AGUIButton>
          <p class="text-center text-xs op-40">
            {{ $t('characters.dirHint') }}
          </p>
        </div>
      </div>

      <!-- Right: Character cards or directory config -->
      <div class="flex-1 overflow-auto">
        <!-- Server-side dir config (when no browser handle and no server dir) -->
        <div v-if="!hasSource" class="flex flex-col items-center justify-center gap-6 p-8">
          <div class="i-ri-folder-open-line text-4xl op-30" />

          <div class="max-w-xl w-full flex flex-col gap-2">
            <p class="text-sm op-70">
              {{ $t('characters.dirHint') }}
            </p>
            <div class="flex items-center gap-2">
              <AGUIInput
                v-model="cStore.charactersDir"
                :placeholder="$t('characters.dirPlaceholder')"
                class="flex-1"
              />
              <AGUIButton theme="primary" :disabled="!cStore.charactersDir" @click="onConnectDir">
                {{ $t('characters.connect') }}
              </AGUIButton>
            </div>
          </div>

          <div class="max-w-xl w-full text-xs op-40">
            <p>{{ $t('characters.examplePaths') }}</p>
            <p class="mt-1 font-mono">
              ./demo/flow/adv/characters
            </p>
            <p class="font-mono">
              /absolute/path/to/adv/characters
            </p>
          </div>
        </div>

        <!-- Character List -->
        <div v-else class="p-6">
          <CharacterList
            :characters="cStore.filteredCharacters"
            :loading="cStore.loading"
            @select="onSelectCharacter"
          />
        </div>
      </div>
    </div>

    <!-- Create Dialog -->
    <AGUIDialog v-model:open="showCreateDialog" :title="$t('characters.newCharacter')" content-class="w-lg max-h-[80vh]">
      <CharacterForm mode="create" @submit="onCreateCharacter" @cancel="showCreateDialog = false" />
    </AGUIDialog>
  </div>
</template>
