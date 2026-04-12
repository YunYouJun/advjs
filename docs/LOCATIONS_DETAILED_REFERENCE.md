# Locations Module - Detailed Implementation Reference

## Project Structure Summary

**Created by**: Analysis of existing CRUD patterns in apps/studio
**Date**: April 2026
**Reference modules**: Scenes, Characters, Chapters, Audio

---

## Key Files & Line Numbers

### Reference Implementation Files

| File                     | Path                                 | Lines | Purpose                                           |
| ------------------------ | ------------------------------------ | ----- | ------------------------------------------------- |
| **ScenesPage.vue**       | `views/workspace/ScenesPage.vue`     | 316   | ✅ **Primary reference** - canonical CRUD pattern |
| **CharactersPage.vue**   | `views/workspace/CharactersPage.vue` | 289   | ✅ Secondary reference - variations               |
| **sceneMd.ts**           | `utils/sceneMd.ts`                   | 73    | ✅ Reference for markdown format                  |
| **useContentEditor.ts**  | `composables/useContentEditor.ts`    | 189   | ✅ Generic state machine                          |
| **useContentSave.ts**    | `composables/useContentSave.ts`      | 226   | ✅ Generic save handler                           |
| **useContentDelete.ts**  | `composables/useContentDelete.ts`    | 61    | ✅ Generic delete handler                         |
| **useProjectContent.ts** | `composables/useProjectContent.ts`   | 425   | ⚠️ Needs LocationInfo + loading                   |
| **SceneCard.vue**        | `components/SceneCard.vue`           | 80    | ✅ Reference card pattern                         |
| **SceneEditorForm.vue**  | `components/SceneEditorForm.vue`     | 119   | ✅ Reference form pattern                         |
| **router/index.ts**      | `router/index.ts`                    | 139   | ⚠️ Add locations route (line 33)                  |
| **db.ts**                | `utils/db.ts`                        | ~200  | ⚠️ Add DbLocation interface (optional)            |

---

## Implementation Workflow

### Phase 1: Core Utilities (30 mins)

#### 1.1 Create `locationMd.ts`

**File**: `apps/studio/src/utils/locationMd.ts`

Template from `sceneMd.ts` (lines 1-73):

- Import yaml, frontmatter utilities
- Define `LocationFormData` interface
- Implement `parseLocationMd()`
- Implement `stringifyLocationMd()`

**Key differences from sceneMd**:

- Add `type` field (interior|exterior|abstract)
- Add `regions` array field
- Update FRONTMATTER_KEYS array

**Estimated lines**: 80-100

---

### Phase 2: UI Components (45 mins)

#### 2.1 Create `LocationCard.vue`

**File**: `apps/studio/src/components/LocationCard.vue`

Template from `SceneCard.vue` (lines 1-80):

- Display location name
- Show type badge
- Show description preview
- Click handler

**Estimated lines**: 80-90

#### 2.2 Create `LocationEditorForm.vue`

**File**: `apps/studio/src/components/LocationEditorForm.vue`

Template from `SceneEditorForm.vue` (lines 1-119):

- ID field (IonInput)
- Name field (IonInput)
- Type select (interior/exterior/abstract)
- Tags input (TagsInput component)
- Regions input (TagsInput component)
- Description textarea

**Estimated lines**: 150-180

#### 2.3 Create `LocationsPage.vue`

**File**: `apps/studio/src/views/workspace/LocationsPage.vue`

**Copy from `ScenesPage.vue` (316 lines), replace all**:

- `scene` → `location`
- `Scene` → `Location`
- `scenes` → `locations`
- `SceneInfo` → `LocationInfo`
- `SceneFormData` → `LocationFormData`
- `SceneCard` → `LocationCard`
- `SceneEditorForm` → `LocationEditorForm`
- `parseSceneMd` → `parseLocationMd`
- `stringifySceneMd` → `stringifyLocationMd`
- Emoji 🎬 → 🏰

**Keep sections intact**:

- Header with back button
- Searchbar
- Pull-to-refresh
- Draft restore banner
- Card grid (or FAB button)
- Empty states (3 variants: no results, search empty, project empty)
- Content editor modal

**Estimated lines**: 300-330

---

### Phase 3: Content Loading (30 mins)

#### 3.1 Update `useProjectContent.ts`

**File**: `apps/studio/src/composables/useProjectContent.ts`

**Line ~10-11**: Add import

```typescript
import { parseLocationMd } from '../utils/locationMd'
```

**Line ~30**: Add LocationInfo interface (after AudioInfo)

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

**Line ~57**: Add module state (after audios)

```typescript
const locations = ref<LocationInfo[]>([])
```

**Line ~143-172**: Add location loading in loadFromDir()
Copy pattern from scenes (lines 143-172):

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

**Line ~240-260**: Add similar block to loadFromCos()
(Replace listFilesInDir with filter on allFiles)

**Line ~224-230**: Update stats

```typescript
stats.value = {
  chapters: chapterInfos.length,
  characters: charList.length,
  scenes: sceneList.length,
  knowledge: knowledgeBase.entries.value.length,
  audios: audioList.length,
  locations: locationList.length, // ADD
}
```

**Line ~410-423**: Export locations in return

```typescript
return {
  chapters,
  characters,
  scenes,
  audios,
  locations, // ADD
  stats,
  // ... rest
}
```

---

### Phase 4: Composable Integration (15 mins)

#### 4.1 Update `useContentSave.ts`

**File**: `apps/studio/src/composables/useContentSave.ts`

**Line ~1-4**: Add import

```typescript
import type { LocationFormData } from '../utils/locationMd'
```

**Line ~8**: Update ContentType union (in JSDoc/types if needed)

**Line ~124-152**: Add location case in switch statement

```typescript
case 'location': {
  const location = data as LocationFormData
  filePath = `adv/locations/${location.id}.md`

  // Check for duplicate path on create, or rename on edit
  if (mode === 'create') {
    if (await fileExists(dirHandle, filePath)) {
      return {
        success: false,
        error: `File already exists: ${filePath}. Please use a different ID.`,
      }
    }
  }
  else if (originalId && originalId !== location.id) {
    // ID changed during edit — check new path doesn't conflict
    if (await fileExists(dirHandle, filePath)) {
      return {
        success: false,
        error: `Cannot rename: ${filePath} already exists.`,
      }
    }
  }

  content = stringifyLocationMd(location)
  break
}
```

#### 4.2 Update `useContentEditor.ts`

**File**: `apps/studio/src/composables/useContentEditor.ts`

**Line ~8**: Update ContentType

```typescript
export type ContentType = 'character' | 'scene' | 'chapter' | 'audio' | 'location'
```

**Line ~138-172**: Add validation case

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

**Note**: No type imports needed - use `any` or extend if necessary

---

### Phase 5: Router & Database (15 mins)

#### 5.1 Update `router/index.ts`

**File**: `apps/studio/src/router/index.ts`

**Line ~33**: Add route (after scenes route at line 32)

```typescript
{
  path: 'workspace/locations',
  component: () => import('@/views/workspace/LocationsPage.vue'),
},
```

#### 5.2 Update `db.ts` (Optional)

**File**: `apps/studio/src/utils/db.ts`

**Line ~80-95**: Add interface (after DbCharacterAiConfig)

```typescript
export interface DbLocation {
  projectId: string
  locationId: string
  data: LocationFormData
}
```

**Note**: Don't need to modify Dexie version unless using location state persistence

---

### Phase 6: Internationalization (20 mins)

#### 6.1 Update English translations

**File**: `apps/studio/src/i18n/locales/en.json`

**Line ~110** (workspace section):

```json
"locations": "Locations",
"noLocations": "No location files found",
```

**New section after "scenes"** (around line 575+):

```json
"locations": {
  "confirmDelete": "Delete location \"{name}\"? This cannot be undone.",
  "emptySearch": "No locations match your search"
},
```

**In contentEditor section** (add ~20 new keys):

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

#### 6.2 Update Chinese translations

**File**: `apps/studio/src/i18n/locales/zh-CN.json`

Same structure with Chinese translations.

---

## Data Model Reference

### LocationFormData Interface

```typescript
export interface LocationFormData {
  id: string // "tavern" or "forest-edge"
  name: string // "The Wayward Tavern"
  type?: 'interior' | 'exterior' | 'abstract' // default: 'interior'
  description?: string // Multi-line description
  regions?: string[] // ["main-hall", "kitchen"]
  tags?: string[] // ["drinks", "gossip"]
  alias?: string | string[] // Alternative names (optional)
}
```

### LocationInfo Interface

```typescript
export interface LocationInfo {
  file: string // "adv/locations/tavern.md"
  name: string
  id?: string
  description?: string
  type?: 'interior' | 'exterior' | 'abstract'
  regions?: string[]
  tags?: string[]
}
```

### Markdown File Format

```yaml
---
id: tavern
name: The Wayward Tavern
type: interior
description: A cozy establishment known for hearth, hospitality, and tales
regions:
  - main-hall
  - kitchen
  - private-room
tags:
  - drinks
  - gossip
  - music
alias:
  - The Wayside
  - Old Tavern
---
```

---

## Component Tree

```
LocationsPage
  ├── Header (back + title + search)
  ├── IonRefresher (pull-to-refresh)
  ├── DraftRestoreBanner (if hasDraft)
  ├── LocationGrid
  │   └── IonItemSliding (per location)
  │       ├── LocationCard (clickable)
  │       └── IonItemOptions (delete action)
  ├── EmptyState (0 results or search empty)
  ├── FAB button (create new)
  └── ContentEditorModal
       ├── LocationEditorForm (form template)
       ├── AiGeneratePanel (optional)
       └── Delete button (edit mode only)
```

---

## Composable Usage Pattern

```typescript
// 1. Initialize
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

// 2. Get content
const { locations, reload, getDirHandle } = useProjectContent()
const { isSaving, saveContent } = useContentSave()
const { deleteFile } = useContentDelete()

// 3. Lifecycle
locationEditor.openCreate() // New location
locationEditor.openEdit(data) // Edit existing
locationEditor.close() // Close modal
locationEditor.onSaved() // After save
locationEditor.validate() // Get errors array

// 4. Markdown sync
function locationToMarkdown() {
  locationMarkdown.value = stringifyLocationMd(locationEditor.formData.value)
}

function markdownToLocation(md: string) {
  try {
    const parsed = parseLocationMd(md)
    locationEditor.formData.value = parsed
  }
  catch {
    // Silent fail - keep form unchanged
  }
}

// 5. Save
async function handleSaveLocation() {
  const errors = locationEditor.validate()
  if (errors.length > 0) {
    showToast(t('contentEditor.validationError', { errors: errors.join(', ') }), 'warning')
    return
  }

  const dirHandle = getDirHandle()
  if (!dirHandle) {
    showToast(t('contentEditor.saveFailed', { error: 'No directory handle' }), 'danger')
    return
  }

  const result = await saveContent(
    dirHandle,
    'location',
    locationEditor.mode.value,
    locationEditor.formData.value,
    locationEditor.originalId.value
  )

  if (result.success) {
    showToast(t('contentEditor.saveSuccess'))
    locationEditor.onSaved()
    locationEditor.close()
    await reload()
  }
}
```

---

## Testing Checklist

### CRUD Operations

- [ ] **Create**: New location saves with correct file structure
- [ ] **Read**: Locations list loads correctly on page open
- [ ] **Update**: Edit location updates file and UI
- [ ] **Delete**: Delete with confirmation removes file

### Validation

- [ ] ID required validation
- [ ] Name required validation
- [ ] ID regex validation (alphanumeric-hyphen only)
- [ ] Type field defaults to 'interior'

### UI/UX

- [ ] Search/filter works on name, description, tags, type
- [ ] Empty state shows when no locations
- [ ] Search empty state shows when search has no results
- [ ] Grid responsive (mobile: 1 col, desktop: auto-fill 200px)
- [ ] Card click opens editor modal
- [ ] Slide action shows delete button
- [ ] FAB button appears on bottom-right

### Features

- [ ] Markdown sync (form ↔ markdown editor)
- [ ] Draft persistence (reload page, draft restored)
- [ ] Recent activity tracked
- [ ] Pull-to-refresh reloads content
- [ ] Proper i18n strings loaded
- [ ] Modal closes on save or cancel

### Integration

- [ ] Works with local projects
- [ ] Works with cloud (COS) projects
- [ ] Locations appear in project stats
- [ ] Character state can reference location names

---

## Common Gotchas

1. **Validation**: Add `else if (contentType === 'location')` to useContentEditor, not in separate place
2. **Import**: Don't forget to import `parseLocationMd` in useProjectContent.ts
3. **File path**: Always `adv/locations/{id}.md` - check for typos
4. **Type field**: Default to 'interior', not undefined
5. **Modal sync**: Form changes → markdown automatically via modal, not manual
6. **Regions vs tags**: Both are arrays, use TagsInput component for both
7. **Markdown format**: YAML frontmatter only, no markdown body needed
8. **Route path**: `/tabs/workspace/locations` must match router config

---

## Performance Notes

- **Lazy loading**: Route imported with `() => import()`
- **Search debounced**: 300ms debounce on searchbar (standard pattern)
- **Grid virtualization**: Not implemented (OK for <100 locations)
- **Image optimization**: Not needed (locations are metadata-only)

---

## Future Enhancements

1. **Location hierarchy**: Parent/child relationships
2. **Visual editor**: Drag-drop region creator
3. **Map integration**: Visual representation
4. **Connection graph**: Show character ↔ location connections
5. **Timeline**: Show location usage across chapters
6. **Image assets**: Add background images/thumbnails
7. **AI generation**: Generate descriptions from prompts

---

## Documentation Files

- `LOCATIONS_CRUD_PATTERN.md` (1075 lines) - Complete architecture
- `LOCATIONS_QUICK_START.md` (350 lines) - Quick reference
- `LOCATIONS_DETAILED_REFERENCE.md` (this file) - Line-by-line guide
