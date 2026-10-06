<script setup lang="ts">
import type { ToolbarItem } from '@advjs/gui'
import type { AdvCharacter, AdvCharacterRelationship, AdvTachie } from '@advjs/types'
import { Toast } from '@advjs/gui'

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
const toolbarItems = computed<ToolbarItem[]>(() => {
  if (isCreateMode.value || !characterStore.selectedCharacter)
    return []
  return [
    { type: 'space' },
    { type: 'button', icon: isEditing.value ? 'i-ri-arrow-left-line' : 'i-ri-edit-line', title: t(isEditing.value ? 'characters.backToDetail' : 'characters.detail.edit'), onClick: isEditing.value ? stopEditing : startEditing },
    { type: 'button', icon: 'i-ri-file-text-line', title: t('characters.exportAI'), onClick: onExportAI },
    { type: 'button', icon: 'i-ri-delete-bin-line', title: t('characters.detail.delete'), onClick: () => onDelete(characterStore.selectedCharacter!) },
  ]
})
</script>

<template>
  <div class="flex flex-col h-full">
    <AGUIToolbar :items="toolbarItems" :label="t('characters.title')">
      <template #before-toolbar>
        <div class="flex gap-1 min-w-0 items-center">
          <div class="i-ri-user-line shrink-0" aria-hidden="true" />
          <span class="break-words">{{ isCreateMode ? $t('characters.createNew') : $t('characters.title') }}</span>
        </div>
      </template>
    </AGUIToolbar>

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
            :actions="false"
            :character="characterStore.selectedCharacter"
            @edit="startEditing"
            @delete="onDelete"
          />

          <!-- Tachie Manager -->
          <div class="border-t border-$agui-c-divider">
            <TachieManager
              :character="characterStore.selectedCharacter"
              @update="onTachieUpdate"
            />
          </div>

          <!-- Relationship Editor -->
          <div class="border-t border-$agui-c-divider">
            <RelationshipEditor
              :key="characterStore.selectedCharacter.id"
              :relationships="characterStore.selectedCharacter.relationships"
              @update="onRelationshipUpdate"
            />
          </div>
        </template>
      </template>

      <!-- No character selected -->
      <div v-else class="p-4 op-50 flex items-center justify-center">
        {{ $t('characters.selectToEdit') }}
      </div>
    </div>
  </div>
</template>
