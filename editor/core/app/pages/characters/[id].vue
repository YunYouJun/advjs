<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import { Toast } from '@advjs/gui'

definePageMeta({
  layout: 'default',
})

const { t } = useI18n()
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
  // eslint-disable-next-line no-alert
  if (!window.confirm(t('characters.confirmDelete', { name: c.name })))
    return
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
  <div class="ae-resource-panel flex flex-col h-screen">
    <!-- Header -->
    <div class="px-2 py-1 border-b border-$agui-c-divider flex gap-3 items-center">
      <NuxtLink to="/characters" :aria-label="$t('characters.back')" class="op-50 transition-opacity hover:op-100">
        <div class="i-ri-arrow-left-line text-lg" />
      </NuxtLink>
      <h1 class="text-sm font-medium flex-1 min-w-0">
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
      <div v-else class="text-$agui-c-text-2 flex flex-col gap-2 items-center">
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
      <div v-if="!isEditing" class="border-t border-$agui-c-divider">
        <TachieManager :character="character" @update="(t) => onSave({ tachies: t })" />
        <RelationshipEditor :key="character.id" :relationships="character.relationships" @update="(r) => onSave({ relationships: r })" />
      </div>
    </div>
  </div>
</template>
