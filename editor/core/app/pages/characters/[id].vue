<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import { Toast } from '@advjs/gui/client/composables'

definePageMeta({
  layout: 'default',
})

const route = useRoute()
const router = useRouter()
const cStore = useCharacterStore()

const characterId = computed(() => route.params.id as string)
const isEditing = ref(false)

const character = computed(() => {
  return cStore.characters.find(
    c => c.id === characterId.value,
  )
})

onMounted(async () => {
  if (!cStore.characters.length && cStore.charactersDir) {
    await cStore.fetchCharacters()
  }
})

function onEdit(c: AdvCharacter) {
  cStore.selectedCharacter = c
  isEditing.value = true
}

async function onSave(data: Partial<AdvCharacter>) {
  if (!character.value)
    return

  await cStore.updateCharacter({
    ...character.value,
    ...data,
  } as AdvCharacter)
  isEditing.value = false
  Toast({ title: 'Character saved', type: 'success' })
}

async function onDelete(c: AdvCharacter) {
  await cStore.deleteCharacter(c)
  Toast({ title: 'Character deleted', type: 'success' })
  router.push('/characters')
}

async function onCopyForAI() {
  if (!character.value)
    return

  const markdown = await cStore.exportForAI(character.value.id)
  if (markdown) {
    await navigator.clipboard.writeText(markdown)
    Toast({ title: 'Copied AI-friendly markdown to clipboard', type: 'success' })
  }
}
</script>

<template>
  <div class="h-screen flex flex-col bg-dark-500 text-white">
    <!-- Header -->
    <div class="flex items-center gap-3 border-b border-dark-300 px-6 py-4">
      <NuxtLink to="/characters" class="op-50 transition-opacity hover:op-100">
        <div class="i-ri-arrow-left-line text-lg" />
      </NuxtLink>
      <h1 class="flex-1 text-lg font-bold">
        {{ character?.name || 'Character' }}
      </h1>
      <div v-if="character" class="flex gap-2">
        <AGUIButton variant="outline" @click="onCopyForAI">
          <div class="i-ri-file-copy-line mr-1" />
          Copy for AI
        </AGUIButton>
      </div>
    </div>

    <div v-if="!character" class="flex flex-1 items-center justify-center">
      <div v-if="cStore.loading" class="flex items-center justify-center">
        <div class="i-svg-spinners:3-dots-scale text-4xl" />
      </div>
      <div v-else class="flex flex-col items-center gap-2 op-50">
        <div class="i-ri-user-3-line text-4xl" />
        <span>Character not found</span>
        <NuxtLink to="/characters">
          <AGUIButton theme="primary" variant="outline">
            Back to list
          </AGUIButton>
        </NuxtLink>
      </div>
    </div>

    <div v-else class="flex-1 overflow-auto">
      <!-- Edit Mode -->
      <CharacterForm
        v-if="isEditing"
        :character="character"
        mode="edit"
        @submit="onSave"
        @cancel="isEditing = false"
      />

      <!-- Detail Mode -->
      <CharacterDetail
        v-else
        :character="character"
        @edit="onEdit"
        @delete="onDelete"
      />

      <!-- Tachie & Relationship Editors (below detail) -->
      <div v-if="!isEditing" class="flex flex-col gap-4 border-t border-dark-300 p-4">
        <TachieManager :character="character" @update="(t) => onSave({ tachies: t })" />
        <RelationshipEditor :relationships="character.relationships" @update="(r) => onSave({ relationships: r })" />
      </div>
    </div>
  </div>
</template>
