# Studio CRUD Pattern Analysis - Locations Module Implementation Guide

## Executive Summary

The studio app uses a well-structured, modular CRUD pattern for managing content types (Characters, Scenes, Chapters, Audio). This document provides a complete blueprint for replicating this pattern for a new "Locations" module.

---

## 1. DIRECTORY STRUCTURE & FILE ORGANIZATION

### Project Structure

```
apps/studio/src/
├── views/
│   ├── workspace/
│   │   ├── CharactersPage.vue       ← CRUD list + editor UI
│   │   ├── ScenesPage.vue           ← Alternative CRUD pattern
│   │   └── (AudioPage, ChaptersPage, KnowledgePage)
│   ├── CharacterInfoPage.vue         ← Detail/read-only view
│   └── TabsPage.vue                  ← Main tab router wrapper
├── components/
│   ├── CharacterEditorForm.vue       ← Form component
│   ├── SceneEditorForm.vue           ← Form component variant
│   ├── CharacterCard.vue             ← List item display
│   ├── SceneCard.vue                 ← List item variant
│   ├── CharacterCardActions.vue      ← Action buttons
│   └── ContentEditorModal.vue        ← Reusable modal wrapper
├── composables/
│   ├── useContentEditor.ts           ← State machine for editor
│   ├── useContentSave.ts             ← Serialization & file I/O
│   ├── useContentDelete.ts           ← Deletion with confirmation
│   ├── useProjectContent.ts          ← Content loading & caching
│   ├── useRecentActivity.ts          ← Activity tracking
│   └── (others)
├── stores/
│   ├── useCharacterStateStore.ts     ← Location tracking reference
│   └── (other Pinia stores)
├── utils/
│   ├── db.ts                         ← Dexie database schema
│   ├── sceneMd.ts                    ← Markdown serialization
│   ├── projectPersistence.ts         ← IndexedDB helpers
│   ├── projectScope.ts               ← Multi-project context
│   └── (others)
├── i18n/locales/
│   ├── en.json
│   └── zh-CN.json
└── router/index.ts                   ← Route registration
```

### File Naming Convention

- Page: `{Entity}Page.vue` (e.g., `CharactersPage.vue`)
- Form: `{Entity}EditorForm.vue` (e.g., `CharacterEditorForm.vue`)
- Card: `{Entity}Card.vue` (e.g., `CharacterCard.vue`)
- Utilities: `{entity}Md.ts` (e.g., `sceneMd.ts`)

---

## 2. DATA MODEL & TYPES

### Location Type (to create)

Based on Character and Scene patterns:

```typescript
// types (from @advjs/types)
export interface AdvLocation {
  id: string
  name: string
  description?: string
  region?: string
  category?: string // e.g., "town", "dungeon", "landmark"
  associations?: string[] // character IDs or scene IDs
  imagePrompt?: string
  atmosphere?: string // mood/feeling description
  tags?: string[]
  createdAt?: string
  updatedAt?: string
}

// For studio editing
export interface LocationFormData extends AdvLocation {
  src?: string // image path
}

// Dynamic state (stored in useCharacterStateStore)
// Characters reference locations via: dynamicState.location = "LocationId"
```

### File Format

- **Extension**: `.location.md`
- **Path**: `adv/locations/{id}.location.md`
- **Structure**: YAML frontmatter + optional markdown body

```yaml
---
id: cathedral-square
name: Cathedral Square
region: old-town
category: plaza
description: A historic plaza...
imagePrompt: A medieval cathedral plaza with...
tags: [urban, historical, public-space]
---

## Atmosphere
[Description of mood, sounds, sights]

## Notable Features
- The fountain in center
- Stone archways
```

---

## 3. CORE COMPOSABLES PATTERN

### A. useContentEditor.ts

Generic state machine for create/edit workflows:

```typescript
export function useContentEditor<T>(
  contentType: 'location',
  createDefault: () => LocationFormData
)

// Returns:
{
  isOpen: Ref<boolean>              // Modal visibility
  mode: Ref<'create' | 'edit'>       // Current mode
  formData: Ref<LocationFormData>    // Reactive form data
  originalId: Ref<string>            // For rename detection
  hasDraft: Ref<boolean>             // Draft exists in localStorage

  openCreate()                       // Initialize new
  openEdit(location: LocationFormData)  // Load for editing
  restoreDraft(): boolean            // Restore from localStorage
  close()                            // Close modal, keep draft
  onSaved()                          // Clear draft after success
  clearDraft()                       // Discard draft
  validate(): string[]               // Validation errors
}

// Implementation: uses localStorage for auto-save drafts with 7-day TTL
// Draft key: `advjs-studio-draft-{projectId}-location`
```

### B. useContentSave.ts

Handles serialization and file I/O:

```typescript
export function useContentSave() {
  return {
    isSaving: Ref<boolean>

    async saveContent(
      dirHandle: FileSystemDirectoryHandle,
      contentType: 'location',
      mode: 'create' | 'edit',
      data: LocationFormData,
      originalId?: string
    ): Promise<SaveResult>
  }
}

// Logic:
// 1. Validate file doesn't exist (create mode)
// 2. Check rename conflicts (edit mode with id change)
// 3. Extract data URIs → save images to: adv/assets/locations/{id}/
// 4. Serialize to markdown
// 5. Write to: adv/locations/{id}.location.md
// 6. Return success or error
```

### C. useContentDelete.ts

Deletion with Ionic alert confirmation:

```typescript
export function useContentDelete() {
  return {
    async deleteFile(
      filePath: string,           // e.g. "adv/locations/cathedral.location.md"
      confirmMessage: string      // UI confirmation text
    ): Promise<boolean>           // true if deleted
  }
}

// Uses: alertController from @ionic/vue
// Calls: reload() from useProjectContent to refresh list
```

### D. useProjectContent.ts

Central content loading and caching:

```typescript
export function useProjectContent() {
  // Module-level singleton refs
  const locations = ref<LocationInfo[]>([])
  const characters = ref<AdvCharacter[]>([])
  const scenes = ref<SceneInfo[]>([])
  // ...
  const stats = ref<ProjectStats>({ locations: 0, ... })

  return {
    locations,                    // Reactive array
    characters,
    scenes,
    audios,
    stats,
    isLoading: Ref<boolean>

    async loadFromDir(dirHandle)  // Load from local FileSystemHandle
    async loadFromCos(cosConfig, prefix)  // Load from cloud
    async reload()                // Refresh from last source
    getDirHandle()                // Get current handle for saving
    $reset()                      // Clear all on project switch
  }
}

// Key patterns:
// - Shared singleton state across entire app
// - Auto-triggered on currentProject change (via watch)
// - Supports both local (FileSystemDirectoryHandle) & cloud (COS)
// - Loads from: adv/locations/*.location.md
```

---

## 4. DATABASE SCHEMA (Dexie)

### Location State Table (if needed)

```typescript
// In db.ts - add new table definition

export interface DbLocationState {
  projectId: string
  locationId: string
  state: AdvLocationDynamicState  // e.g., current population, events
}

// In StudioDatabase class:
export class StudioDatabase extends Dexie {
  locationStates!: Dexie.Table<DbLocationState, [string, string]>

  // In version() declaration:
  this.version(12).stores({
    // ... existing tables
    locationStates: '[projectId+locationId]'
  })
}
```

### Reference: Character State Pattern

```typescript
export interface DbCharacterState {
  projectId: string
  characterId: string
  state: AdvCharacterDynamicState // { location?, health?, activity?, ... }
}
```

Key principle: **Compound primary keys** `[projectId+entityId]` for multi-project support.

---

## 5. UI COMPONENTS PATTERN

### A. LocationsPage.vue (Main CRUD List)

**Location**: `apps/studio/src/views/workspace/LocationsPage.vue`

```vue
<script setup lang="ts">
// 1. Setup composables
const { locations, reload, getDirHandle } = useProjectContent()
const { isSaving, saveContent } = useContentSave()
const { deleteFile } = useContentDelete()
const locationEditor = useContentEditor('location', () => ({
  id: '',
  name: '',
  description: '',
  category: '',
  tags: [],
}))

// 2. Search/filter
const searchQuery = ref('')
const filteredLocations = computed(() => {
  if (!searchQuery.value) return locations.value
  const q = searchQuery.value.toLowerCase()
  return locations.value.filter(l =>
    l.name.toLowerCase().includes(q) ||
    l.category?.toLowerCase().includes(q) ||
    l.tags?.some(t => t.toLowerCase().includes(q))
  )
})

// 3. Create handler
function handleCreateLocation() {
  locationEditor.openCreate()
}

// 4. Edit handler
function handleEditLocation(location: LocationFormData) {
  locationEditor.openEdit(location)
}

// 5. Save handler
async function handleSaveLocation() {
  const errors = locationEditor.validate()
  if (errors.length > 0) {
    await showToast(t('contentEditor.validationError', ...))
    return
  }
  const dirHandle = getDirHandle()
  if (!dirHandle) { /* error */ }
  const result = await saveContent(
    dirHandle, 'location', locationEditor.mode.value,
    locationEditor.formData.value, locationEditor.originalId.value
  )
  if (result.success) {
    await showToast(t('contentEditor.saveSuccess'))
    locationEditor.onSaved()
    locationEditor.close()
    await reload()
  }
}

// 6. Delete handler
async function handleDeleteLocation(location: LocationFormData) {
  const filePath = `adv/locations/${location.id}.location.md`
  const deleted = await deleteFile(filePath,
    t('locations.confirmDelete', { name: location.name })
  )
  if (deleted) {
    locationEditor.close()
  }
}
</script>

<template>
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>{{ t('workspace.locations') }}</IonTitle>
        <IonButtons slot="end">
          <IonButton @click="handleCreateLocation">
            <IonIcon :icon="addOutline" />
          </IonButton>
        </IonButtons>
      </IonToolbar>
    </IonHeader>

    <IonContent>
      <IonSearchbar v-model="searchQuery" />

      <DraftRestoreBanner
        v-if="locationEditor.hasDraft"
        @restore="locationEditor.restoreDraft()"
      />

      <!-- List of locations -->
      <div v-if="filteredLocations.length">
        <LocationCard
          v-for="location in filteredLocations"
          :key="location.id"
          :location="location"
          @edit="handleEditLocation(location)"
          @delete="handleDeleteLocation(location)"
        />
      </div>
      <div v-else class="empty-state">
        {{ t('workspace.noLocations') }}
      </div>
    </IonContent>

    <!-- Editor Modal -->
    <ContentEditorModal
      :is-open="locationEditor.isOpen"
      :title="locationEditor.mode === 'create' ?
        t('locations.create') : t('locations.edit')"
      :mode="locationEditor.mode"
      :markdown="locationMarkdown"
      @update:is-open="v => locationEditor.isOpen = v"
      @save="handleSaveLocation"
      @cancel="locationEditor.close()"
    >
      <LocationEditorForm v-model="locationEditor.formData" />
    </ContentEditorModal>
  </IonPage>
</template>
```

### B. LocationEditorForm.vue (Form Component)

**Location**: `apps/studio/src/components/LocationEditorForm.vue`

```vue
<script setup lang="ts">
const model = defineModel<LocationFormData>({ required: true })

function updateField<K extends keyof LocationFormData>(
  field: K,
  value: LocationFormData[K]
) {
  model.value = { ...model.value, [field]: value }
}
</script>

<template>
  <div class="location-form">
    <IonItem>
      <IonLabel position="floating">
        {{ t('contentEditor.id') }}
      </IonLabel>
      <IonInput
        v-model="model.id"
        placeholder="my-location"
      />
    </IonItem>

    <IonItem>
      <IonLabel position="floating">
        {{ t('contentEditor.name') }}
      </IonLabel>
      <IonInput v-model="model.name" />
    </IonItem>

    <IonItem>
      <IonLabel position="floating">
        {{ t('locations.category') }}
      </IonLabel>
      <IonSelect v-model="model.category">
        <IonSelectOption value="town">
          Town
        </IonSelectOption>
        <IonSelectOption value="dungeon">
          Dungeon
        </IonSelectOption>
        <IonSelectOption value="landmark">
          Landmark
        </IonSelectOption>
      </IonSelect>
    </IonItem>

    <IonItem>
      <IonLabel position="floating">
        {{ t('contentEditor.description') }}
      </IonLabel>
      <IonTextarea v-model="model.description" rows="4" />
    </IonItem>

    <IonItem>
      <IonLabel position="floating">
        {{ t('locations.imagePrompt') }}
      </IonLabel>
      <IonTextarea v-model="model.imagePrompt" rows="3" />
    </IonItem>

    <TagsInput v-model="model.tags" :label="t('contentEditor.tags')" />
  </div>
</template>
```

### C. LocationCard.vue (List Item)

```vue
<script setup lang="ts">
defineProps<{ location: LocationFormData }>()
defineEmits<{ edit: [location: LocationFormData], delete: [location: LocationFormData] }>()
</script>

<template>
  <div class="location-card">
    <div class="location-card__content">
      <h3>{{ location.name }}</h3>
      <p v-if="location.region" class="location-card__region">
        {{ location.region }}
      </p>
      <p v-if="location.description" class="location-card__desc">
        {{ location.description.slice(0, 100) }}...
      </p>
    </div>
    <div class="location-card__actions">
      <IonButton @click="$emit('edit', location)">
        {{ t('common.edit') }}
      </IonButton>
      <IonButton @click="$emit('delete', location)">
        {{ t('common.delete') }}
      </IonButton>
    </div>
  </div>
</template>
```

---

## 6. ROUTER CONFIGURATION

### Route Registration

**File**: `apps/studio/src/router/index.ts`

```typescript
const routes: Array<RouteRecordRaw> = [
  {
    path: '/tabs/',
    component: TabsPage,
    children: [
      // ... existing routes
      {
        path: 'workspace/locations',
        component: () => import('@/views/workspace/LocationsPage.vue'),
      },
      // Optional: Location detail view
      {
        path: 'world/location/:locationId',
        component: () => import('@/views/LocationDetailPage.vue'),
      },
    ],
  },
]
```

### Tab Integration

Add to tab navigation (likely in `TabsPage.vue`):

```vue
<IonTabButton tab="workspace-locations" href="/tabs/workspace/locations">
  <IonIcon icon={mapOutline} />
  <IonLabel>{{ t('workspace.locations') }}</IonLabel>
</IonTabButton>
```

---

## 7. INTERNATIONALIZATION (i18n)

### Translation Keys

**File**: `apps/studio/src/i18n/locales/en.json`

```json
{
  "workspace": {
    "locations": "Locations",
    "noLocations": "No location files found"
  },
  "locations": {
    "title": "Locations",
    "create": "Create Location",
    "edit": "Edit Location",
    "confirmDelete": "Delete location \"{name}\"? This cannot be undone.",
    "category": "Category",
    "imagePrompt": "Image Prompt",
    "region": "Region",
    "atmosphere": "Atmosphere",
    "associations": "Associated Characters/Scenes",
    "emptySearch": "No locations match your search"
  },
  "contentEditor": {
    "id": "Location ID",
    "name": "Location Name",
    "description": "Description",
    "tags": "Tags"
  }
}
```

Duplicate in `zh-CN.json` with Chinese translations.

---

## 8. MARKDOWN SERIALIZATION UTILITY

### Create: locationMd.ts

**File**: `apps/studio/src/utils/locationMd.ts`

```typescript
import type { AdvLocation } from '@advjs/types'
import yaml from 'js-yaml'
import { dumpYamlFrontmatter, parseFrontmatterAndBody } from './mdFrontmatter'

const LOCATION_FRONTMATTER_KEYS: string[] = [
  'id',
  'name',
  'description',
  'region',
  'category',
  'imagePrompt',
  'associations',
  'tags',
  'src',
]

export interface LocationFormData extends AdvLocation {
  src?: string // image path
}

export function parseLocationMd(content: string): LocationFormData {
  const { frontmatter, body } = parseFrontmatterAndBody(content)
  const fm = (frontmatter ? yaml.load(frontmatter) : {}) as Record<string, any>

  if (!fm.id || typeof fm.id !== 'string')
    throw new Error('Location .md must have a string `id` in frontmatter')

  const location: LocationFormData = {
    id: fm.id,
    name: fm.name || fm.id,
    description: fm.description || body.trim() || undefined,
    region: fm.region,
    category: fm.category,
    imagePrompt: fm.imagePrompt,
    associations: fm.associations,
    tags: fm.tags,
    src: fm.src,
  }

  return Object.fromEntries(
    Object.entries(location).filter(([_, v]) => v !== undefined)
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

---

## 9. CONTENT LOADING IN useProjectContent.ts

### Addition to loadFromDir()

```typescript
// Load locations
const locationList: LocationInfo[] = []
try {
  const locationFiles = await listFilesInDir(dirHandle, 'adv/locations', '.location.md')
  for (const file of locationFiles) {
    try {
      const content = await readFileFromDir(dirHandle, file)
      const location = parseLocationMd(content)
      locationList.push({
        file,
        name: location.name,
        id: location.id,
        category: location.category,
        region: location.region,
        description: location.description,
        src: location.src,
      })
    }
    catch { /* parse error */ }
  }
}
catch { /* no locations dir */ }
locations.value = locationList

// Update stats
stats.value = {
  chapters: chapterInfos.length,
  characters: charList.length,
  scenes: sceneList.length,
  locations: locationList.length, // ← Add this
  knowledge: knowledgeBase.entries.value.length,
  audios: audioList.length,
}
```

### LocationInfo Interface

```typescript
export interface LocationInfo {
  file: string
  name: string
  id?: string
  category?: string
  region?: string
  description?: string
  src?: string
}
```

---

## 10. VALIDATION RULES

### useContentEditor.ts - validate() function

Add to switch statement:

```typescript
else if (contentType === 'location') {
  const location = data as LocationFormData
  if (!location.id?.trim())
    errors.push('Location ID is required')
  if (!location.name?.trim())
    errors.push('Location name is required')
  if (location.id && !ID_RE.test(location.id))
    errors.push('ID must contain only letters, numbers, hyphens, and underscores')
  if (!location.category?.trim())
    errors.push('Category is required')
}
```

---

## 11. INTEGRATION WITH CHARACTER STATE

### Reference Location from Character State

Characters track their current location via `AdvCharacterDynamicState`:

```typescript
// In useCharacterStateStore.ts
export interface AdvCharacterDynamicState {
  location?: string  // ← This is the location ID
  health?: string
  activity?: string
  // ...
}

// Extract location from conversation:
const state = getState(characterId)
const prompt = buildStateExtractionPrompt(
  characterName, userMessage, assistantMessage, state
)
// Returns: { location: "cathedral-square", ... }

// Display in UI (CharacterInfoPage.vue):
<div v-if="dynamicState.location">
  <span class="label">{{ t('world.location') }}</span>
  <span class="value">{{ dynamicState.location }}</span>
</div>
```

---

## 12. KEY DESIGN PATTERNS

### A. Reactive Form with Two-Way Sync

```typescript
// Form → Markdown
function locationToMarkdown() {
  locationMarkdown.value = stringifyLocationMd(locationEditor.formData.value)
}

// Markdown → Form (on tab switch)
function markdownToLocation(md: string) {
  locationMarkdown.value = md
  try {
    const parsed = parseLocationMd(md)
    locationEditor.formData.value = parsed
  }
  catch { /* keep formData unchanged */ }
}
```

### B. Draft Persistence

- **Auto-save**: Triggered by watcher on `formData` while editor is open
- **Storage**: `localStorage` with key: `advjs-studio-draft-{projectId}-location`
- **Lifespan**: 7 days TTL, auto-discarded on save
- **UX**: Show `DraftRestoreBanner` if draft exists

### C. Multi-Project Support

```typescript
// Every table uses compound primary keys:
// [projectId+entityId]

// When project changes:
const projectId = getCurrentProjectId() // from route param or store
const rows = await db.locationStates
  .where('projectId')
  .equals(projectId)
  .toArray()

// Claim default data on first open:
export async function claimDefaultData(projectId: string) {
  await db.locationStates
    .where('projectId')
    .equals(DEFAULT_PROJECT_ID)
    .modify((row: any) => row.projectId = projectId)
}
```

### D. Cloud Sync (COS) Support

- Load from Tencent COS bucket with prefix
- Same file structure: `{prefix}/adv/locations/*.location.md`
- Implemented via `downloadFromCloud()` and `listCloudFiles()`

---

## 13. TESTING CHECKLIST

- [ ] Create location → saved to `adv/locations/{id}.location.md`
- [ ] Edit location → updates file content & reloads UI
- [ ] Delete location → shows confirmation, removes file
- [ ] Markdown editor → sync form ↔ markdown bidirectionally
- [ ] Draft persistence → restore from localStorage
- [ ] Search/filter → by name, category, tags
- [ ] Image upload → data URI extracted & saved to `assets/locations/{id}/`
- [ ] Validation → ID required, unique, alphanumeric
- [ ] Multi-project → locations isolated per project in DB
- [ ] i18n → all strings translated

---

## 14. FUTURE ENHANCEMENTS

1. **Location State Store** (useLocationStateStore.ts)
   - Track dynamic state (current population, events, weather)
   - Similar pattern to useCharacterStateStore

2. **Location Linking**
   - Visual map showing character locations
   - Relationship graph between locations (adjacent areas, connections)

3. **Location-Scoped Scenes**
   - Filter scenes by location
   - Track which scenes occur in which locations

4. **AI Generation**
   - Generate location descriptions from prompts
   - Generate atmospheric text from image prompts

---

## SUMMARY: Core Files to Create

1. **View**: `apps/studio/src/views/workspace/LocationsPage.vue`
2. **Components**:
   - `LocationEditorForm.vue`
   - `LocationCard.vue`
3. **Composables**:
   - Add to existing `useContentEditor`, `useContentSave`, `useContentDelete`
   - Update `useProjectContent.ts` with location loading
4. **Utils**:
   - `locationMd.ts` (parse/stringify)
5. **Database**: Update `db.ts` if tracking location state
6. **i18n**: Add translations to `en.json` and `zh-CN.json`
7. **Router**: Add route to `router/index.ts`
8. **Types**: Add `LocationFormData` and interfaces to types package
