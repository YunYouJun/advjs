# 🗺️ Locations Module - Exploration Summary

**Date**: April 10, 2026
**Explored**: Type system, UI components, and architectural patterns in advjs studio

---

## 📋 Documents Created

1. **LOCATIONS_MODULE_ANALYSIS.md** (12 sections)
   - Comprehensive analysis of type system patterns
   - UI components architecture
   - Workspace module structure
   - Project content system
   - Implementation checklist

2. **LOCATIONS_QUICK_REFERENCE.md**
   - Quick lookup for file paths
   - Type templates
   - Integration points
   - Common patterns
   - Implementation order

3. **LOCATIONS_CODE_PATTERNS.md** (8 patterns)
   - Side-by-side code comparisons
   - Concrete implementation examples
   - Markdown file format templates
   - Component structures

---

## 🎯 Key Findings

### Type System Pattern

✅ **Model**: Scene (discriminated union by `type` field)

- Base interface → Type-specific interfaces → Union type
- Apply same pattern to `AdvLocation`
- Support: `image` + optional `3d-model` types

### UI Components

✅ **Card Pattern**: Similar across Scene/Character cards

- Image preview or placeholder
- Name + description
- Tags footer
- Click handler emission

✅ **Page Pattern**: ScenesPage & CharactersPage follow same structure

- Header with search + add button
- Grid of cards
- Modal editor
- Delete confirmation

### Workspace Architecture

✅ **Location**: Sub-module of workspace (not main tab)

- Route: `/tabs/workspace/locations`
- Similar to Scenes, Characters, Audio, Knowledge pages
- Icon: `mapOutline` (available in ionicons)

### Content Loading

✅ **System**: File-based with YAML frontmatter + markdown body

- Directory: `adv/locations/*.md`
- Parsed with frontmatter library
- Cached in composable state
- Stats tracked in ProjectStats

### Recent Activity

✅ **Integration**: Add 'location' to TYPE_ICON mapping

- Emoji: `📍` or `🗺️`
- Router navigation on click
- Tracked with useRecentActivity composable

---

## 🏗️ Architecture Overview

```
TypeSystem (packages/types/)
    ↓
    ├─ Create: location.ts
    ├─ Export from: game/index.ts
    └─ Interfaces: AdvLocationBase, AdvLocationImage, AdvLocation

        ↓

Composables (apps/studio/src/composables/)
    ↓
    ├─ Extend: useProjectContent.ts
    │   ├─ Add: LocationInfo interface
    │   ├─ Add: locations loading logic
    │   └─ Update: ProjectStats
    └─ Update: useRecentActivity.ts
        └─ Add: location to TYPE_ICON

        ↓

Components (apps/studio/src/components/)
    ↓
    ├─ Create: LocationCard.vue (based on SceneCard)
    ├─ Create: LocationEditorForm.vue
    ├─ Update: RecentActivity.vue
    └─ (Optional) Dashboard stats

        ↓

Views (apps/studio/src/views/workspace/)
    ↓
    └─ Create: LocationsPage.vue (based on ScenesPage)
        ├─ Search
        ├─ Add/Edit/Delete
        ├─ Grid of cards
        └─ AI image generation (optional)

        ↓

Router (apps/studio/src/router/)
    ↓
    └─ Add route: workspace/locations → LocationsPage
```

---

## 💾 File Storage

```
project-root/
├── adv/
│   ├── locations/
│   │   ├── home-base.md
│   │   ├── home-base.jpg (generated from imagePrompt)
│   │   ├── throne-room.md
│   │   ├── throne-room.jpg
│   │   └── ...
│   ├── characters/
│   ├── scenes/
│   └── ...
```

---

## 🔗 Integration Points

### 1. Character Location Reference

**Current**: `AdvCharacterDynamicState.location?: string` (stores name)
**Future**: Consider adding `locationId` for proper references

### 2. Dashboard Stats

Add location count to workspace overview with:

```typescript
StatsCard { icon: mapOutline, value: locationsCount, label: 'Locations' }
```

### 3. Scene References

Locations can link to scenes where they appear

### 4. Character Presence

Track which characters are at which locations (runtime state)

---

## 🎨 UI Patterns

### Colors (CSS Variables)

```css
--adv-surface-card        /* Card background */
--adv-surface-elevated    /* Hover state */
--adv-border-subtle       /* Borders */
--adv-text-primary        /* Main text */
--adv-radius-md           /* Border radius */
--ion-color-primary       /* Accent (teal/indigo) */
```

### Component Structure

- **Cards**: Flexbox layout, hover effects, smooth transitions
- **Forms**: Input groups with labels, validation, save/cancel
- **Lists**: Horizontal scroll for pills, grid for cards
- **Actions**: FAB buttons for add, modals for edit, confirm for delete

### Icons Used

- `mapOutline` - For locations navigation
- `addOutline` - For add button
- `trashOutline` - For delete action
- `imageOutline` - For media indicators

---

## 📊 Implementation Complexity

### Phase 1: Core Types (Low - ~30 min)

- Create location.ts
- Export from game/index.ts
- Add to character dynamic state (optional)

### Phase 2: Content Loading (Medium - ~1-2 hrs)

- Extend useProjectContent with LocationInfo
- Create parseLocationMd utility
- Update ProjectStats
- Test loading from files

### Phase 3: UI Components (Medium - ~2-3 hrs)

- LocationCard.vue (template copy from SceneCard)
- LocationEditorForm.vue (template copy from SceneEditorForm)
- Update RecentActivity.vue
- Add to dashboard (if included)

### Phase 4: Main Page (High - ~3-4 hrs)

- LocationsPage.vue (template based on ScenesPage)
- Search/filter logic
- Add/edit modal
- Delete confirmation
- AI image generation (optional)

### Phase 5: Integration (Low - ~30 min)

- Add router entry
- Update i18n strings
- Update navigation if needed

**Total**: ~1-2 days for full implementation

---

## ✅ Implementation Checklist

### Types

- [ ] Create `packages/types/src/game/location.ts`
- [ ] Update `packages/types/src/game/index.ts`
- [ ] (Optional) Add locationId to AdvCharacterDynamicState

### Content System

- [ ] Extend useProjectContent.ts with LocationInfo interface
- [ ] Create parseLocationMd utility function
- [ ] Update ProjectStats to include locations count
- [ ] Add location loading logic in useProjectContent
- [ ] Add locations ref export

### Components

- [ ] Create LocationCard.vue
- [ ] Create LocationEditorForm.vue
- [ ] Update RecentActivity.vue TYPE_ICON
- [ ] Update RecentActivity.vue handleClick
- [ ] (Optional) Add dashboard stats component

### Views

- [ ] Create LocationsPage.vue
- [ ] Implement search functionality
- [ ] Implement add/edit modal
- [ ] Implement delete with confirmation
- [ ] (Optional) AI image generation

### Router

- [ ] Add workspace/locations route to router/index.ts

### i18n

- [ ] Add translation keys (if needed)

### Testing

- [ ] Create sample location.md file
- [ ] Test loading and display
- [ ] Test edit/save
- [ ] Test delete
- [ ] Test AI image generation (if included)

---

## 🤔 Design Questions to Resolve

1. **NPC/Character Presence**
   - Should LocationInfo track characters currently present?
   - Or only linkedCharacters (those who visit)?

2. **3D Model Support**
   - Required or optional feature?
   - Implementation approach?

3. **Location Inventory**
   - Track items/objects at locations?
   - Future expansion?

4. **Access Control**
   - Hidden/restricted locations?
   - Unlockable locations?

5. **Weather/Time Integration**
   - Link to world clock?
   - Location-specific weather?

6. **Visual Representation**
   - 3D map view?
   - Simple list for now?

---

## 📚 Reference Files

### Core Patterns

- **Scene Types**: `packages/types/src/game/scene.ts`
- **Character Types**: `packages/types/src/game/character.ts`
- **Music Types**: `packages/types/src/game/music.ts`

### Component Examples

- **SceneCard**: `apps/studio/src/components/SceneCard.vue`
- **CharacterCard**: `apps/studio/src/components/CharacterCard.vue`
- **StatsCard**: `apps/studio/src/components/StatsCard.vue`

### View Examples

- **ScenesPage**: `apps/studio/src/views/workspace/ScenesPage.vue`
- **CharactersPage**: `apps/studio/src/views/workspace/CharactersPage.vue`

### Utilities

- **useProjectContent**: `apps/studio/src/composables/useProjectContent.ts`
- **useRecentActivity**: `apps/studio/src/composables/useRecentActivity.ts`
- **useStudioStore**: `apps/studio/src/stores/useStudioStore.ts`

---

## 🚀 Next Steps

1. **Review this analysis** with team
2. **Decide on design questions** (NPCs, 3D, etc.)
3. **Start with Phase 1** (types) - quick win
4. **Build incrementally** - test after each phase
5. **Update character refs** - ensure consistency
6. **Document markdown format** - consistency guide

---

## 📌 Key Insights

### What Works Well

✅ Discriminated union pattern for content types
✅ Markdown + YAML frontmatter for storage
✅ Composable-based content loading
✅ Card-based UI components
✅ Recent activity tracking

### What to Replicate

✅ Scene type pattern (exactly)
✅ SceneCard component structure (mostly)
✅ ScenesPage layout (with adjustments)
✅ useProjectContent loading pattern
✅ Recent activity integration

### What's Unique for Locations

- More metadata fields (linkedCharacters, linkedScenes)
- Optional 3D model type
- Placeholder icon when no image
- Connected to character presence system

---

## 📖 References

All source code reviewed:

- ✅ 7 type definition files
- ✅ 40+ component files
- ✅ 6 workspace pages
- ✅ 9 composables/stores
- ✅ Router configuration
- ✅ Tab navigation system

**Total Lines Reviewed**: ~5000+

---

**Status**: Ready for implementation
**Last Updated**: 2026-04-10
**Created By**: Code Exploration
