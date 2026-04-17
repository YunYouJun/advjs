<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import type { SceneFormData } from '../../utils/sceneMd'
import { stringifyCharacterMd } from '@advjs/parser'
import {
  alertController,
  IonButton,
  IonChip,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonRadio,
  IonRadioGroup,
  IonSegment,
  IonSegmentButton,
} from '@ionic/vue'
import {
  alertCircleOutline,
  checkmarkCircleOutline,
  cloudUploadOutline,
  documentTextOutline,
  pricetag,
  trashOutline,
  warningOutline,
} from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import LayoutPage from '../../components/common/LayoutPage.vue'
import { useProjectContent } from '../../composables/useProjectContent'
import { parseCSV, validateCharacterCSVHeaders } from '../../utils/csvParser'
import { stringifySceneMd } from '../../utils/sceneMd'
import { showToast } from '../../utils/toast'

const WHITESPACE_RE = /\s+/g
const NON_WORD_RE = /[^\w-]/g

function nameToId(name: string): string {
  return name.toLowerCase().replace(WHITESPACE_RE, '-').replace(NON_WORD_RE, '')
}

const { t } = useI18n()
const { characters, scenes, reload, getFs } = useProjectContent()

// --- State ---
const importType = ref<'character' | 'scene'>('character')
const importFormat = ref<'csv' | 'json'>('csv')
const rawContent = ref('')
const fileName = ref('')
const parsedCharacters = ref<AdvCharacter[]>([])
const parsedScenes = ref<SceneFormData[]>([])
const parseError = ref('')
const conflictStrategy = ref<'skip' | 'overwrite' | 'rename'>('skip')
const isImporting = ref(false)
const importResults = ref<{ name: string, status: 'created' | 'skipped' | 'overwritten' | 'renamed' | 'error', error?: string }[]>([])

// --- Batch tag editing ---
const batchTagInput = ref('')
const selectedIndices = ref<Set<number>>(new Set())
const selectAll = ref(false)

function toggleSelectAll() {
  selectAll.value = !selectAll.value
  if (selectAll.value) {
    const total = importType.value === 'character' ? parsedCharacters.value.length : parsedScenes.value.length
    selectedIndices.value = new Set(Array.from({ length: total }, (_, i) => i))
  }
  else {
    selectedIndices.value = new Set()
  }
}

function toggleSelect(idx: number) {
  const s = new Set(selectedIndices.value)
  if (s.has(idx))
    s.delete(idx)
  else
    s.add(idx)
  selectedIndices.value = s
}

function applyBatchTags() {
  const newTags = batchTagInput.value.split(';').map(t => t.trim()).filter(Boolean)
  if (newTags.length === 0)
    return

  if (importType.value === 'character') {
    for (const idx of selectedIndices.value) {
      const char = parsedCharacters.value[idx]
      if (char) {
        const existing = new Set(char.tags || [])
        for (const tag of newTags) existing.add(tag)
        char.tags = [...existing]
      }
    }
  }
  else {
    for (const idx of selectedIndices.value) {
      const scene = parsedScenes.value[idx]
      if (scene) {
        const existing = new Set(scene.tags || [])
        for (const tag of newTags) existing.add(tag)
        scene.tags = [...existing]
      }
    }
  }

  batchTagInput.value = ''
  showToast(t('batchImport.tagsApplied', { count: selectedIndices.value.size }), 'success')
}

async function batchDeleteSelected() {
  if (selectedIndices.value.size === 0)
    return

  const alert = await alertController.create({
    header: t('batchImport.batchDeleteTitle'),
    message: t('batchImport.batchDeleteMessage', { count: selectedIndices.value.size }),
    buttons: [
      { text: t('common.cancel'), role: 'cancel' },
      {
        text: t('common.delete'),
        role: 'destructive',
        handler: () => {
          const indices = [...selectedIndices.value].sort((a, b) => b - a)
          if (importType.value === 'character') {
            for (const idx of indices)
              parsedCharacters.value.splice(idx, 1)
          }
          else {
            for (const idx of indices)
              parsedScenes.value.splice(idx, 1)
          }
          selectedIndices.value = new Set()
          selectAll.value = false
        },
      },
    ],
  })
  await alert.present()
}

// --- Computed ---
const existingCharIds = computed(() => new Set(characters.value.map(c => c.id)))
const existingSceneIds = computed(() => new Set(scenes.value.map(s => s.id).filter(Boolean)))

const parsedItems = computed(() => {
  if (importType.value === 'character') {
    return parsedCharacters.value.map((char) => {
      const conflict = existingCharIds.value.has(char.id)
      return { id: char.id, name: char.name, tags: char.tags, conflict }
    })
  }
  else {
    return parsedScenes.value.map((scene) => {
      const conflict = existingSceneIds.value.has(scene.id)
      return { id: scene.id, name: scene.name || scene.id, tags: scene.tags, conflict }
    })
  }
})

const conflictCount = computed(() => parsedItems.value.filter(s => s.conflict).length)
const canImport = computed(() => parsedItems.value.length > 0 && !parseError.value)

// --- File input ---
async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return

  fileName.value = file.name
  rawContent.value = await file.text()

  if (file.name.endsWith('.json'))
    importFormat.value = 'json'
  else if (file.name.endsWith('.csv'))
    importFormat.value = 'csv'

  parseContent()
}

function parseContent() {
  parseError.value = ''
  parsedCharacters.value = []
  parsedScenes.value = []
  selectedIndices.value = new Set()
  selectAll.value = false

  if (!rawContent.value.trim()) {
    parseError.value = t('batchImport.noContent')
    return
  }

  try {
    if (importFormat.value === 'csv') {
      if (importType.value === 'character')
        parseCSVCharacters()
      else
        parseCSVScenes()
    }
    else {
      if (importType.value === 'character')
        parseJSONCharacters()
      else
        parseJSONScenes()
    }
  }
  catch (e) {
    parseError.value = e instanceof Error ? e.message : String(e)
  }
}

function parseCSVCharacters() {
  const records = parseCSV(rawContent.value)
  if (records.length === 0) {
    parseError.value = t('batchImport.emptyFile')
    return
  }

  const headers = Object.keys(records[0])
  const validation = validateCharacterCSVHeaders(headers)
  if (!validation.valid) {
    parseError.value = t('batchImport.missingHeaders', { headers: validation.missingRequired.join(', ') })
    return
  }

  const chars: AdvCharacter[] = []
  for (const row of records) {
    const name = row.name?.trim()
    if (!name)
      continue

    const id = row.id?.trim() || nameToId(name)
    const char: AdvCharacter = { id, name }

    if (row.tags)
      char.tags = row.tags.split(';').map(t => t.trim()).filter(Boolean)
    if (row.aliases)
      char.aliases = row.aliases.split(';').map(a => a.trim()).filter(Boolean)
    if (row.personality)
      char.personality = row.personality
    if (row.appearance)
      char.appearance = row.appearance
    if (row.background)
      char.background = row.background
    if (row.concept)
      char.concept = row.concept
    if (row.speechStyle)
      char.speechStyle = row.speechStyle
    if (row.faction)
      char.faction = row.faction

    chars.push(char)
  }

  parsedCharacters.value = chars
}

function parseCSVScenes() {
  const records = parseCSV(rawContent.value)
  if (records.length === 0) {
    parseError.value = t('batchImport.emptyFile')
    return
  }

  const headers = Object.keys(records[0])
  if (!headers.includes('name') && !headers.includes('id')) {
    parseError.value = t('batchImport.missingHeaders', { headers: 'name or id' })
    return
  }

  const items: SceneFormData[] = []
  for (const row of records) {
    const name = (row.name || row.id || '').trim()
    if (!name)
      continue

    const id = row.id?.trim() || nameToId(name)
    const scene: SceneFormData = { id, name }

    if (row.description)
      scene.description = row.description
    if (row.imagePrompt)
      scene.imagePrompt = row.imagePrompt
    if (row.type && (row.type === 'image' || row.type === 'model'))
      scene.type = row.type
    if (row.tags)
      scene.tags = row.tags.split(';').map(t => t.trim()).filter(Boolean)
    if (row.linkedLocation)
      scene.linkedLocation = row.linkedLocation
    if (row.src)
      scene.src = row.src

    items.push(scene)
  }

  parsedScenes.value = items
}

function parseJSONCharacters() {
  const data = JSON.parse(rawContent.value)
  const arr = Array.isArray(data) ? data : [data]

  const chars: AdvCharacter[] = []
  for (const item of arr) {
    if (!item.name) {
      parseError.value = t('batchImport.missingName')
      return
    }
    const id = item.id || nameToId(item.name)
    chars.push({ ...item, id })
  }

  parsedCharacters.value = chars
}

function parseJSONScenes() {
  const data = JSON.parse(rawContent.value)
  const arr = Array.isArray(data) ? data : [data]

  const items: SceneFormData[] = []
  for (const item of arr) {
    if (!item.name && !item.id) {
      parseError.value = t('batchImport.missingName')
      return
    }
    const id = item.id || nameToId(item.name)
    items.push({ ...item, id, name: item.name || id })
  }

  parsedScenes.value = items
}

// --- Import ---
async function doImport() {
  const fs = getFs()
  if (!fs) {
    showToast(t('batchImport.noProject'), 'warning')
    return
  }

  isImporting.value = true
  importResults.value = []

  try {
    if (importType.value === 'character')
      await importCharacters(fs)
    else
      await importScenes(fs)

    await reload()
    showToast(t('batchImport.importComplete'), 'success')
  }
  finally {
    isImporting.value = false
  }
}

async function importCharacters(fs: any) {
  const occupiedIds = new Set(existingCharIds.value)

  for (const item of parsedItems.value) {
    const idx = parsedItems.value.indexOf(item)
    const character = parsedCharacters.value[idx]
    try {
      let finalId = character.id
      let status: 'created' | 'skipped' | 'overwritten' | 'renamed' = 'created'

      if (item.conflict) {
        if (conflictStrategy.value === 'skip') {
          importResults.value.push({ name: character.name, status: 'skipped' })
          continue
        }
        else if (conflictStrategy.value === 'rename') {
          let suffix = 2
          while (occupiedIds.has(`${character.id}-${suffix}`))
            suffix++
          finalId = `${character.id}-${suffix}`
          status = 'renamed'
        }
        else {
          status = 'overwritten'
        }
      }

      const charToWrite = { ...character, id: finalId }
      const content = stringifyCharacterMd(charToWrite)
      const filePath = `adv/characters/${finalId}.character.md`
      await fs.writeFile(filePath, content)

      occupiedIds.add(finalId)
      importResults.value.push({ name: character.name, status })
    }
    catch (err) {
      importResults.value.push({
        name: character.name,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}

async function importScenes(fs: any) {
  const occupiedIds = new Set(existingSceneIds.value)

  for (let i = 0; i < parsedScenes.value.length; i++) {
    const scene = parsedScenes.value[i]
    const item = parsedItems.value[i]
    try {
      let finalId = scene.id
      let status: 'created' | 'skipped' | 'overwritten' | 'renamed' = 'created'

      if (item.conflict) {
        if (conflictStrategy.value === 'skip') {
          importResults.value.push({ name: scene.name || scene.id, status: 'skipped' })
          continue
        }
        else if (conflictStrategy.value === 'rename') {
          let suffix = 2
          while (occupiedIds.has(`${scene.id}-${suffix}`))
            suffix++
          finalId = `${scene.id}-${suffix}`
          status = 'renamed'
        }
        else {
          status = 'overwritten'
        }
      }

      const sceneToWrite = { ...scene, id: finalId }
      const content = stringifySceneMd(sceneToWrite)
      const filePath = `adv/scenes/${finalId}.md`
      await fs.writeFile(filePath, content)

      occupiedIds.add(finalId)
      importResults.value.push({ name: scene.name || scene.id, status })
    }
    catch (err) {
      importResults.value.push({
        name: scene.name || scene.id,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
}

function reset() {
  rawContent.value = ''
  fileName.value = ''
  parsedCharacters.value = []
  parsedScenes.value = []
  parseError.value = ''
  importResults.value = []
  selectedIndices.value = new Set()
  selectAll.value = false
  batchTagInput.value = ''
}
</script>

<template>
  <LayoutPage :title="t('batchImport.title')" back-href="/tabs/workspace/characters">
    <!-- Import type selector -->
    <div class="ion-padding">
      <IonSegment v-model="importType" @ion-change="parseContent">
        <IonSegmentButton value="character">
          {{ t('batchImport.typeCharacter') }}
        </IonSegmentButton>
        <IonSegmentButton value="scene">
          {{ t('batchImport.typeScene') }}
        </IonSegmentButton>
      </IonSegment>
    </div>

    <!-- Format selector -->
    <div class="ion-padding-horizontal">
      <IonSegment v-model="importFormat" @ion-change="parseContent">
        <IonSegmentButton value="csv">
          CSV
        </IonSegmentButton>
        <IonSegmentButton value="json">
          JSON
        </IonSegmentButton>
      </IonSegment>
    </div>

    <!-- File upload area -->
    <div class="ion-padding">
      <label class="upload-area">
        <input
          type="file"
          :accept="importFormat === 'csv' ? '.csv' : '.json'"
          style="display: none"
          @change="handleFileSelect"
        >
        <IonIcon :icon="cloudUploadOutline" size="large" color="medium" />
        <p v-if="!fileName" class="ion-text-center" style="color: var(--ion-color-medium)">
          {{ t('batchImport.selectFile') }}
        </p>
        <p v-else class="ion-text-center">
          <IonIcon :icon="documentTextOutline" /> {{ fileName }}
        </p>
      </label>
    </div>

    <!-- Parse error -->
    <div v-if="parseError" class="ion-padding">
      <IonNote color="danger">
        <IonIcon :icon="alertCircleOutline" /> {{ parseError }}
      </IonNote>
    </div>

    <!-- Preview list -->
    <div v-if="parsedItems.length > 0" class="ion-padding-horizontal">
      <h3>
        {{ t('batchImport.preview') }} ({{ parsedItems.length }})
        <IonChip v-if="conflictCount > 0" color="warning">
          {{ t('batchImport.conflicts', { count: conflictCount }) }}
        </IonChip>
      </h3>

      <!-- Batch operations bar -->
      <div class="batch-ops">
        <label class="batch-ops__select-all">
          <input type="checkbox" :checked="selectAll" @change="toggleSelectAll">
          {{ t('batchImport.selectAll') }}
        </label>
        <div v-if="selectedIndices.size > 0" class="batch-ops__actions">
          <div class="batch-ops__tag-input">
            <IonInput
              v-model="batchTagInput"
              :placeholder="t('batchImport.batchTagPlaceholder')"
              size="small"
              class="batch-tag-field"
            />
            <IonButton size="small" fill="outline" :disabled="!batchTagInput.trim()" @click="applyBatchTags">
              <IonIcon slot="start" :icon="pricetag" />
              {{ t('batchImport.applyTags') }}
            </IonButton>
          </div>
          <IonButton size="small" fill="outline" color="danger" @click="batchDeleteSelected">
            <IonIcon slot="start" :icon="trashOutline" />
            {{ t('batchImport.deleteSelected', { count: selectedIndices.size }) }}
          </IonButton>
        </div>
      </div>

      <IonList>
        <IonItem v-for="(item, idx) in parsedItems" :key="idx">
          <input
            slot="start"
            type="checkbox"
            :checked="selectedIndices.has(idx)"
            @change="toggleSelect(idx)"
          >
          <IonIcon
            slot="start"
            :icon="item.conflict ? warningOutline : checkmarkCircleOutline"
            :color="item.conflict ? 'warning' : 'success'"
          />
          <IonLabel>
            <h2>{{ item.name }}</h2>
            <p>ID: {{ item.id }}</p>
            <p v-if="item.tags?.length">
              {{ item.tags.join(', ') }}
            </p>
          </IonLabel>
          <IonChip v-if="item.conflict" slot="end" color="warning">
            {{ t('batchImport.duplicate') }}
          </IonChip>
        </IonItem>
      </IonList>
    </div>

    <!-- Conflict strategy -->
    <div v-if="conflictCount > 0" class="ion-padding">
      <h4>{{ t('batchImport.conflictStrategy') }}</h4>
      <IonRadioGroup v-model="conflictStrategy">
        <IonItem>
          <IonRadio slot="start" value="skip" />
          <IonLabel>{{ t('batchImport.strategySkip') }}</IonLabel>
        </IonItem>
        <IonItem>
          <IonRadio slot="start" value="overwrite" />
          <IonLabel>{{ t('batchImport.strategyOverwrite') }}</IonLabel>
        </IonItem>
        <IonItem>
          <IonRadio slot="start" value="rename" />
          <IonLabel>{{ t('batchImport.strategyRename') }}</IonLabel>
        </IonItem>
      </IonRadioGroup>
    </div>

    <!-- Import results -->
    <div v-if="importResults.length > 0" class="ion-padding">
      <h4>{{ t('batchImport.results') }}</h4>
      <IonList>
        <IonItem v-for="(result, idx) in importResults" :key="idx">
          <IonIcon
            slot="start"
            :icon="result.status === 'error' ? alertCircleOutline : checkmarkCircleOutline"
            :color="result.status === 'error' ? 'danger' : result.status === 'skipped' ? 'medium' : 'success'"
          />
          <IonLabel>
            <h3>{{ result.name }}</h3>
            <p>{{ t(`batchImport.status_${result.status}`) }}</p>
            <p v-if="result.error" style="color: var(--ion-color-danger)">
              {{ result.error }}
            </p>
          </IonLabel>
        </IonItem>
      </IonList>
    </div>

    <!-- Action buttons -->
    <div class="ion-padding">
      <IonButton
        expand="block"
        :disabled="!canImport || isImporting"
        @click="doImport"
      >
        {{ isImporting ? t('batchImport.importing') : t('batchImport.importButton', { count: parsedItems.length }) }}
      </IonButton>
      <IonButton
        v-if="importResults.length > 0"
        expand="block"
        fill="outline"
        @click="reset"
      >
        {{ t('batchImport.reset') }}
      </IonButton>
    </div>
  </LayoutPage>
</template>

<style scoped>
.upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  border: 2px dashed var(--ion-color-medium);
  border-radius: 12px;
  cursor: pointer;
  padding: 16px;
  transition: border-color 0.2s;
}

.upload-area:hover {
  border-color: var(--ion-color-primary);
}

.batch-ops {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 0;
  margin-bottom: 8px;
  border-bottom: 1px solid var(--adv-border-subtle, #e2e8f0);
}

.batch-ops__select-all {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  cursor: pointer;
}

.batch-ops__actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.batch-ops__tag-input {
  display: flex;
  align-items: center;
  gap: 8px;
}

.batch-tag-field {
  flex: 1;
  --padding-start: 8px;
  --padding-end: 8px;
  font-size: 14px;
  border: 1px solid var(--adv-border-subtle, #e2e8f0);
  border-radius: 8px;
}
</style>
