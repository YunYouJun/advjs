<script setup lang="ts">
import type { AdvCharacter } from '@advjs/types'
import { stringifyCharacterMd } from '@advjs/parser'
import {
  IonButton,
  IonChip,
  IonIcon,
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
  warningOutline,
} from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import LayoutPage from '../../components/common/LayoutPage.vue'
import { useProjectContent } from '../../composables/useProjectContent'
import { parseCSV, validateCharacterCSVHeaders } from '../../utils/csvParser'
import { writeFileToDir } from '../../utils/fileAccess'
import { showToast } from '../../utils/toast'

const WHITESPACE_RE = /\s+/g
const NON_WORD_RE = /[^\w-]/g

function nameToId(name: string): string {
  return name.toLowerCase().replace(WHITESPACE_RE, '-').replace(NON_WORD_RE, '')
}

const { t } = useI18n()
const { characters, reload, getDirHandle } = useProjectContent()

// --- State ---
const importFormat = ref<'csv' | 'json'>('csv')
const rawContent = ref('')
const fileName = ref('')
const parsedCharacters = ref<AdvCharacter[]>([])
const parseError = ref('')
const conflictStrategy = ref<'skip' | 'overwrite' | 'rename'>('skip')
const isImporting = ref(false)
const importResults = ref<{ name: string, status: 'created' | 'skipped' | 'overwritten' | 'renamed' | 'error', error?: string }[]>([])

// --- Computed ---
const existingIds = computed(() => new Set(characters.value.map(c => c.id)))

const characterStatuses = computed(() => {
  return parsedCharacters.value.map((char) => {
    const conflict = existingIds.value.has(char.id)
    return { character: char, conflict }
  })
})

const conflictCount = computed(() => characterStatuses.value.filter(s => s.conflict).length)
const canImport = computed(() => parsedCharacters.value.length > 0 && !parseError.value)

// --- File input ---
async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file)
    return

  fileName.value = file.name
  rawContent.value = await file.text()

  // Auto-detect format
  if (file.name.endsWith('.json'))
    importFormat.value = 'json'
  else if (file.name.endsWith('.csv'))
    importFormat.value = 'csv'

  parseContent()
}

function parseContent() {
  parseError.value = ''
  parsedCharacters.value = []

  if (!rawContent.value.trim()) {
    parseError.value = t('batchImport.noContent')
    return
  }

  try {
    if (importFormat.value === 'csv') {
      parseCSVContent()
    }
    else {
      parseJSONContent()
    }
  }
  catch (e) {
    parseError.value = e instanceof Error ? e.message : String(e)
  }
}

function parseCSVContent() {
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
    const char: AdvCharacter = {
      id,
      name,
    }

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

function parseJSONContent() {
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

// --- Import ---
async function doImport() {
  const dirHandle = getDirHandle()
  if (!dirHandle) {
    showToast(t('batchImport.noProject'), 'warning')
    return
  }

  isImporting.value = true
  importResults.value = []

  try {
    const occupiedIds = new Set(existingIds.value)

    for (const { character, conflict } of characterStatuses.value) {
      try {
        let finalId = character.id
        let status: 'created' | 'skipped' | 'overwritten' | 'renamed' = 'created'

        if (conflict) {
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
        await writeFileToDir(dirHandle, filePath, content)

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

    await reload()
    showToast(t('batchImport.importComplete'), 'success')
  }
  finally {
    isImporting.value = false
  }
}

function reset() {
  rawContent.value = ''
  fileName.value = ''
  parsedCharacters.value = []
  parseError.value = ''
  importResults.value = []
}
</script>

<template>
  <LayoutPage :title="t('batchImport.title')" back-href="/tabs/workspace/characters">
    <!-- Format selector -->
    <div class="ion-padding">
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
    <div v-if="parsedCharacters.length > 0" class="ion-padding-horizontal">
      <h3>
        {{ t('batchImport.preview') }} ({{ parsedCharacters.length }})
        <IonChip v-if="conflictCount > 0" color="warning">
          {{ t('batchImport.conflicts', { count: conflictCount }) }}
        </IonChip>
      </h3>

      <IonList>
        <IonItem v-for="({ character, conflict }, idx) in characterStatuses" :key="idx">
          <IonIcon
            slot="start"
            :icon="conflict ? warningOutline : checkmarkCircleOutline"
            :color="conflict ? 'warning' : 'success'"
          />
          <IonLabel>
            <h2>{{ character.name }}</h2>
            <p>ID: {{ character.id }}</p>
            <p v-if="character.tags?.length">
              {{ character.tags.join(', ') }}
            </p>
          </IonLabel>
          <IonChip v-if="conflict" slot="end" color="warning">
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
        {{ isImporting ? t('batchImport.importing') : t('batchImport.importButton', { count: parsedCharacters.length }) }}
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
</style>
