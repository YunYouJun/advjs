# Studio Locations Module - Type System & UI Components Analysis

## 1. Type System Overview

### Package Location

- **Path**: `packages/types/src/game/`
- **Main Export**: `packages/types/src/game/index.ts`

### Existing Type Patterns

#### Scene Type Definition

**File**: `packages/types/src/game/scene.ts`

```typescript
export interface AdvBaseScene {
  id: string
  name?: string
  alias?: string
  description?: string
  imagePrompt?: string
  type?: 'image' | 'model' // Discriminated union pattern
}

export interface AdvSceneImage extends AdvBaseScene {
  type: 'image'
  src: string
}

export interface AdvSceneModel extends AdvBaseScene {
  type: 'model'
}

export type AdvScene = AdvSceneImage | AdvSceneModel
```

**Pattern**: Base interface + discriminated union by `type` field

#### Character Type Definition

**File**: `packages/types/src/game/character.ts`

```typescript
export interface AdvCharacterFrontmatter {
  id: string
  name: string
  avatar?: string
  tags?: string[]
  faction?: string
  aliases?: string[]
  cv?: string // Voice actor
  relationships?: AdvCharacterRelationship[]
  tachies?: Record<string, AdvTachie> // Standing images
}

export interface AdvCharacterBody {
  appearance?: string
  personality?: string
  background?: string
  concept?: string
  speechStyle?: string
  knowledgeDomain?: string
  expertisePrompt?: string
}

export interface AdvCharacterDynamicState {
  location?: string
  health?: string
  activity?: string
  attributes?: Record<string, number>
  recentEvents?: string[]
  lastUpdated?: string
}

export interface AdvCharacter extends AdvCharacterFrontmatter, AdvCharacterBody {
  createdAt?: string
  updatedAt?: string
  feishuRecordId?: string
  dynamicState?: AdvCharacterDynamicState
}
```

**Pattern**: Separate interfaces for frontmatter (YAML), body (markdown sections), dynamic state (runtime), merged together

#### Music Type Definition

**File**: `packages/types/src/game/music.ts`

```typescript
export interface AdvMusic {
  name: string
  description?: string
  src?: string // Auto-concatenated path
  duration?: number
  tags?: string[]
  linkedScenes?: string[]
  linkedChapters?: string[]
}
```

**Pattern**: Simple metadata + optional references to other content

#### World Type Definition

**File**: `packages/types/src/game/world.ts`

```typescript
export type DayPeriod = 'morning' | 'afternoon' | 'evening' | 'night'

export interface WorldClockState {
  date: string // YYYY-MM-DD
  period: DayPeriod
  weather?: string
  running: boolean
  timeScale: number
  lastTickAt?: number
}

export interface WorldEvent {
  id: string
  date: string
  period: DayPeriod
  summary: string
  type: 'daily' | 'social' | 'unexpected' | 'weather' | 'manual'
  characterIds?: string[]
  timestamp: number
}
```

**Pattern**: Enum-like strings for discriminated types + temporal metadata

### Recommended Location Type Structure

```typescript
export interface AdvLocationBase {
  id: string
  name: string
  alias?: string
  description?: string
  imagePrompt?: string
  type?: 'image' | '3d-model'
}

export interface AdvLocationImage extends AdvLocationBase {
  type: 'image'
  src: string // Background image path
}

export interface AdvLocationModel extends AdvLocationBase {
  type: '3d-model'
}

export type AdvLocation = AdvLocationImage | AdvLocationModel

// Optional: Links to other content
export interface AdvLocationMetadata {
  tags?: string[]
  linkedCharacters?: string[] // Characters present in location
  linkedScenes?: string[]
  linkedChapters?: string[]
  npcs?: string[] // Character IDs of NPCs present
  items?: string[] // Inventory items present
}
```

---

## 2. UI Components Architecture

### Project Structure

- **Path**: `apps/studio/src/`
- **Components**: `apps/studio/src/components/`
- **Views**: `apps/studio/src/views/`
- **Workspace Pages**: `apps/studio/src/views/workspace/`

### Component Patterns

#### StatsCard.vue

**File**: `apps/studio/src/components/StatsCard.vue`
**Purpose**: Dashboard stat display with icon, value, label, accent color
**Props**:

```typescript
interface Props {
  icon: string // Ionicon reference
  value: number | string
  label: string
  accent: string // CSS color variable name
}
```

**Features**:

- Hover effect with colored top bar
- Arrow indicator on hover
- Responsive scaling
- Click emission

**Pattern**: Generic stat card for dashboard — perfect for "Locations" count

#### RecentActivity.vue

**File**: `apps/studio/src/components/RecentActivity.vue`
**Purpose**: Show recently edited/viewed items
**Key Code**:

```typescript
const TYPE_ICON: Record<string, string> = {
  chapter: '📖',
  character: '👤',
  scene: '🎬',
  file: '📄',
}
```

**Pattern**: Emoji icons for content types + router navigation

**Should Add**:

```typescript
const TYPE_ICON: Record<string, string> = {
  chapter: '📖',
  character: '👤',
  scene: '🎬',
  location: '📍', // or '🗺️'
  file: '📄',
}
```

#### SceneCard.vue / CharacterCard.vue Pattern

**Files**:

- `apps/studio/src/components/SceneCard.vue`
- `apps/studio/src/components/CharacterCard.vue`

**Common Structure**:

```vue
<script setup lang="ts">
import type { AdvScene } from '@advjs/types'
import { imageOutline } from 'ionicons/icons'

defineProps<{
  scene: AdvScene
}>()

defineEmits<{
  click: [scene: AdvScene]
}>()
</script>

<template>
  <div class="card-wrapper">
    <button class="card" @click="$emit('click', scene)">
      <!-- Visual preview/avatar area -->
      <!-- Info section with name, description, tags -->
      <!-- Footer with metadata -->
    </button>
  </div>
</template>

<style scoped>
.card {
  /* Button styling with hover effects */
}
.card__image {
  /* Preview image */
}
.card__body {
  /* Text content */
}
</style>
```

**For LocationCard**, pattern would be:

- Image thumbnail (scene background)
- Location name
- Description
- Tags
- linked characters/scenes count
- Click handler to navigate to editor

---

## 3. Workspace Module Structure

### Router Configuration

**File**: `apps/studio/src/router/index.ts`

**Current Workspace Modules**:

```
/tabs/workspace                 → ProjectsPage
/tabs/workspace/chapters        → ChaptersPage
/tabs/workspace/characters      → CharactersPage
/tabs/workspace/scenes          → ScenesPage
/tabs/workspace/audio           → AudioPage
/tabs/workspace/knowledge       → KnowledgePage
/tabs/workspace/marketplace     → MarketplacePage
```

**To Add Locations**:

```typescript
{
  path: 'workspace/locations',
  component: () => import('@/views/workspace/LocationsPage.vue'),
}
```

### Tab Navigation Configuration

**File**: `apps/studio/src/views/TabsPage.vue`

**Current Implementation**:

```typescript
import { chatbubbleOutline, globeOutline, layersOutline, personOutline, playOutline } from 'ionicons/icons'

const navItems = [
  { tab: 'workspace', href: '/tabs/workspace', icon: layersOutline, label: 'tabs.workspace' },
  { tab: 'chat', href: '/tabs/chat', icon: chatbubbleOutline, label: 'tabs.chat' },
  { tab: 'world', href: '/tabs/world', icon: globeOutline, label: 'tabs.world' },
  { tab: 'play', href: '/tabs/play', icon: playOutline, label: 'tabs.play' },
  { tab: 'me', href: '/tabs/me', icon: personOutline, label: 'tabs.me' },
]
```

**Note**: Locations would be a sub-module under workspace, NOT a main tab

- Use within workspace like `ScenesPage`, `CharactersPage`
- Navigable via workspace navigation or sub-tabs

### Workspace Page Pattern

**File**: `apps/studio/src/views/workspace/ScenesPage.vue` (11,300 lines)
**File**: `apps/studio/src/views/workspace/CharactersPage.vue` (9,194 lines)

**Common Structure**:

1. **Script Setup**:
   - Import form components (SceneEditorForm, CharacterEditorForm)
   - Import useProjectContent hook
   - Import useContentSave, useContentDelete
   - Import useRecentActivity for tracking
   - State: activeItem, isEditing, searchQuery, etc.

2. **Header**:
   - IonHeader with IonToolbar
   - Search bar (IonSearchbar)
   - Add button (IonFabButton with addOutline icon)

3. **Content**:
   - IonRefresher for pull-to-refresh
   - Grid/List of cards (SceneCard, CharacterCard)
   - Empty state message

4. **Actions**:
   - Modal for editing (ContentEditorModal)
   - Delete with confirmation
   - Generate AI content option

5. **Composables Used**:
   ```typescript
   const { scenes, reload, getDirHandle } = useProjectContent()
   const { isSaving, saveContent } = useContentSave()
   const { deleteFile } = useContentDelete()
   const { trackAccess } = useRecentActivity()
   ```

---

## 4. Project Content System

### useProjectContent Composable

**File**: `apps/studio/src/composables/useProjectContent.ts`

**Exported Info Interfaces**:

```typescript
export interface ChapterInfo {
  file: string
  name: string
  preview: string
  content?: string
}

export interface SceneInfo {
  file: string
  name: string
  id?: string
  description?: string
  imagePrompt?: string
  type?: 'image' | 'model'
  tags?: string[]
  src?: string
}

export interface AudioInfo {
  file: string
  name: string
  description?: string
  src?: string
  duration?: number
  tags?: string[]
  linkedScenes?: string[]
  linkedChapters?: string[]
}

export interface ProjectStats {
  chapters: number
  characters: number
  scenes: number
  knowledge: number
  audios: number
}
```

**For Locations**, add to ProjectStats:

```typescript
export interface ProjectStats {
  chapters: number
  characters: number
  scenes: number
  locations: number // NEW
  knowledge: number
  audios: number
}
```

**Add LocationInfo**:

```typescript
export interface LocationInfo {
  file: string
  name: string
  id?: string
  description?: string
  imagePrompt?: string
  type?: 'image' | '3d-model'
  tags?: string[]
  src?: string
  linkedCharacters?: string[]
  linkedScenes?: string[]
}
```

### File Structure

**Locations would be stored**:

```
project-root/
├── adv/
│   ├── locations/
│   │   ├── {locationId}.md
│   │   ├── {locationId}.jpg (auto-generated from imagePrompt)
│   │   └── ...
```

---

## 5. Ionicons Usage & Recommendations

### Current Icons Used in Studio

**File Search Results**: 49 files import from 'ionicons/icons'

**Common Icons**:

- `addOutline` - Add buttons
- `trashOutline` - Delete actions
- `chevronForwardOutline` - Navigation indicators
- `timeOutline` - Time/recent activity
- `imageOutline` - Image/media indicators
- `layersOutline` - Workspace tab (layers metaphor)
- `chatbubbleOutline` - Chat tab
- `globeOutline` - World tab
- `playOutline` - Play tab
- `personOutline` - Me/Profile tab

### Available Map/Location Icons in Ionicons

**Checked**: No `mapOutline` or `locationOutline` found in current code

**Available alternatives** (in ionicons package):

- `mapOutline` - Available in ionicons library ✓
- `pinOutline` - Pin marker variant
- `navigateOutline` - Navigation arrow
- `compassOutline` - Compass/direction
- `globeOutline` - World (already used for world tab)

**Recommendation for Locations Module**:

```typescript
import { mapOutline } from 'ionicons/icons'

// In TabsPage if Locations becomes main tab (not recommended):
{ tab: 'locations', href: '/tabs/locations', icon: mapOutline, label: 'tabs.locations' }

// In workspace sub-tab navigation:
{ name: 'Locations', href: '/tabs/workspace/locations', icon: mapOutline }
```

---

## 6. Store Architecture

### useStudioStore

**File**: `apps/studio/src/stores/useStudioStore.ts`

**Manages**:

```typescript
export interface StudioProject {
  projectId: string
  name: string
  dirHandle?: FileSystemDirectoryHandle
  url?: string
  source?: 'local' | 'url' | 'cos'
  cosPrefix?: string
  lastOpened: number
}

const currentProject = ref<StudioProject | null>(null)
const projects = ref<StudioProject[]>([])
```

**Project-scoped stores** (initialized per project):

- useCharacterChatStore
- useCharacterMemoryStore
- useCharacterStateStore
- useGroupChatStore
- useWorldEventStore
- useWorldClockStore
- useChatStore
- useViewModeStore
- useCharacterDiaryStore

**For Locations**: Could add `useLocationStore` if runtime state needed (e.g., characters' current locations)

---

## 7. Recent Activity Tracking

### useRecentActivity Composable

**Usage Pattern**:

```typescript
const { trackAccess } = useRecentActivity()

// When user edits a location
trackAccess({
  id: locationId,
  label: locationName,
  type: 'location',
  action: 'edit',
})
```

**RecentItem Type** (inferred from usage):

```typescript
interface RecentItem {
  id: string
  label: string
  type: 'chapter' | 'character' | 'scene' | 'location' // Add location
  action: 'edit' | 'view'
  avatar?: string
  timestamp: number
}
```

---

## 8. Existing Location References

### Found in Character Component

**File**: `apps/studio/src/components/CharacterCard.vue`

```typescript
const props = defineProps<{
  character: AdvCharacter
  mood?: string
  location?: string  // Display current location
}>()

// Rendered as:
<div v-if="location" class="cc-location">
  📍 {{ location }}
</div>
```

**File**: `apps/studio/src/components/CharacterInfoModal.vue`

```typescript
<div v-if="dynamicState.location" class="ci-state__item">
  <span class="ci-state__label">{{ t('world.location') }}</span>
  <span class="ci-state__value">📍 {{ dynamicState.location }}</span>
</div>
```

**In Character Dynamic State**:

```typescript
export interface AdvCharacterDynamicState {
  location?: string // Currently references location by NAME
  health?: string
  activity?: string
  // ...
}
```

**Connection Point**: Location names are displayed here; could link to LocationId instead

---

## 9. Key File Locations Summary

| Purpose                  | File Path                                            |
| ------------------------ | ---------------------------------------------------- |
| Scene Type               | `packages/types/src/game/scene.ts`                   |
| Character Type           | `packages/types/src/game/character.ts`               |
| World Type               | `packages/types/src/game/world.ts`                   |
| Music Type               | `packages/types/src/game/music.ts`                   |
| Type Exports             | `packages/types/src/game/index.ts`                   |
| Router Config            | `apps/studio/src/router/index.ts`                    |
| Tabs Navigation          | `apps/studio/src/views/TabsPage.vue`                 |
| StatsCard Component      | `apps/studio/src/components/StatsCard.vue`           |
| RecentActivity Component | `apps/studio/src/components/RecentActivity.vue`      |
| CharacterCard Pattern    | `apps/studio/src/components/CharacterCard.vue`       |
| SceneCard Pattern        | `apps/studio/src/components/SceneCard.vue`           |
| ScenesPage Pattern       | `apps/studio/src/views/workspace/ScenesPage.vue`     |
| CharactersPage Pattern   | `apps/studio/src/views/workspace/CharactersPage.vue` |
| useProjectContent        | `apps/studio/src/composables/useProjectContent.ts`   |
| useStudioStore           | `apps/studio/src/stores/useStudioStore.ts`           |

---

## 10. Implementation Checklist

### Type System (packages/types/)

- [ ] Create `packages/types/src/game/location.ts` with AdvLocation interfaces
- [ ] Export from `packages/types/src/game/index.ts`
- [ ] Add location reference to `AdvCharacterDynamicState` (locationId?: string)

### Composables (apps/studio/src/composables/)

- [ ] Create `LocationInfo` interface in `useProjectContent.ts`
- [ ] Update `ProjectStats` to include locations count
- [ ] Add locations loading logic to `useProjectContent` (load from adv/locations/\*.md)
- [ ] Add to `useRecentActivity` TYPE_ICON mapping

### Components (apps/studio/src/components/)

- [ ] Create `LocationCard.vue` (based on SceneCard/CharacterCard pattern)
- [ ] Create `LocationEditorForm.vue` (based on SceneEditorForm pattern)
- [ ] Update `RecentActivity.vue` to include 'location' type
- [ ] Update dashboard to show location stats

### Views (apps/studio/src/views/workspace/)

- [ ] Create `LocationsPage.vue` (based on ScenesPage/CharactersPage pattern)
- [ ] Implement search, add, edit, delete functionality
- [ ] Add AI image generation for locations

### Router (apps/studio/src/router/)

- [ ] Add route: `workspace/locations` → LocationsPage

### Icons

- [ ] Import `mapOutline` from ionicons
- [ ] Add navigation item to workspace (if sub-menu) or main tabs

### i18n (localization strings needed)

- [ ] `tabs.locations` or similar
- [ ] `workspace.locations`
- [ ] Location-specific action messages

---

## 11. Visual Patterns & Styling

### Color Scheme (CSS Variables)

From various components:

```css
--adv-surface-card        /* Card background */
--adv-surface-elevated    /* Hover background */
--adv-border-subtle       /* Border color */
--adv-text-primary        /* Main text */
--adv-text-secondary      /* Secondary text */
--adv-text-tertiary       /* Tertiary text */
--adv-space-sm/md/lg      /* Spacing */
--adv-radius-md           /* Border radius */
--ion-color-primary       /* Accent color */
```

### Component Patterns

1. **Cards**: Flex layout, rounded borders, hover effects, click handlers
2. **Forms**: TextInput, Textarea, TagsInput, checkbox components
3. **Actions**: Modal dialogs, bottom sheets, confirmation dialogs
4. **Lists**: IonList, IonItem, IonItemSliding for actions
5. **Navigation**: Router-based, IonButton/IonFabButton for actions

---

## 12. File Naming & Organization

### Convention Pattern

- Types: `*.ts` in `packages/types/src/game/`
- Components: PascalCase `LocationCard.vue`, `LocationEditorForm.vue`
- Views: PascalCase `LocationsPage.vue`
- Composables: Camelcase `useLocationContent.ts` or extend existing
- Stores: `useLocationStore.ts` if needed
- Utils: Lowercase/camelcase `locationMd.ts` for parsing

### Markdown File Format

Following character/scene pattern:

```yaml
---
id: home-base
name: Home Base
description: The team's safe house
imagePrompt: "A cozy apartment interior, warm lighting, worn furniture"
type: image
tags:
  - safe-house
  - headquarters
linkedCharacters:
  - hero-id
  - companion-id
linkedScenes:
  - scene-id-1
---

## Background
The team first found this place during the initial mission...

## Current Residents
- Hero (main character)
- Companion (support)
- NPC guide

## Notable Features
- Hidden exit to basement
- Communication equipment
```
