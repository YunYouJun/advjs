# CRUD Pattern Exploration Summary - ADV.JS Studio

**Completed**: April 10, 2026
**Scope**: Full analysis of content module architecture for replication

---

## Documents Created

1. **LOCATIONS_CRUD_PATTERN.md** (1075 lines)
   - Complete architectural guide
   - Detailed patterns and conventions
   - Full code examples
   - Integration points

2. **LOCATIONS_QUICK_START.md** (350 lines)
   - Quick reference checklist
   - File creation summary
   - Code snippets for each file
   - Implementation patterns

3. **LOCATIONS_DETAILED_REFERENCE.md** (600+ lines)
   - Line-by-line implementation guide
   - Phase-by-phase workflow (6 phases)
   - Testing checklist
   - Data models with exact types
   - Common gotchas and tips

4. **EXPLORATION_SUMMARY.md** (this file)
   - Overview of findings
   - Key architectural decisions
   - Reference file locations

---

## Key Findings

### Architecture Pattern: Generic Content CRUD

The studio implements a **modular, reusable CRUD pattern** where:

1. **Content types** are handled uniformly: Characters, Scenes, Chapters, Audio
2. **Composables are generic**: Same code handles create/read/update/delete for any type
3. **UI components are type-specific**: Each type has dedicated Page, Card, Form
4. **Markdown is the storage format**: All content serialized to YAML frontmatter + markdown

### Composables (Reusable for Locations)

| Composable          | Type                     | Reusable   | Required Changes                     |
| ------------------- | ------------------------ | ---------- | ------------------------------------ |
| `useContentEditor`  | Generic state machine    | ✅ Yes     | Update ContentType union             |
| `useContentSave`    | Generic file writer      | ✅ Yes     | Add 'location' case                  |
| `useContentDelete`  | Generic file deleter     | ✅ Yes     | None! Already generic                |
| `useProjectContent` | Generic loader           | ✅ Partial | Add LocationInfo interface + loading |
| `useRecentActivity` | Generic activity tracker | ✅ Yes     | None! Already generic                |

### Content Storage

**Pattern**: `adv/{contentType}/{id}.md`

Examples:

- `adv/characters/protagonist.character.md`
- `adv/scenes/tavern-entrance.md`
- `adv/chapters/chapter-01.adv.md`
- `adv/audio/ambient-tavern.md`
- `adv/locations/{id}.md` ← New pattern

### Markdown Format

All content uses YAML frontmatter:

```markdown
---
id: unique-identifier
name: Display Name
{content-specific-fields}: values
---
```

No markdown body needed (content stored in frontmatter).

---

## Files to Create for Locations

### Utilities (1 file)

- `apps/studio/src/utils/locationMd.ts` (80-100 lines)
  - `LocationFormData` interface
  - `parseLocationMd()` function
  - `stringifyLocationMd()` function

### Components (2 files)

- `apps/studio/src/components/LocationCard.vue` (80-90 lines)
- `apps/studio/src/components/LocationEditorForm.vue` (150-180 lines)

### Views (1 file)

- `apps/studio/src/views/workspace/LocationsPage.vue` (300-330 lines)
  - Copy pattern from `ScenesPage.vue`
  - Replace scene/Scene with location/Location

### Optional

- `useLocationMd.ts` - If separating parsing logic (not needed, utils/locationMd.ts sufficient)

---

## Files to Update

### Composables (2 files)

1. **`useProjectContent.ts`** (+~50 lines)
   - Add `LocationInfo` interface
   - Add `locations` ref state
   - Add loading logic in `loadFromDir()` and `loadFromCos()`
   - Export `locations` in return

2. **`useContentSave.ts`** (+~30 lines)
   - Add import for `LocationFormData`
   - Add 'location' case in save switch statement

3. **`useContentEditor.ts`** (+~10 lines)
   - Update `ContentType` union to include 'location'
   - Add 'location' validation case

### Core (2 files)

4. **`router/index.ts`** (+4 lines)
   - Add route: `workspace/locations`

5. **`utils/db.ts`** (+5 lines, optional)
   - Add `DbLocation` interface (for future state persistence)

### Internationalization (2 files)

6. **`i18n/locales/en.json`** (+20 lines)
   - Add workspace.locations
   - Add locations section
   - Add contentEditor.location\* keys

7. **`i18n/locales/zh-CN.json`** (+20 lines)
   - Chinese translations (same structure)

---

## Key Design Decisions

### Location Data Model

```typescript
interface LocationFormData {
  id: string // Required: "tavern"
  name: string // Required: "The Wayward Tavern"
  type?: 'interior' | 'exterior' | 'abstract' // Default: 'interior'
  description?: string
  regions?: string[] // Sub-areas: ["main-hall", "kitchen"]
  tags?: string[]
  alias?: string | string[]
}
```

### File Path Convention

- **Path**: `adv/locations/{id}.md`
- **ID rules**: Lowercase alphanumeric + hyphens only
- **ID examples**: `tavern`, `forest-edge`, `merchant-square`

### Form Fields

1. ID (required, validated)
2. Name (required)
3. Type (select: interior/exterior/abstract)
4. Tags (optional, array)
5. Regions (optional, array)
6. Description (optional, textarea)

### Integration with Character State

**Already supported**: `useCharacterStateStore.ts` has location field!

- Line 32: Location extracted from conversations
- Line 112: Included in system prompt
- Automatic AI-based state extraction

No changes needed - just documented for reference.

---

## Reference Files (with Line Numbers)

### Primary References

| File                | Path             | Lines | Purpose                  |
| ------------------- | ---------------- | ----- | ------------------------ |
| ScenesPage.vue      | views/workspace/ | 316   | ✅ **Copy this pattern** |
| sceneMd.ts          | utils/           | 73    | ✅ Copy markdown format  |
| SceneCard.vue       | components/      | 80    | ✅ Reference card        |
| SceneEditorForm.vue | components/      | 119   | ✅ Reference form        |

### Secondary References

| File                    | Path             | Lines | Purpose                     |
| ----------------------- | ---------------- | ----- | --------------------------- |
| CharactersPage.vue      | views/workspace/ | 289   | Alternative CRUD pattern    |
| CharacterEditorForm.vue | components/      | 500+  | Complex form example        |
| ContentEditorModal.vue  | components/      | -     | Modal component (use as-is) |

### Core Infrastructure

| File                   | Path         | Purpose                                  |
| ---------------------- | ------------ | ---------------------------------------- |
| useContentEditor.ts    | composables/ | Generic state machine (use as-is)        |
| useContentSave.ts      | composables/ | Generic save handler (add location case) |
| useContentDelete.ts    | composables/ | Generic delete handler (use as-is)       |
| useProjectContent.ts   | composables/ | Generic loader (add location loading)    |
| ContentEditorModal.vue | components/  | Reusable modal (use as-is)               |

---

## Implementation Phases

### Phase 1: Core Utilities (30 min)

Create `locationMd.ts` with parsing/serialization

### Phase 2: UI Components (45 min)

Create `LocationCard.vue`, `LocationEditorForm.vue`, `LocationsPage.vue`

### Phase 3: Content Loading (30 min)

Update `useProjectContent.ts` with location loading

### Phase 4: Composable Integration (15 min)

Add 'location' case to `useContentSave.ts` and `useContentEditor.ts`

### Phase 5: Router & Database (15 min)

Add route to `router/index.ts`, optionally update `db.ts`

### Phase 6: Internationalization (20 min)

Add i18n keys to both language files

**Total estimated time: 155 minutes (~2.5 hours)**

---

## Testing Strategy

### Unit Tests

- [ ] `locationMd.parse()` round-trip
- [ ] Validation rules

### Integration Tests

- [ ] Create location → verify file saved
- [ ] Load locations → verify list populated
- [ ] Update location → verify changes persisted
- [ ] Delete location → verify file removed

### UI Tests

- [ ] Search/filter functionality
- [ ] Grid responsive layout
- [ ] Modal open/close
- [ ] Draft persistence

### Feature Tests

- [ ] Local project support
- [ ] Cloud project support (COS)
- [ ] Statistics update
- [ ] Activity tracking

---

## Common Gotchas & Tips

### Implementation Gotchas

1. Don't forget `parseLocationMd` import in useProjectContent
2. Add else-if for 'location' in validation, not separate case
3. Type field defaults to 'interior', not undefined
4. File path is `adv/locations/{id}.md` - watch for typos
5. Regions and tags both use TagsInput component

### Code Quality

1. Follow existing patterns exactly (copy-paste recommended)
2. Use same imports/styling as reference files
3. Maintain naming conventions (camelCase composables, kebab-case files)
4. Keep validation simple (ID regex, required fields)

### Testing Tips

1. Test with both local and cloud projects
2. Verify draft persistence by reloading page
3. Check markdown sync in both directions
4. Test empty states and search results
5. Verify responsive grid on mobile

---

## Architecture Strengths

1. **Composable reuse**: 80% of code already exists
2. **Type safety**: Full TypeScript integration
3. **Consistency**: All content modules follow same pattern
4. **Maintainability**: Clear separation of concerns
5. **Scalability**: Easy to add new content types
6. **Internationalization**: Built-in i18n from the start
7. **Storage flexibility**: Works with local files and cloud

---

## Future Extensibility

The pattern supports:

- ✅ New content types easily (repeat phases 1-2, light updates to 3-6)
- ✅ New fields per type (extend interfaces, update forms)
- ✅ Validation rules per type (add cases in useContentEditor)
- ✅ Cloud sync (works automatically via COS)
- ✅ Draft persistence (built-in per type)
- ✅ Activity tracking (automatic)

---

## Files Saved to Docs

All documentation saved to `/docs/`:

```
docs/
├── LOCATIONS_CRUD_PATTERN.md          (1075 lines - full spec)
├── LOCATIONS_QUICK_START.md           (350 lines - quick ref)
├── LOCATIONS_DETAILED_REFERENCE.md    (600+ lines - line-by-line)
└── EXPLORATION_SUMMARY.md             (this file)
```

Use as:

- **QUICK_START**: When ready to implement
- **DETAILED_REFERENCE**: During implementation
- **CRUD_PATTERN**: For understanding architecture
- **SUMMARY**: Overview of findings

---

## Next Steps

1. Read **LOCATIONS_QUICK_START.md** for quick overview
2. Reference **LOCATIONS_DETAILED_REFERENCE.md** during implementation
3. Copy code patterns from **ScenesPage.vue**
4. Follow the 6-phase implementation workflow
5. Run tests from provided checklist

Good luck! 🚀
