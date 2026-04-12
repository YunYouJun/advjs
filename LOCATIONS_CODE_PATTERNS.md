# Code Pattern Examples - Building Locations Module

## Pattern 1: Type Definition (Based on Scene)

### Scene Pattern (Reference)

```typescript
// packages/types/src/game/scene.ts
export interface AdvBaseScene {
  id: string
  name?: string
  alias?: string
  description?: string
  imagePrompt?: string
  type?: 'image' | 'model'
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

### Location Pattern (To Create)

```typescript
// packages/types/src/game/location.ts
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
  src: string
}

export interface AdvLocationModel extends AdvLocationBase {
  type: '3d-model'
}

export type AdvLocation = AdvLocationImage | AdvLocationModel
```

### Export Update

```typescript
// packages/types/src/game/index.ts (ADD)
export * from './location' // NEW LINE
```

---

## Pattern 2: Component Info Interface

### Scene Pattern (Reference)

```typescript
// apps/studio/src/composables/useProjectContent.ts
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
```

### Location Pattern (To Add)

```typescript
// apps/studio/src/composables/useProjectContent.ts (ADD)
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

### ProjectStats Update

```typescript
// Before
export interface ProjectStats {
  chapters: number
  characters: number
  scenes: number
  knowledge: number
  audios: number
}

// After (ADD locations line)
export interface ProjectStats {
  chapters: number
  characters: number
  scenes: number
  locations: number // NEW
  knowledge: number
  audios: number
}
```

---

## Pattern 3: Router Configuration

### Current Routes (Reference)

```typescript
// apps/studio/src/router/index.ts
const routes: Array<RouteRecordRaw> = [
  // ... other routes ...
  {
    path: '/tabs/',
    component: TabsPage,
    children: [
      // ... other children ...
      {
        path: 'workspace/scenes',
        component: () => import('@/views/workspace/ScenesPage.vue'),
      },
      {
        path: 'workspace/audio',
        component: () => import('@/views/workspace/AudioPage.vue'),
      },
      // ... other children ...
    ],
  },
]
```

### Add Locations Route (INSERT)

```typescript
// ADD AFTER workspace/scenes route, BEFORE workspace/audio
{
  path: 'workspace/locations',
  component: () => import('@/views/workspace/LocationsPage.vue'),
},
```

---

## Pattern 4: Component Structure (LocationCard.vue)

### SceneCard Reference Structure

```vue
<script setup lang="ts">
import type { SceneInfo } from '../../composables/useProjectContent'
import { IonIcon } from '@ionic/vue'
import { imageOutline } from 'ionicons/icons'
import { computed } from 'vue'

const props = defineProps<{
  scene: SceneInfo
}>()

defineEmits<{
  click: [scene: SceneInfo]
}>()

const imageUrl = computed(() => {
  if (!props.scene.src)
    return ''
  return props.scene.src.startsWith('http')
    ? props.scene.src
    : `/img/${props.scene.src}`
})
</script>

<template>
  <div class="scene-card">
    <button class="scene__button" @click="$emit('click', scene)">
      <div v-if="imageUrl" class="scene__image">
        <img :src="imageUrl" :alt="scene.name" loading="lazy">
      </div>
      <div class="scene__body">
        <div class="scene__name">
          {{ scene.name }}
        </div>
        <div v-if="scene.description" class="scene__description">
          {{ scene.description.slice(0, 60) }}...
        </div>
        <div v-if="scene.tags?.length" class="scene__tags">
          <span v-for="tag in scene.tags.slice(0, 3)" :key="tag" class="scene__tag">
            {{ tag }}
          </span>
        </div>
      </div>
    </button>
  </div>
</template>

<style scoped>
.scene__button {
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  border: 1px solid var(--adv-border-subtle);
  background: var(--adv-surface-card);
  cursor: pointer;
  transition: all 0.2s ease;
}

.scene__button:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.scene__image {
  width: 100%;
  height: 140px;
  overflow: hidden;
  border-radius: 12px 12px 0 0;
}

.scene__image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.scene__body {
  padding: 12px;
}
</style>
```

### LocationCard Pattern (Similar)

```vue
<script setup lang="ts">
import type { LocationInfo } from '../../composables/useProjectContent'
import { IonIcon } from '@ionic/vue'
import { mapOutline } from 'ionicons/icons'
import { computed } from 'vue'

const props = defineProps<{
  location: LocationInfo
}>()

defineEmits<{
  click: [location: LocationInfo]
}>()

const imageUrl = computed(() => {
  if (!props.location.src)
    return ''
  return props.location.src.startsWith('http')
    ? props.location.src
    : `/img/${props.location.src}`
})

const linkedCount = computed(() => {
  return (props.location.linkedCharacters?.length || 0)
    + (props.location.linkedScenes?.length || 0)
})
</script>

<template>
  <div class="location-card">
    <button class="location__button" @click="$emit('click', location)">
      <div v-if="imageUrl" class="location__image">
        <img :src="imageUrl" :alt="location.name" loading="lazy">
      </div>
      <div v-else class="location__placeholder">
        <IonIcon :icon="mapOutline" />
      </div>
      <div class="location__body">
        <div class="location__name">
          {{ location.name }}
        </div>
        <div v-if="location.description" class="location__description">
          {{ location.description.slice(0, 60) }}...
        </div>
        <div v-if="location.tags?.length" class="location__tags">
          <span v-for="tag in location.tags.slice(0, 3)" :key="tag" class="location__tag">
            {{ tag }}
          </span>
        </div>
        <div v-if="linkedCount > 0" class="location__links">
          {{ linkedCount }} linked item(s)
        </div>
      </div>
    </button>
  </div>
</template>

<style scoped>
.location-card {
  /* Similar to scene card */
}

.location__placeholder {
  width: 100%;
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%);
  font-size: 48px;
  color: var(--ion-color-primary);
}
</style>
```

---

## Pattern 5: Recent Activity Update

### Before

```typescript
// apps/studio/src/components/RecentActivity.vue
const TYPE_ICON: Record<string, string> = {
  chapter: '📖',
  character: '👤',
  scene: '🎬',
  file: '📄',
}
```

### After (ADD location)

```typescript
// apps/studio/src/components/RecentActivity.vue
const TYPE_ICON: Record<string, string> = {
  chapter: '📖',
  character: '👤',
  scene: '🎬',
  location: '📍', // NEW
  file: '📄',
}
```

### Router handler update

```typescript
// In same file, update handleClick() function
function handleClick(item: RecentItem) {
  if (item.type === 'chapter') {
    router.push(`/editor?file=${encodeURIComponent(item.id)}`)
  }
  else if (item.type === 'character') {
    router.push('/tabs/workspace/characters')
  }
  else if (item.type === 'scene') {
    router.push('/tabs/workspace/scenes')
  }
  else if (item.type === 'location') { // NEW
    router.push('/tabs/workspace/locations')
  }
}
```

---

## Pattern 6: Markdown File Parsing

### Character Markdown (Reference)

```yaml
---
id: hero
name: Main Character
avatar: /img/hero-avatar.jpg
tags:
  - protagonist
  - warrior
faction: The Order
---

## Appearance
Tall and muscular...

## Personality
Brave and determined...
```

### Scene Markdown (Reference)

```yaml
---
id: throne-room
name: Throne Room
description: The grand throne room of the castle
imagePrompt: A majestic throne room with high ceilings...
type: image
tags:
  - indoor
  - royal
---

Background information about the scene...
```

### Location Markdown (To Create)

```yaml
---
id: home-base
name: Headquarters
description: The team's secret base
imagePrompt: "A hidden underground facility with modern tech..."
type: image
tags:
  - safe-house
  - headquarters
linkedCharacters:
  - hero
  - companion
linkedScenes:
  - opening-scene
  - final-battle
---

## Background
The team discovered this location in the first chapter...

## Current Residents
- Hero (leader)
- Companion (support)
- NPC Guide

## Facilities
- War room with tactical maps
- Training grounds
- Living quarters
- Armory
```

---

## Pattern 7: useProjectContent Extension

### Current implementation (Reference)

```typescript
// Partial code from useProjectContent.ts

// Load scenes with frontmatter parsing
const sceneList: SceneInfo[] = []
try {
  const sceneFiles = await listFilesInDir(dirHandle, 'adv/scenes', '.md')
  for (const file of sceneFiles) {
    try {
      const content = await readFileFromDir(dirHandle, file)
      const parsed = parseSceneMd(content)
      sceneList.push({
        file,
        name: parsed.name || 'Untitled',
        id: parsed.id,
        description: parsed.description,
        imagePrompt: parsed.imagePrompt,
        type: parsed.type || 'image',
        tags: parsed.tags || [],
        src: parsed.src,
      })
    }
    catch { /* parse error */ }
  }
}
catch { /* no scenes dir */ }
scenes.value = sceneList
```

### For Locations (To Add)

```typescript
// Add after scenes loading, similar structure

// Load locations
const locationList: LocationInfo[] = []
try {
  const locationFiles = await listFilesInDir(dirHandle, 'adv/locations', '.md')
  for (const file of locationFiles) {
    try {
      const content = await readFileFromDir(dirHandle, file)
      const parsed = parseLocationMd(content) // NEW utility function
      locationList.push({
        file,
        name: parsed.name || 'Untitled',
        id: parsed.id,
        description: parsed.description,
        imagePrompt: parsed.imagePrompt,
        type: parsed.type || 'image',
        tags: parsed.tags || [],
        src: parsed.src,
        linkedCharacters: parsed.linkedCharacters || [],
        linkedScenes: parsed.linkedScenes || [],
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
  locations: locationList.length, // NEW
  knowledge: kb.knowledge.value.length,
  audios: audioList.length,
}
```

---

## Pattern 8: Form Component Structure

### Minimal LocationEditorForm

```vue
<script setup lang="ts">
import type { AdvLocation } from '@advjs/types'
import { IonButton, IonInput, IonLabel, IonTextarea } from '@ionic/vue'

const props = defineProps<{
  location?: AdvLocation
}>()

const emit = defineEmits<{
  save: [data: AdvLocation]
  cancel: []
}>()

const form = ref({
  id: props.location?.id || '',
  name: props.location?.name || '',
  description: props.location?.description || '',
  imagePrompt: props.location?.imagePrompt || '',
  type: (props.location?.type || 'image') as 'image' | '3d-model',
  tags: (props.location?.tags || []) as string[],
})

function handleSave() {
  emit('save', {
    ...form.value,
    src: props.location?.src, // Preserve existing image
  })
}
</script>

<template>
  <div class="location-form">
    <div class="form-group">
      <IonLabel>ID</IonLabel>
      <IonInput v-model="form.id" type="text" placeholder="location-id" />
    </div>

    <div class="form-group">
      <IonLabel>Name</IonLabel>
      <IonInput v-model="form.name" type="text" placeholder="Location Name" />
    </div>

    <div class="form-group">
      <IonLabel>Description</IonLabel>
      <IonTextarea v-model="form.description" placeholder="Brief description..." />
    </div>

    <div class="form-group">
      <IonLabel>Image Prompt</IonLabel>
      <IonTextarea v-model="form.imagePrompt" placeholder="AI image generation prompt..." />
    </div>

    <div class="form-actions">
      <IonButton @click="emit('cancel')">
        Cancel
      </IonButton>
      <IonButton fill="solid" @click="handleSave">
        Save
      </IonButton>
    </div>
  </div>
</template>

<style scoped>
.location-form {
  display: flex;
  flex-direction: column;
  gap: var(--adv-space-md);
  padding: var(--adv-space-md);
}
</style>
```

---

## Key Takeaways

1. **Follow the Scene pattern** for types (discriminated union by `type`)
2. **Match SceneCard structure** for LocationCard component
3. **Use same composable pattern** for loading/caching
4. **Add to router** as workspace sub-module
5. **Keep consistent with character location refs** (currently stored as strings, could use IDs)
6. **Use mapOutline icon** (available in ionicons)
7. **Store as markdown files** in `adv/locations/` directory
8. **Support image + optional 3d-model types** like scenes
