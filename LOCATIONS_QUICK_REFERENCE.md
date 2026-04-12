# 🗺️ Locations Module - Quick Reference

## Critical File Paths

### Types

- **Create**: `packages/types/src/game/location.ts` (NEW)
- **Pattern**: `packages/types/src/game/scene.ts` ✓
- **Export**: `packages/types/src/game/index.ts`

### Components

- **Card**: `apps/studio/src/components/LocationCard.vue` (NEW) — Based on `SceneCard.vue`
- **Form**: `apps/studio/src/components/LocationEditorForm.vue` (NEW) — Based on `SceneEditorForm.vue`
- **Examples**: `apps/studio/src/components/StatsCard.vue`, `CharacterCard.vue`

### Views

- **Main**: `apps/studio/src/views/workspace/LocationsPage.vue` (NEW) — Based on `ScenesPage.vue`
- **Pattern**: `apps/studio/src/views/workspace/ScenesPage.vue` (9305 lines)
- **Router**: `apps/studio/src/router/index.ts` — Add route: `workspace/locations`

### Composables & Stores

- **Content**: `apps/studio/src/composables/useProjectContent.ts` — Add LocationInfo + update ProjectStats
- **Recent**: `apps/studio/src/composables/useRecentActivity.ts` — Add TYPE_ICON['location']
- **Store**: `apps/studio/src/stores/useStudioStore.ts` (reference only)

## Type Definition Template

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

## Icon & Navigation

- **Icon**: `mapOutline` (from ionicons) ✓ Available
- **Route**: `/tabs/workspace/locations`
- **Type**: Sub-module of workspace (like Scenes, Characters)
- **Not**: A main tab (keep workspace focused)

## Key Integration Points

### 1. Character References

- `AdvCharacterDynamicState.location` → Currently stores name
- Update to reference `locationId` instead for consistency

### 2. Dashboard Stats

- Add to `ProjectStats` interface: `locations: number`
- Show `StatsCard` with `mapOutline` icon

### 3. Recent Activity

```typescript
TYPE_ICON.location = '📍' // or '🗺️'
// Track edits with: trackAccess({ type: 'location', ... })
```

### 4. File Storage

```
project-root/
├── adv/
│   ├── locations/
│   │   ├── home-base.md
│   │   ├── home-base.jpg
│   │   └── ...
```

## Implementation Order

1. **Types** (`packages/types/src/game/location.ts`)
2. **Composable** (extend `useProjectContent.ts`)
3. **Components** (`LocationCard.vue`, `LocationEditorForm.vue`)
4. **View** (`LocationsPage.vue`)
5. **Router** (add route in `router/index.ts`)
6. **Recent Activity** (update `RecentActivity.vue`)
7. **Dashboard** (add stats card if needed)

## Style Reference

```css
/* From existing components */
--adv-surface-card
--adv-surface-elevated
--adv-border-subtle
--adv-text-primary
--adv-radius-md
--ion-color-primary (accent)
```

## Common Patterns

### Card Component

- Flex layout with image + text
- Hover state with transform
- Click emits object
- Optional footer with tags/metadata

### Page Component

- IonHeader with search
- IonFabButton for "add"
- Grid of cards
- Modal editor
- Delete confirmation

### Markdown Format

```yaml
---
id: location-id
name: Location Name
description: Short description
imagePrompt: "AI generation prompt..."
type: image
tags: [tag1, tag2]
linkedCharacters: [char-id-1, char-id-2]
linkedScenes: [scene-id-1]
---

## Background
Detailed location description...

## NPCs
List of characters typically here...
```

## Checklist

- [ ] Create `location.ts` type file
- [ ] Update `game/index.ts` exports
- [ ] Extend `useProjectContent.ts` with LocationInfo
- [ ] Create `LocationCard.vue`
- [ ] Create `LocationEditorForm.vue`
- [ ] Create `LocationsPage.vue`
- [ ] Add router entry
- [ ] Update `RecentActivity.vue`
- [ ] Add i18n strings (if needed)
- [ ] Test with sample locations

## Questions to Ask

1. **Should locations have "NPCs" field?** (characters present)
2. **Support 3D models?** (or just images like scenes)
3. **Linked content reciprocal?** (Scenes link back to locations?)
4. **Location inventory/items?** (What's in the location)
5. **Access requirements?** (Hidden/restricted locations)
