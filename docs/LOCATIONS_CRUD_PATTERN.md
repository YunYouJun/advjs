# CRUD Pattern Analysis for Locations Module in ADV.JS Studio

## Executive Summary

The studio app follows a well-established **modular CRUD pattern** for content management. Based on the existing implementations for **Scenes**, **Characters**, **Chapters**, and **Audio**, here's the complete guide for implementing a new "Locations" module.

---

## 1. FILE STRUCTURE & PATHS

### Location in Project

All workspace content modules follow this pattern:

```
apps/studio/src/
├── views/workspace/
│   ├── ScenesPage.vue          ✓ Reference pattern
│   ├── CharactersPage.vue      ✓ Reference pattern
│   ├── ChaptersPage.vue        ✓ Reference pattern
│   ├── AudioPage.vue           ✓ Reference pattern
│   └── LocationsPage.vue       ← NEW (to create)
├── components/
│   ├── SceneCard.vue           ✓ Reference card component
│   ├── SceneEditorForm.vue     ✓ Reference form component
│   ├── CharacterCard.vue       ✓ Reference card component
│   ├── LocationCard.vue        ← NEW (to create)
│   └── LocationEditorForm.vue  ← NEW (to create)
├── composables/
│   ├── useContentEditor.ts     ✓ Generic state machine
│   ├── useContentSave.ts       ✓ Generic save handler
│   ├── useContentDelete.ts     ✓ Generic delete handler
│   ├── useProjectContent.ts    ✓ Content loader (needs Location type)
│   └── useLocationMd.ts        ← NEW (markdown parsing, optional)
├── utils/
│   ├── sceneMd.ts              ✓ Reference markdown format
│   ├── locationMd.ts           ← NEW (location markdown serialization)
│   └── mdFrontmatter.ts        ✓ Shared utility
├── stores/
│   └── useCharacterStateStore.ts ✓ Shows location tracking pattern
├── i18n/locales/
│   ├── en.json                 ✓ English translations
│   └── zh-CN.json              ✓ Chinese translations
└── router/
    └── index.ts                ✓ Route registration
```

### File Organization Summary

- **Views** (page containers): `/apps/studio/src/views/workspace/LocationsPage.vue`
- **Components** (reusable): `/apps/studio/src/components/LocationCard.vue`, `LocationEditorForm.vue`
- **Composables** (logic): Reuse existing composables + create `useLocationMd.ts`
- **Utils** (markdown): `/apps/studio/src/utils/locationMd.ts`
- **I18n**: Add keys to `/apps/studio/src/i18n/locales/{en.json, zh-CN.json}`

---

## 2. ROUTER CONFIGURATION

### Add Location Route

**File**: `apps/studio/src/router/index.ts`

**Current Pattern** (lines 19-41):

```typescript
{
  path: 'workspace',
  component: () => import('@/views/ProjectsPage.vue'),
},
{
  path: 'workspace/chapters',
  component: () => import('@/views/workspace/ChaptersPage.vue'),
},
{
  path: 'workspace/characters',
  component: () => import('@/views/workspace/CharactersPage.vue'),
},
{
  path: 'workspace/scenes',
  component: () => import('@/views/workspace/ScenesPage.vue'),
},
```

**Add this after scenes route**:

```typescript
{
  path: 'workspace/locations',
  component: () => import('@/views/workspace/LocationsPage.vue'),
},
```

---

## 3. DATABASE SCHEMA

### Dexie Table Definition

**File**: `apps/studio/src/utils/db.ts` (around line 95-150)

**Existing Pattern**:

```typescript
export interface DbWorldEvent extends WorldEvent {
  projectId: string
}

export interface DbCharacterState {
  projectId: string
  characterId: string
  state: AdvCharacterDynamicState
}
```

**Add for Locations**:

```typescript
export interface DbLocation {
  projectId: string
  locationId: string // e.g., "tavern", "forest-edge"
  data: LocationInfo // structured location data
}
```

**Table Initialization** (Dexie schema, around line 160-200):

```typescript
export const db = new Dexie('advjs-studio') as Database & {
  // ... existing tables
  locations: Table<DbLocation>
}

db.version(N).stores({
  // ... existing stores
  locations: 'locationId, projectId' // Create index on locationId
})
```

---

## 4. COMPOSABLE ARCHITECTURE

### Reusable Composables (NO CHANGES NEEDED)

These three composables are content-type agnostic and work for any CRUD module:

#### `useContentEditor.ts` (Generic state machine)

**Line 18**: `ContentType = 'character' | 'scene' | 'chapter' | 'audio'`

For locations, pass `'location'` as contentType:

```typescript
const locationEditor = useContentEditor<LocationFormData>('location', () => ({
  id: '',
  name: '',
  description: '',
  type: 'interior', // interior | exterior | abstract
  regions: [],
}))
```

**Key Features**:

- Draft persistence in localStorage
- Validation (ID regex check, required fields)
- Lifecycle: `openCreate()`, `openEdit()`, `close()`, `onSaved()`

#### `useContentSave.ts` (File writing + duplicate detection)

**Line 111**: Switch statement on `contentType`

Will need to add case for 'location':

```typescript
case 'location': {
  const location = data as LocationFormData
  filePath = `adv/locations/${location.id}.md`
  // ... duplicate detection, validation
  content = stringifyLocationMd(location)
  break
}
```

**Key Features**:

- Automatic image extraction (for avatars/thumbnails)
- Duplicate file detection
- Returns `SaveResult` with success/error

#### `useContentDelete.ts` (Confirmation + deletion)

**Line 19**: Generic `deleteFile(filePath, confirmMessage)`

Already handles any file type:

```typescript
await deleteFile('adv/locations/tavern.md', t('locations.confirmDelete', { name: 'Tavern' }))
```

### NEW: useProjectContent.ts Extension

**File**: `apps/studio/src/composables/useProjectContent.ts`

**Current Pattern** (lines 54-58):

```typescript
const chapters = ref<ChapterInfo[]>([])
const characters = ref<AdvCharacter[]>([])
const scenes = ref<SceneInfo[]>([])
const audios = ref<AudioInfo[]>([])
```

**Add locations support**:

```typescript
export interface LocationInfo {
  file: string // e.g., "adv/locations/tavern.md"
  name: string // Display name
  id?: string // Location ID
  description?: string
  type?: 'interior' | 'exterior' | 'abstract'
  regions?: string[]
  tags?: string[]
}

const locations = ref<LocationInfo[]>([])
```

**In loadFromDir()** (around line 143-172):

```typescript
// Load locations
const locationList: LocationInfo[] = []
try {
  const locationFiles = await listFilesInDir(dirHandle, 'adv/locations', '.md')
  for (const file of locationFiles) {
    try {
      const content = await readFileFromDir(dirHandle, file)
      const parsed = parseLocationMd(content)
      locationList.push({
        file,
        name: parsed.name || file.split('/').pop()?.replace('.md', '') || file,
        id: parsed.id,
        description: parsed.description,
        type: parsed.type,
        regions: parsed.regions,
        tags: parsed.tags,
      })
    }
    catch {
      locationList.push({
        file,
        name: file.split('/').pop()?.replace('.md', '') || file,
      })
    }
  }
}
catch { /* no locations dir */ }
locations.value = locationList
```

**Update stats** (line 224-230):

```typescript
stats.value = {
  chapters: chapterInfos.length,
  characters: charList.length,
  scenes: sceneList.length,
  knowledge: knowledgeBase.entries.value.length,
  audios: audioList.length,
  locations: locationList.length, // ADD THIS
}
```

**Export in return statement**:

```typescript
return {
  chapters,
  characters,
  scenes,
  audios,
  locations, // ADD THIS
  stats,
  // ... rest
}
```

---

## 5. MARKDOWN FORMAT & PARSING

### Create LocationMd Utilities

**File**: `apps/studio/src/utils/locationMd.ts`

**Reference**: `sceneMd.ts` (lines 1-73)

**Template**:

```typescript
import yaml from 'js-yaml'
import { dumpYamlFrontmatter, parseFrontmatterAndBody } from './mdFrontmatter'

const LOCATION_FRONTMATTER_KEYS: string[] = [
  'id',
  'name',
  'type', // 'interior', 'exterior', 'abstract'
  'description',
  'regions', // array of region/area names
  'tags',
  'alias', // optional alternative names
]

export interface LocationFormData {
  id: string
  name: string
  type?: 'interior' | 'exterior' | 'abstract'
  description?: string
  regions?: string[]
  tags?: string[]
  alias?: string | string[]
}

export function parseLocationMd(content: string): LocationFormData {
  const { frontmatter, body } = parseFrontmatterAndBody(content)
  const fm = (frontmatter ? yaml.load(frontmatter) : {}) as Record<string, any>

  if (!fm.id || typeof fm.id !== 'string')
    throw new Error('Location .md must have a string `id` in frontmatter')

  const location: LocationFormData = {
    id: fm.id,
    name: fm.name || fm.id,
    type: fm.type || 'interior',
    description: fm.description || body.trim() || undefined,
    regions: fm.regions,
    tags: fm.tags,
    alias: fm.alias,
  }

  return Object.fromEntries(
    Object.entries(location).filter(([_, v]) => v !== undefined),
  ) as LocationFormData
}

export function stringifyLocationMd(location: LocationFormData): string {
  const fm: Record<string, any> = {}
  for (const key of LOCATION_FRONTMATTER_KEYS) {
    const value = (location as any)[key]
    if (value !== undefined && value !== null && value !== '') {
      fm[key] = value
    }
  }

  const yamlStr = dumpYamlFrontmatter(fm)
  return `---\n${yamlStr}\n---\n`
}
```

### Markdown File Format Example

```yaml
---
id: tavern
name: The Wayward Tavern
type: interior
description: A cozy tavern known for its warm hearth and adventurer clientele
regions:
  - main-hall
  - private-room
  - kitchen
tags:
  - drinks
  - gossip
  - music
alias:
  - The Wayside Inn
  - Old Tavern
---
```

---

## 6. PAGE COMPONENT (LocationsPage.vue)

**File**: `/apps/studio/src/views/workspace/LocationsPage.vue`

**Reference**: `ScenesPage.vue` (316 lines, canonical pattern)

**Core Structure**:

```vue
<script setup lang="ts">
import type { LocationInfo } from '../../composables/useProjectContent'
import type { LocationFormData } from '../../utils/locationMd'
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonItemOption,
  IonItemOptions,
  IonItemSliding,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonTitle,
  IonToolbar,
} from '@ionic/vue'
import { addOutline, trashOutline } from 'ionicons/icons'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import ContentEditorModal from '../../components/ContentEditorModal.vue'
import LocationCard from '../../components/LocationCard.vue'
import LocationEditorForm from '../../components/LocationEditorForm.vue'
import { useContentDelete } from '../../composables/useContentDelete'
import { useContentEditor } from '../../composables/useContentEditor'
import { useContentSave } from '../../composables/useContentSave'
import { useProjectContent } from '../../composables/useProjectContent'
import { useRecentActivity } from '../../composables/useRecentActivity'
import { parseLocationMd, stringifyLocationMd } from '../../utils/locationMd'
import { showToast } from '../../utils/toast'

const { t } = useI18n()
const { locations, reload, getDirHandle } = useProjectContent()
const { isSaving, saveContent } = useContentSave()
const { deleteFile } = useContentDelete()
const { trackAccess } = useRecentActivity()

// --- Search ---
const searchQuery = ref('')
const filteredLocations = computed<LocationInfo[]>(() => {
  if (!searchQuery.value)
    return locations.value
  const q = searchQuery.value.toLowerCase()
  return locations.value.filter(l =>
    l.name.toLowerCase().includes(q)
    || l.description?.toLowerCase().includes(q)
    || l.type?.toLowerCase().includes(q)
    || l.tags?.some(tag => tag.toLowerCase().includes(q))
  )
})

// --- Location editor ---
const locationEditor = useContentEditor<LocationFormData>('location', () => ({
  id: '',
  name: '',
  type: 'interior',
  description: '',
  regions: [],
  tags: [],
}))
const locationMarkdown = ref('')

function locationToMarkdown() {
  locationMarkdown.value = stringifyLocationMd(locationEditor.formData.value)
}

function markdownToLocation(md: string) {
  locationMarkdown.value = md
  try {
    const parsed = parseLocationMd(md)
    locationEditor.formData.value = parsed
  }
  catch {
    // keep formData unchanged on parse failure
  }
}

function handleEditLocation(location: LocationInfo) {
  trackAccess({ id: location.file, label: location.name, type: 'location', action: 'edit' })
  const locationData: LocationFormData = {
    id: location.id || location.name,
    name: location.name,
    type: location.type || 'interior',
    description: location.description,
    regions: location.regions,
    tags: location.tags,
  }
  locationEditor.openEdit(locationData)
  locationMarkdown.value = stringifyLocationMd(locationData)
}

// --- Save ---
async function handleSaveLocation() {
  const errors = locationEditor.validate()
  if (errors.length > 0) {
    await showToast(t('contentEditor.validationError', { errors: errors.join(', ') }), 'warning')
    return
  }

  const dirHandle = getDirHandle()
  if (!dirHandle) {
    await showToast(t('contentEditor.saveFailed', { error: 'No directory handle' }), 'danger')
    return
  }

  const result = await saveContent(dirHandle, 'location', locationEditor.mode.value, locationEditor.formData.value, locationEditor.originalId.value)
  if (result.success) {
    await showToast(t('contentEditor.saveSuccess'))
    locationEditor.onSaved()
    locationEditor.close()
    await reload()
  }
  else {
    await showToast(t('contentEditor.saveFailed', { error: result.error }), 'danger')
  }
}

// --- Delete ---
async function handleDeleteLocation(location: LocationFormData) {
  const filePath = `adv/locations/${location.id}.md`
  const deleted = await deleteFile(filePath, t('locations.confirmDelete', { name: location.name || location.id }))
  if (deleted) {
    locationEditor.close()
  }
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <template #start>
          <IonButtons>
            <IonBackButton default-href="/tabs/workspace" />
          </IonButtons>
        </template>
        <IonTitle>{{ t('workspace.locations') }}</IonTitle>
      </IonToolbar>
      <IonToolbar>
        <IonSearchbar
          v-model="searchQuery"
          :placeholder="t('common.search')"
          :debounce="300"
          animated
        />
      </IonToolbar>
    </IonHeader>

    <IonContent :fullscreen="true">
      <IonRefresher slot="fixed" @ion-refresh="async (e: CustomEvent) => { await reload(); (e.target as HTMLIonRefresherElement).complete() }">
        <IonRefresherContent />
      </IonRefresher>

      <!-- Location grid -->
      <div v-if="filteredLocations.length > 0" class="card-grid">
        <IonItemSliding v-for="location in filteredLocations" :key="location.file">
          <LocationCard
            :location="location"
            @click="handleEditLocation"
          />
          <IonItemOptions side="end">
            <IonItemOption color="danger" @click="handleDeleteLocation({ id: location.id || location.name, name: location.name, type: location.type || 'interior', description: location.description, regions: location.regions, tags: location.tags })">
              <IonIcon :icon="trashOutline" />
            </IonItemOption>
          </IonItemOptions>
        </IonItemSliding>
      </div>

      <!-- Empty state -->
      <div v-else-if="searchQuery" class="empty-state">
        <IonNote>{{ t('locations.emptySearch') }}</IonNote>
      </div>
      <div v-else class="empty-state">
        <div class="empty-state__illustration">
          🏰
        </div>
        <p class="empty-state__title">
          {{ t('workspace.noLocations') }}
        </p>
        <IonButton fill="outline" size="small" @click="locationEditor.openCreate()">
          <IonIcon :icon="addOutline" />
          {{ t('contentEditor.createLocation') }}
        </IonButton>
      </div>

      <!-- FAB add button -->
      <IonFab slot="fixed" vertical="bottom" horizontal="end">
        <IonFabButton @click="locationEditor.openCreate()">
          <IonIcon :icon="addOutline" />
        </IonFabButton>
      </IonFab>

      <!-- Location Editor Modal -->
      <ContentEditorModal
        :is-open="locationEditor.isOpen.value"
        :title="locationEditor.mode.value === 'create' ? t('contentEditor.createLocation') : t('contentEditor.editLocation')"
        :mode="locationEditor.mode.value"
        :is-saving="isSaving"
        :markdown="locationMarkdown"
        :monaco-filename="`${locationEditor.formData.value.id || 'location'}.md`"
        @update:is-open="(v: boolean) => { if (!v) locationEditor.close() }"
        @update:markdown="locationMarkdown = $event"
        @sync-to-markdown="locationToMarkdown()"
        @sync-from-markdown="markdownToLocation($event)"
        @save="handleSaveLocation"
        @cancel="locationEditor.close()"
      >
        <template #form>
          <LocationEditorForm v-model="locationEditor.formData.value" />
        </template>
        <template #header-actions>
          <IonButton
            v-if="locationEditor.mode.value === 'edit'"
            fill="clear"
            color="danger"
            size="small"
            @click="handleDeleteLocation(locationEditor.formData.value)"
          >
            <IonIcon :icon="trashOutline" />
          </IonButton>
        </template>
      </ContentEditorModal>
    </IonContent>
  </IonPage>
</template>

<style scoped>
.card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: var(--adv-space-sm);
  padding: var(--adv-space-md);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--adv-space-xl) var(--adv-space-md);
  text-align: center;
  gap: var(--adv-space-sm);
}

.empty-state__illustration {
  font-size: 48px;
  opacity: 0.6;
}

.empty-state__title {
  font-size: var(--adv-font-body);
  color: var(--adv-text-tertiary);
  margin: 0;
}

@media (max-width: 767px) {
  .card-grid {
    grid-template-columns: 1fr;
  }
}
</style>
```

---

## 7. CARD & FORM COMPONENTS

### LocationCard.vue

**File**: `/apps/studio/src/components/LocationCard.vue`

**Reference**: `SceneCard.vue` (lines 1-80)

```vue
<script setup lang="ts">
import type { LocationInfo } from '../composables/useProjectContent'
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
} from '@ionic/vue'

defineProps<{
  location: LocationInfo
}>()

defineEmits<{
  click: [location: LocationInfo]
}>()
</script>

<template>
  <IonCard @click="$emit('click', location)">
    <IonCardHeader>
      <div class="card-badge">
        {{ location.type?.charAt(0).toUpperCase() }}
      </div>
      <IonCardTitle>{{ location.name }}</IonCardTitle>
    </IonCardHeader>
    <IonCardContent v-if="location.description" class="card-description">
      {{ location.description?.slice(0, 100) }}{{ location.description?.length ?? 0 > 100 ? '...' : '' }}
    </IonCardContent>
  </IonCard>
</template>

<style scoped>
.card-badge {
  display: inline-block;
  padding: 4px 8px;
  background: rgba(var(--ion-color-primary-rgb, 56, 128, 255), 0.15);
  border-radius: 4px;
  font-size: 12px;
  font-weight: bold;
  color: var(--ion-color-primary);
  margin-bottom: 8px;
}

.card-description {
  font-size: 14px;
  color: var(--adv-text-secondary);
  line-height: 1.4;
}

ion-card {
  cursor: pointer;
  transition:
    transform 150ms,
    box-shadow 150ms;
}

ion-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
}
</style>
```

### LocationEditorForm.vue

**File**: `/apps/studio/src/components/LocationEditorForm.vue`

**Reference**: `SceneEditorForm.vue` (119 lines)

```vue
<script setup lang="ts">
import type { LocationFormData } from '../utils/locationMd'
import {
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonSelect,
  IonSelectOption,
  IonTextarea,
} from '@ionic/vue'
import { useI18n } from 'vue-i18n'
import TagsInput from './TagsInput.vue'

const { t } = useI18n()
const model = defineModel<LocationFormData>({ required: true })

function updateField<K extends keyof LocationFormData>(field: K, value: LocationFormData[K]) {
  model.value = { ...model.value, [field]: value }
}
</script>

<template>
  <div class="location-editor-form">
    <IonListHeader>
      <IonLabel>{{ t('contentEditor.basicInfo') }}</IonLabel>
    </IonListHeader>
    <IonList>
      <IonItem>
        <IonInput
          :value="model.id"
          :label="t('contentEditor.locationId')"
          label-placement="stacked"
          :placeholder="t('contentEditor.locationIdPlaceholder')"
          @ion-input="updateField('id', ($event.detail.value ?? ''))"
        />
      </IonItem>
      <IonItem>
        <IonInput
          :value="model.name || ''"
          :label="t('contentEditor.locationName')"
          label-placement="stacked"
          :placeholder="t('contentEditor.locationNamePlaceholder')"
          @ion-input="updateField('name', ($event.detail.value ?? ''))"
        />
      </IonItem>
      <IonItem>
        <IonSelect
          :value="model.type || 'interior'"
          :label="t('contentEditor.locationType')"
          label-placement="stacked"
          interface="popover"
          @ion-change="updateField('type', ($event.detail.value ?? 'interior') as 'interior' | 'exterior' | 'abstract')"
        >
          <IonSelectOption value="interior">
            {{ t('contentEditor.locationTypeInterior') }}
          </IonSelectOption>
          <IonSelectOption value="exterior">
            {{ t('contentEditor.locationTypeExterior') }}
          </IonSelectOption>
          <IonSelectOption value="abstract">
            {{ t('contentEditor.locationTypeAbstract') }}
          </IonSelectOption>
        </IonSelect>
      </IonItem>
      <IonItem>
        <div class="form-field">
          <IonLabel position="stacked">
            {{ t('contentEditor.tags') }}
          </IonLabel>
          <TagsInput
            :model-value="model.tags || []"
            :placeholder="t('contentEditor.tagsPlaceholder')"
            @update:model-value="updateField('tags', $event)"
          />
        </div>
      </IonItem>
    </IonList>

    <IonListHeader>
      <IonLabel>{{ t('contentEditor.description') }}</IonLabel>
    </IonListHeader>
    <IonList>
      <IonItem>
        <IonTextarea
          :value="model.description || ''"
          :label="t('contentEditor.locationDescription')"
          label-placement="stacked"
          :placeholder="t('contentEditor.locationDescriptionPlaceholder')"
          :auto-grow="true"
          :rows="3"
          @ion-input="updateField('description', ($event.detail.value ?? ''))"
        />
      </IonItem>
    </IonList>

    <IonListHeader>
      <IonLabel>{{ t('contentEditor.regions') }}</IonLabel>
    </IonListHeader>
    <IonList>
      <IonItem>
        <div class="form-field">
          <IonLabel position="stacked">
            {{ t('contentEditor.regionsPlaceholder') }}
          </IonLabel>
          <TagsInput
            :model-value="model.regions || []"
            :placeholder="t('contentEditor.regionInputPlaceholder')"
            @update:model-value="updateField('regions', $event)"
          />
        </div>
      </IonItem>
    </IonList>
  </div>
</template>

<style scoped>
.location-editor-form {
  padding-bottom: var(--adv-space-lg);
}

.form-field {
  width: 100%;
  padding: var(--adv-space-sm) 0;
}
</style>
```

---

## 8. INTERNATIONALIZATION (i18n)

### English Translations

**File**: `/apps/studio/src/i18n/locales/en.json`

**Add under `workspace` section** (around line 94-170):

```json
"locations": "Locations",
"noLocations": "No location files found",
```

**Add new top-level section** (after `"scenes": {...}`):

```json
"locations": {
  "confirmDelete": "Delete location \"{name}\"? This cannot be undone.",
  "emptySearch": "No locations match your search"
},
```

**Add under `contentEditor` section** (around line 180-350):

```json
"createLocation": "Create Location",
"editLocation": "Edit Location",
"locationId": "Location ID",
"locationIdPlaceholder": "tavern, forest-edge",
"locationName": "Location Name",
"locationNamePlaceholder": "The Wayward Tavern",
"locationType": "Location Type",
"locationTypeInterior": "Interior",
"locationTypeExterior": "Exterior",
"locationTypeAbstract": "Abstract",
"locationDescription": "Description",
"locationDescriptionPlaceholder": "Describe the location's atmosphere, appearance, and significance",
"regions": "Regions",
"regionsPlaceholder": "Main areas or rooms (e.g., main-hall, kitchen)",
"regionInputPlaceholder": "Enter region name and press Enter",
```

### Chinese Translations

**File**: `/apps/studio/src/i18n/locales/zh-CN.json`

**Add under `workspace` section**:

```json
"locations": "地点",
"noLocations": "未找到地点文件",
```

**Add new top-level section**:

```json
"locations": {
  "confirmDelete": "删除地点 \"{name}\" 吗？此操作无法撤销。",
  "emptySearch": "没有匹配的地点"
},
```

**Add under `contentEditor` section**:

```json
"createLocation": "创建地点",
"editLocation": "编辑地点",
"locationId": "地点ID",
"locationIdPlaceholder": "tavern, forest-edge",
"locationName": "地点名称",
"locationNamePlaceholder": "旅人酒馆",
"locationType": "地点类型",
"locationTypeInterior": "室内",
"locationTypeExterior": "室外",
"locationTypeAbstract": "抽象",
"locationDescription": "描述",
"locationDescriptionPlaceholder": "描述地点的氛围、外观和意义",
"regions": "区域",
"regionsPlaceholder": "主要区域或房间（例如，主厅、厨房）",
"regionInputPlaceholder": "输入区域名称，按Enter键",
```

---

## 9. INTEGRATION WITH CHARACTER STATE

### Location Tracking in Character State

**File**: `apps/studio/src/stores/useCharacterStateStore.ts` (already has location field!)

The character state already supports location tracking. Review these key sections:

**Line 32**: `Location: ${currentState.location || '(unknown)'}`

- Location is already extracted from conversations
- Updated via AI analysis in `extractStateFromTurn()`

**Line 112**: `state.location` is included in system prompt formatting

**Leverage this in locations module**:

1. When creating a location, characters can reference it
2. Location names from the locations module can be suggested in character state
3. Character diary entries can mention location names

---

## 10. KEY PATTERNS & CONVENTIONS

### File Path Convention

```
adv/locations/{id}.md  ← Standard path
```

### ID Convention

- Lowercase with hyphens: `tavern`, `forest-edge`, `merchant-square`
- No spaces, special characters except hyphens and underscores
- Matches regex: `/^[\w-]+$/`

### Markdown Format

```yaml
---
id: location-id
name: Display Name
type: interior # or exterior, abstract
description: Long-form description
regions:
  - region1
  - region2
tags:
  - tag1
  - tag2
---
```

### Composable Pattern

```typescript
// Always create from defaults
const locationEditor = useContentEditor<LocationFormData>(
  'location',
  () => ({
    id: '',
    name: '',
    type: 'interior',
    description: '',
    regions: [],
    tags: [],
  })
)

// Sync between form and markdown
function locationToMarkdown() {
  locationMarkdown.value = stringifyLocationMd(locationEditor.formData.value)
}

function markdownToLocation(md: string) {
  try {
    const parsed = parseLocationMd(md)
    locationEditor.formData.value = parsed
  }
  catch {
    // Silent fail on parse error
  }
}
```

### Validation Rule

- ID: required, matches `/^[\w-]+$/`
- Name: required, any string
- Type: required, one of 'interior', 'exterior', 'abstract'
- Description: optional
- Regions: optional, array of strings
- Tags: optional, array of strings

---

## 11. IMPLEMENTATION CHECKLIST

- [ ] Create `LocationFormData` interface in `locationMd.ts`
- [ ] Create `parseLocationMd()` and `stringifyLocationMd()` functions
- [ ] Create `LocationInfo` interface in `useProjectContent.ts`
- [ ] Add location loading to `loadFromDir()` in `useProjectContent.ts`
- [ ] Add location loading to `loadFromCos()` in `useProjectContent.ts`
- [ ] Export `locations` from `useProjectContent()`
- [ ] Update database schema in `db.ts` (add `DbLocation` and table)
- [ ] Add route to `router/index.ts`
- [ ] Create `LocationsPage.vue`
- [ ] Create `LocationCard.vue`
- [ ] Create `LocationEditorForm.vue`
- [ ] Add `useContentEditor` case for 'location' in validation
- [ ] Add `useContentSave` case for 'location'
- [ ] Add i18n keys to `en.json`
- [ ] Add i18n keys to `zh-CN.json`
- [ ] Test create, read, update, delete operations
- [ ] Test search/filter functionality
- [ ] Test draft persistence
- [ ] Test markdown sync
- [ ] Integration test with character state location extraction

---

## 12. REFERENCE ARCHITECTURE SUMMARY

```
LocationsPage (view)
  ├── uses: useProjectContent() → locations.value
  ├── uses: useContentEditor('location') → state machine
  ├── uses: useContentSave() → file writing
  ├── uses: useContentDelete() → deletion
  ├── renders: LocationCard[] (grid)
  └── modal: ContentEditorModal
       ├── form: LocationEditorForm
       └── markdown: locationMd sync

useProjectContent()
  └── loads adv/locations/*.md files
  └── parses with parseLocationMd()
  └── returns LocationInfo[]

useContentSave()
  └── handles 'location' type
  └── writes to adv/locations/{id}.md
  └── detects duplicates

useContentDelete()
  └── deletes adv/locations/{id}.md
  └── confirmation dialog

useContentEditor('location')
  └── draft persistence
  └── validation
  └── state machine
```

---

## 13. TYPICAL WORKFLOW

1. **Page Load**: LocationsPage calls `useProjectContent()` → loads all locations
2. **Create**: User clicks FAB → `locationEditor.openCreate()` → form opens
3. **Edit Form**: User enters ID, Name, Type, Regions, Tags
4. **Markdown Sync**: Form ↔ Markdown updates via `locationToMarkdown()` / `markdownToLocation()`
5. **Save**: User clicks Save → validation → `useContentSave()` → writes `adv/locations/{id}.md`
6. **Reload**: Page reloads via `reload()` → updates grid
7. **Delete**: User swipes or clicks trash → confirmation dialog → `useContentDelete()` → removes file
