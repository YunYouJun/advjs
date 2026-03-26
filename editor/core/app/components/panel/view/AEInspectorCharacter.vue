<script setup lang="ts">
import type { AdvCharacter, AdvCharacterRelationship, AdvTachie } from '@advjs/types'
import { Toast } from '@advjs/gui/client/composables'

const { t } = useI18n()
const characterStore = useCharacterStore()
const app = useAppStore()

const isEditing = ref(false)

const isCreateMode = computed(() => app.activeInspector === 'character-create')

// When switching to create mode, reset editing state
watch(() => app.activeInspector, (val) => {
  if (val === 'character-create') {
    isEditing.value = false
  }
})

// ---- Edit mode handlers ----

function startEditing() {
  isEditing.value = true
}

function stopEditing() {
  isEditing.value = false
}

async function onSave(data: Partial<AdvCharacter>) {
  if (!characterStore.selectedCharacter)
    return

  const updated = { ...characterStore.selectedCharacter, ...data } as AdvCharacter
  await characterStore.updateCharacter(updated)
  characterStore.selectedCharacter = updated

  Toast({ title: t('characters.updated'), type: 'success' })
  isEditing.value = false
}

function onCancel() {
  if (isCreateMode.value) {
    app.activeInspector = undefined
  }
  else {
    isEditing.value = false
  }
}

// ---- Create mode handlers ----

async function onCreate(data: Partial<AdvCharacter>) {
  await characterStore.createCharacter(data)
  Toast({ title: t('characters.created'), type: 'success' })

  // Select the newly created character and switch to detail mode
  const created = characterStore.characters.find(c => c.id === data.id)
  if (created) {
    characterStore.selectedCharacter = created
    const entry = characterStore.fileEntries.get(created.id)
    if (entry?.fileHandle) {
      characterStore.selectedCharacterHandle = entry.fileHandle
    }
  }
  app.activeInspector = 'character'
}

// ---- Delete handler ----

async function onDelete(character: AdvCharacter) {
  // eslint-disable-next-line no-alert
  const confirmed = window.confirm(t('characters.confirmDelete', { name: character.name }))
  if (!confirmed)
    return

  await characterStore.deleteCharacter(character)
  Toast({ title: t('characters.deleted'), type: 'success' })
  app.activeInspector = undefined
}

// ---- Export AI handler ----

async function onExportAI() {
  if (!characterStore.selectedCharacter)
    return

  const markdown = await characterStore.exportForAI(characterStore.selectedCharacter.id)
  if (markdown) {
    await navigator.clipboard.writeText(markdown)
    Toast({ title: t('characters.exportSuccess'), type: 'success' })
  }
  else {
    Toast({ title: t('characters.exportFailed'), type: 'warning' })
  }
}

// ---- Tachie update handler ----

async function onTachieUpdate(tachies: Record<string, AdvTachie>) {
  if (!characterStore.selectedCharacter)
    return

  const updated = { ...characterStore.selectedCharacter, tachies } as AdvCharacter
  await characterStore.updateCharacter(updated)
  characterStore.selectedCharacter = updated
  Toast({ title: t('characters.updated'), type: 'success' })
}

// ---- Relationship update handler ----

async function onRelationshipUpdate(relationships: AdvCharacterRelationship[]) {
  if (!characterStore.selectedCharacter)
    return

  const updated = { ...characterStore.selectedCharacter, relationships } as AdvCharacter
  await characterStore.updateCharacter(updated)
  characterStore.selectedCharacter = updated
  Toast({ title: t('characters.updated'), type: 'success' })
}
</script>

<template>
  <div class="h-full flex flex-col">
    <!-- Header toolbar -->
    <div class="flex items-center justify-between gap-2 border-b border-dark-300 p-2">
      <div class="flex items-center gap-2">
        <div class="i-ri-user-line" />
        <span>{{ isCreateMode ? $t('characters.createNew') : $t('characters.title') }}</span>
      </div>

      <div v-if="!isCreateMode && characterStore.selectedCharacter" class="flex items-center gap-1">
        <AGUIIconButton
          v-if="!isEditing"
          size="mini"
          icon="i-ri-edit-line"
          :title="$t('characters.detail.edit')"
          @click="startEditing"
        />
        <AGUIIconButton
          v-if="isEditing"
          size="mini"
          icon="i-ri-arrow-left-line"
          :title="$t('characters.backToDetail')"
          @click="stopEditing"
        />
        <AGUIIconButton
          size="mini"
          icon="i-ri-file-text-line"
          :title="$t('characters.exportAI')"
          @click="onExportAI"
        />
        <AGUIIconButton
          size="mini"
          icon="i-ri-delete-bin-line"
          :title="$t('characters.deleted')"
          @click="onDelete(characterStore.selectedCharacter)"
        />
      </div>
    </div>

    <div class="flex-1 overflow-auto">
      <!-- Create mode -->
      <template v-if="isCreateMode">
        <CharacterForm
          mode="create"
          @submit="onCreate"
          @cancel="onCancel"
        />
      </template>

      <!-- Existing character selected -->
      <template v-else-if="characterStore.selectedCharacter">
        <!-- Editing mode -->
        <CharacterForm
          v-if="isEditing"
          mode="edit"
          :character="characterStore.selectedCharacter"
          @submit="onSave"
          @cancel="onCancel"
        />

        <!-- Detail (readonly) mode -->
        <template v-else>
          <CharacterDetail
            :character="characterStore.selectedCharacter"
            @edit="startEditing"
            @delete="onDelete"
          />

          <!-- Tachie Manager -->
          <div class="border-t border-dark-300 p-4">
            <TachieManager
              :character="characterStore.selectedCharacter"
              @update="onTachieUpdate"
            />
          </div>

          <!-- Relationship Editor -->
          <div class="border-t border-dark-300 p-4">
            <RelationshipEditor
              :relationships="characterStore.selectedCharacter.relationships"
              @update="onRelationshipUpdate"
            />
          </div>
        </template>
      </template>

      <!-- No character selected -->
      <div v-else class="flex items-center justify-center p-4 op-50">
        {{ $t('characters.selectToEdit') }}
      </div>
    </div>
  </div>
</template>
