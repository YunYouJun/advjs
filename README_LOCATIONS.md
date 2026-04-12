# 🗺️ Locations Module - Complete Documentation

> Comprehensive exploration and analysis for building a Locations module in advjs Studio

---

## 📚 Documentation Files

### 1. **EXPLORATION_SUMMARY.md** ← **START HERE**

- High-level overview of findings
- Architecture diagram
- Implementation phases & timeline
- Design questions to resolve
- Quick reference to all other docs

**Read this first** for a complete picture.

### 2. **LOCATIONS_QUICK_REFERENCE.md**

- File paths for all required changes
- Type definition template
- Integration points checklist
- Implementation order

**Use this** when you need quick answers.

### 3. **LOCATIONS_MODULE_ANALYSIS.md**

- Detailed analysis of all 12 system areas
- Type system patterns (Scene, Character, Music, World)
- UI component architecture
- Workspace module structure
- Project content system
- Icon recommendations
- Store architecture
- File organization patterns

**Reference this** for deep understanding.

### 4. **LOCATIONS_CODE_PATTERNS.md**

- 8 concrete code patterns
- Side-by-side comparisons (Scene vs Location)
- Implementation examples
- Markdown file format templates
- Component structures with full code

**Copy from this** when implementing.

---

## 🎯 Quick Start

### If you have 5 minutes:

1. Read **EXPLORATION_SUMMARY.md** - "Key Findings" section
2. Check **LOCATIONS_QUICK_REFERENCE.md** - "Critical File Paths"

### If you have 20 minutes:

1. Read **EXPLORATION_SUMMARY.md** - entire document
2. Skim **LOCATIONS_MODULE_ANALYSIS.md** - sections 1-3
3. Review **LOCATIONS_QUICK_REFERENCE.md**

### If you have 1 hour (recommended):

1. Read **EXPLORATION_SUMMARY.md** - complete
2. Study **LOCATIONS_MODULE_ANALYSIS.md** - all sections
3. Review **LOCATIONS_CODE_PATTERNS.md** - all patterns
4. Bookmark **LOCATIONS_QUICK_REFERENCE.md** - for during implementation

### If you have 2+ hours:

1. Read all documents in order above
2. Walk through codebase using references provided
3. Review type definitions in `packages/types/src/game/`
4. Study pattern files (ScenesPage.vue, SceneCard.vue, etc.)
5. Plan implementation schedule

---

## 🏗️ Implementation Roadmap

```
PHASE 1: Types (~30 min)
├─ Create packages/types/src/game/location.ts
└─ Export from packages/types/src/game/index.ts
         ↓
PHASE 2: Content Loading (~1-2 hrs)
├─ Extend useProjectContent.ts
├─ Add LocationInfo interface
└─ Implement location file loading
         ↓
PHASE 3: Components (~2-3 hrs)
├─ LocationCard.vue
├─ LocationEditorForm.vue
└─ Update RecentActivity.vue
         ↓
PHASE 4: Main View (~3-4 hrs)
├─ LocationsPage.vue
├─ Search/filter
├─ Add/edit/delete
└─ Optional: AI generation
         ↓
PHASE 5: Integration (~30 min)
├─ Add router entry
├─ Update i18n
└─ Test & polish
```

**Total Time**: ~1-2 days for full implementation

---

## 📋 Key Files to Reference

### Type Definitions

- `packages/types/src/game/scene.ts` ← **Main pattern**
- `packages/types/src/game/character.ts`
- `packages/types/src/game/world.ts`

### Components

- `apps/studio/src/components/SceneCard.vue` ← **Use as template**
- `apps/studio/src/components/CharacterCard.vue`
- `apps/studio/src/components/StatsCard.vue`

### Views

- `apps/studio/src/views/workspace/ScenesPage.vue` ← **Use as template**
- `apps/studio/src/views/workspace/CharactersPage.vue`

### Utilities

- `apps/studio/src/composables/useProjectContent.ts` ← **Main integration**
- `apps/studio/src/composables/useRecentActivity.ts`
- `apps/studio/src/router/index.ts`
- `apps/studio/src/views/TabsPage.vue`

---

## ✅ Implementation Checklist

**Print or copy to your tracking system:**

```
TYPES
 ☐ Create location.ts
 ☐ Update game/index.ts
 ☐ (Optional) Update AdvCharacterDynamicState

COMPOSABLES
 ☐ Add LocationInfo interface
 ☐ Add location loading logic
 ☐ Update ProjectStats
 ☐ Update useRecentActivity TYPE_ICON

COMPONENTS
 ☐ Create LocationCard.vue
 ☐ Create LocationEditorForm.vue
 ☐ Update RecentActivity.vue

VIEWS
 ☐ Create LocationsPage.vue
 ☐ Implement search
 ☐ Implement add/edit
 ☐ Implement delete

ROUTER
 ☐ Add workspace/locations route

TESTING
 ☐ Create sample location.md
 ☐ Test loading
 ☐ Test CRUD operations
 ☐ Test recent activity tracking
```

---

## 🤔 Design Decisions

Before starting, clarify with team:

1. **Character Presence**
   - Should we track which characters are at a location?
   - How does this integrate with character state?

2. **3D Models**
   - Should we support 3D models like scenes do?
   - Implementation timeline?

3. **Linked Content**
   - How deep should linking go (characters, scenes, chapters)?
   - Bidirectional or one-way?

4. **Dashboard**
   - Should locations appear on main dashboard?
   - What stats to show?

5. **AI Generation**
   - Include AI image generation from prompt?
   - Same as scenes or different?

---

## 💡 Key Insights

### Pattern Summary

- **Type System**: Discriminated union by `type` field
- **Components**: Card-based UI with grid layout
- **Storage**: YAML frontmatter + Markdown body
- **Loading**: File-based with composable caching
- **Navigation**: Router-based with Icon components

### Icons

```typescript
mapOutline // Main location icon
addOutline // Add button
trashOutline // Delete action
```

### Colors (CSS Variables)

```
--adv-surface-card       // Card background
--adv-surface-elevated   // Hover state
--ion-color-primary      // Accent color
```

---

## 🔗 Integration Points

### 1. Character References

```typescript
// Currently: location is a string
AdvCharacterDynamicState { location?: string }

// Consider: link to locationId for consistency
AdvCharacterDynamicState { locationId?: string }
```

### 2. Dashboard Stats

Show location count with mapOutline icon

### 3. Recent Activity

Track location edits in recent activity feed

### 4. Scene References

Scenes can reference which locations they represent

---

## 🚀 Getting Started

**Step 1**: Read EXPLORATION_SUMMARY.md
**Step 2**: Review LOCATIONS_QUICK_REFERENCE.md
**Step 3**: Choose a phase to start (recommend Phase 1: Types)
**Step 4**: Copy code patterns from LOCATIONS_CODE_PATTERNS.md
**Step 5**: Refer to LOCATIONS_MODULE_ANALYSIS.md for details

---

## 📞 Questions?

Refer to the appropriate document:

- **"Where do I add X?"** → LOCATIONS_QUICK_REFERENCE.md
- **"What pattern should I follow?"** → LOCATIONS_CODE_PATTERNS.md
- **"How does Y work?"** → LOCATIONS_MODULE_ANALYSIS.md
- **"What's the big picture?"** → EXPLORATION_SUMMARY.md

---

## 📊 File Statistics

- **Documents Created**: 4
- **Total Pages**: ~45 (estimated)
- **Code Examples**: 20+
- **Files Referenced**: 30+
- **Lines of Code Reviewed**: 5000+

---

## ✨ What's Ready

✅ Type system design
✅ Component patterns
✅ File structure
✅ Router configuration
✅ Markdown format
✅ UI/UX patterns
✅ Integration points
✅ Implementation timeline

---

**Status**: Ready for Implementation
**Date**: April 10, 2026
**Confidence Level**: High ⭐⭐⭐⭐⭐

---

**Next Action**: Start with Phase 1 - create the type definitions!
