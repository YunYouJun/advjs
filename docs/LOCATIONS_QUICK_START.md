# Locations Module - Quick Start Implementation Guide

## Overview

Replicating the Scene/Character CRUD pattern for Locations. All existing composables are reusable; only need 3 new files + updates to 2 existing files.

---

## 📋 Files to Create (3 new files)

### 1. `/apps/studio/src/utils/locationMd.ts`

Markdown parsing utility (ref: `sceneMd.ts`)

```typescript
// Defines LocationFormData interface with fields:
// - id: string (required)
// - name: string (required)
// - type: 'interior' | 'exterior' | 'abstract' (required)
// - description?: string
// - regions?: string[]
// - tags?: string[]

// Exports:
// - parseLocationMd(content: string): LocationFormData
// - stringifyLocationMd(location: LocationFormData): string
```

**File Path**: `apps/studio/src/utils/locationMd.ts` (80-100 lines)

---

### 2. `/apps/studio/src/components/LocationCard.vue`

Card component for location grid display

**File Path**: `apps/studio/src/components/LocationCard.vue` (~80 lines)
**Props**: `location: LocationInfo`
**Emits**: `click`

---

### 3. `/apps/studio/src/components/LocationEditorForm.vue`

Form fields for location editing

**File Path**: `apps/studio/src/components/LocationEditorForm.vue` (~150 lines)
**v-model**: `LocationFormData`
**Fields**: ID, Name, Type (select), Tags, Regions, Description

---

### 4. `/apps/studio/src/views/workspace/LocationsPage.vue`

Main page component (canonical pattern page)

**File Path**: `apps/studio/src/views/workspace/LocationsPage.vue` (~300 lines)
**Pattern**: Copy from `ScenesPage.vue`, replace 'scene' with 'location'

Key sections:

- Search/filter
- Card grid display
- Empty states
- Modal with form + markdown editor
- CRUD operations via shared composables

---

## 📝 Files to Update (2-3 files)

### 1. `/apps/studio/src/composables/useProjectContent.ts`

**Add interface**:

```typescript
export interface LocationInfo {
  file: string
  name: string
  id?: string
  description?: string
  type?: 'interior' | 'exterior' | 'abstract'
  regions?: string[]
  tags?: string[]
}
```

**Add module-level state**:

```typescript
const locations = ref<LocationInfo[]>([])
```

**In loadFromDir()** (~20 lines):

```typescript
// Load locations
const locationList: LocationInfo[] = []
try {
  const locationFiles = await listFilesInDir(dirHandle, 'adv/locations', '.md')
  for (const file of locationFiles) {
    try {
      const content = await readFileFromDir(dirHandle, file)
      const parsed = parseLocationMd(content)
      locationList.push({ file, name: parsed.name || ..., id: parsed.id, ... })
    } catch { ... }
  }
} catch { /* no locations dir */ }
locations.value = locationList
```

**In loadFromCos()** (~15 lines): Same pattern, using `downloadFromCloud()`

**Update stats.value** to include locations

**Export locations** in return statement

---

### 2. `/apps/studio/src/router/index.ts`

**Add route** (after scenes route):

```typescript
{
  path: 'workspace/locations',
  component: () => import('@/views/workspace/LocationsPage.vue'),
},
```

---

### 3. `/apps/studio/src/utils/db.ts` (Optional but recommended)

**Add interface**:

```typescript
export interface DbLocation {
  projectId: string
  locationId: string
  data: LocationFormData
}
```

**Add table** to Dexie schema (if using locations persistence):

```typescript
db.version(N).stores({
  // ... existing
  locations: 'locationId, projectId'
})
```

---

## 🔤 i18n Updates

### `/apps/studio/src/i18n/locales/en.json`

**In workspace section** (line ~110):

```json
"locations": "Locations",
"noLocations": "No location files found",
```

**New section** (after scenes):

```json
"locations": {
  "confirmDelete": "Delete location \"{name}\"? This cannot be undone.",
  "emptySearch": "No locations match your search"
},
```

**In contentEditor section**:

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
"locationDescriptionPlaceholder": "Describe the location's atmosphere and appearance",
"regions": "Regions",
"regionsPlaceholder": "Main areas or rooms (e.g., main-hall, kitchen)",
"regionInputPlaceholder": "Enter region name and press Enter",
```

### `/apps/studio/src/i18n/locales/zh-CN.json`

Same structure with Chinese translations.

---

## ⚙️ Reusable Composables (NO CHANGES)

These already work for any content type:

- **`useContentEditor('location', defaults)`** → state machine, validation, draft persistence
- **`useContentSave()`** → file writing, duplicate detection (just add 'location' case)
- **`useContentDelete()`** → confirmation + deletion (already generic)

---

## 🔄 useContentSave.ts Update

**In switch statement** (around line 124):

```typescript
case 'location': {
  const location = data as LocationFormData
  filePath = `adv/locations/${location.id}.md`

  if (mode === 'create') {
    if (await fileExists(dirHandle, filePath)) {
      return { success: false, error: `File already exists...` }
    }
  } else if (originalId && originalId !== location.id) {
    if (await fileExists(dirHandle, filePath)) {
      return { success: false, error: `Cannot rename...` }
    }
  }

  content = stringifyLocationMd(location)
  break
}
```

---

## 🔍 Validation (useContentEditor.ts)

**In validate() method** (line 138-172), add case:

```typescript
else if (contentType === 'location') {
  const location = data as LocationFormData
  if (!location.id?.trim())
    errors.push('ID is required')
  if (!location.name?.trim())
    errors.push('Name is required')
  if (location.id && !ID_RE.test(location.id))
    errors.push('ID must contain only letters, numbers, hyphens, and underscores')
}
```

---

## 📂 Markdown Format

```yaml
---
id: tavern
name: The Wayward Tavern
type: interior
description: A cozy tavern known for warmth and adventure
regions:
  - main-hall
  - kitchen
  - private-room
tags:
  - drinks
  - gossip
  - music
---
```

---

## ✅ Implementation Checklist

**File Creation**:

- [ ] `locationMd.ts` - markdown parsing
- [ ] `LocationCard.vue` - grid card
- [ ] `LocationEditorForm.vue` - form fields
- [ ] `LocationsPage.vue` - main page

**File Updates**:

- [ ] `useProjectContent.ts` - add LocationInfo + loading
- [ ] `useContentSave.ts` - add 'location' case
- [ ] `useContentEditor.ts` - add 'location' validation
- [ ] `router/index.ts` - add route
- [ ] `db.ts` - add DbLocation interface/table (optional)
- [ ] `en.json` - add translations
- [ ] `zh-CN.json` - add translations

**Testing**:

- [ ] Create location
- [ ] Edit location
- [ ] Delete location
- [ ] Search/filter
- [ ] Draft persistence
- [ ] Markdown sync
- [ ] Mobile responsive

---

## 🎯 Code Patterns to Follow

### Page Component Pattern

```typescript
// 1. Setup
const locationEditor = useContentEditor<LocationFormData>('location', () => ({
  id: '', name: '', type: 'interior', ...
}))

// 2. Handlers
async function handleSaveLocation() {
  const errors = locationEditor.validate()
  if (errors.length) { showToast(...); return }

  const result = await saveContent(dirHandle, 'location',
    locationEditor.mode.value, locationEditor.formData.value,
    locationEditor.originalId.value)

  if (result.success) {
    showToast(t('contentEditor.saveSuccess'))
    locationEditor.onSaved()
    locationEditor.close()
    await reload()
  }
}

// 3. Template
<ContentEditorModal
  :is-open="locationEditor.isOpen.value"
  @save="handleSaveLocation"
>
  <template #form>
    <LocationEditorForm v-model="locationEditor.formData.value" />
  </template>
</ContentEditorModal>
```

### Form Component Pattern

```typescript
const model = defineModel<LocationFormData>()

function updateField<K extends keyof LocationFormData>(field: K, value: LocationFormData[K]) {
  model.value = { ...model.value, [field]: value }
}
```

### Markdown Sync Pattern

```typescript
function locationToMarkdown() {
  locationMarkdown.value = stringifyLocationMd(locationEditor.formData.value)
}

function markdownToLocation(md: string) {
  try {
    const parsed = parseLocationMd(md)
    locationEditor.formData.value = parsed
  }
  catch {
    // Silent fail
  }
}
```

---

## 🔗 Reference Files

- **ScenesPage.vue**: 316 lines - canonical CRUD pattern
- **sceneMd.ts**: 73 lines - markdown serialization
- **SceneCard.vue**: 80 lines - card component
- **SceneEditorForm.vue**: 119 lines - form fields
- **useProjectContent.ts**: 425 lines - content loading
- **useContentEditor.ts**: 189 lines - state machine
- **useContentSave.ts**: 226 lines - file saving
- **useContentDelete.ts**: 61 lines - file deletion

---

## 💡 Key Design Decisions

1. **File Location**: `adv/locations/{id}.md`
2. **Content Type ID**: `'location'` (matches other types)
3. **Form Fields**: id, name, type, description, regions, tags
4. **Type Options**: interior, exterior, abstract (like scene type)
5. **Markdown Format**: YAML frontmatter (matches scenes/characters)
6. **Reuse Strategy**: All composables are generic, only UI/utils are new

---

## 🚀 Integration with Existing Features

- **Character State**: Already tracks location via `useCharacterStateStore.ts`
- **Recent Activity**: Auto-tracked via `useRecentActivity().trackAccess()`
- **Draft Persistence**: Built into `useContentEditor`
- **AI Generation**: Can add via `AiGeneratePanel` if needed (optional)
- **Cloud Sync**: Works automatically via `useProjectContent.loadFromCos()`
