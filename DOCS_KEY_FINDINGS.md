# ADV.JS Documentation Structure - Key Findings

**Created**: 2026-04-13  
**Status**: Complete Analysis  
**For**: Adding/Updating Scene, Location, and Studio Features

---

## 🎯 Executive Summary

The ADV.JS documentation is organized using **VitePress** with:
- **Primary language**: 简体中文 (Chinese)
- **Secondary language**: English (limited, guide section only)
- **Main content hub**: `/docs/guide/` directory
- **Style**: Bilingual docs for enterprise features, Chinese-first

**Key finding**: Documentation structure is **content-type modular** - each content type (Characters, Scenes, Chapters, Audio) gets its own CRUD pattern that can be reused.

---

## 📍 Where to Find Documentation About Each Feature

### 1. **Scene Management** (Already partially documented)

| What | Where | Status |
|------|-------|--------|
| User guide | `/docs/guide/studio.md` lines ~240-260 | ✅ Documented |
| Architecture | `/docs/LOCATIONS_CRUD_PATTERN.md` (use as model) | ✅ Reference available |
| Implementation | `/docs/LOCATIONS_QUICK_START.md` | ✅ Can reuse pattern |
| UI Components | `apps/studio/src/components/SceneCard.vue` | ✅ Reference exists |
| Editor Form | `apps/studio/src/components/SceneEditorForm.vue` | ✅ Reference exists |
| Page View | `apps/studio/src/views/workspace/ScenesPage.vue` | ✅ Reference (316 lines) |

**Action needed**: Update `/docs/guide/studio.md` if adding new scene features

---

### 2. **Location Management** (New feature, comprehensive guides generated)

| What | Where | Status |
|------|-------|--------|
| Implementation guide | `/docs/LOCATIONS_CRUD_PATTERN.md` | ✅ Complete (1075 lines) |
| Quick start checklist | `/docs/LOCATIONS_QUICK_START.md` | ✅ Complete (350 lines) |
| Detailed reference | `/docs/LOCATIONS_DETAILED_REFERENCE.md` | ✅ Complete (600+ lines) |
| Summary | `/docs/EXPLORATION_SUMMARY.md` | ✅ Complete (365 lines) |
| Data model | All 4 docs above | ✅ Specified |
| Code examples | All 4 docs above | ✅ Included |

**Status**: Implementation documentation is **COMPLETE** - ready to reference during coding

**Next step**: Create user-facing documentation in `/docs/guide/locations.md` once feature is ready

---

### 3. **Studio Documentation** (Comprehensive, 51KB main doc)

| What | Where | Status | Details |
|------|-------|--------|---------|
| Main guide | `/docs/guide/studio.md` | ✅ Current | 51KB, all tabs documented |
| Roadmap | `/docs/studio/next-phase-plan.md` | ✅ Current | Phase M1-M3+ (Mobile-first) |
| Architecture | `/docs/guide/studio.md` lines ~156-213 | ✅ Included | Tech stack, Pinia stores, COS sync |
| Tab documentation | `/docs/guide/studio.md` lines ~13-120 | ✅ Included | Workspace, Chat, World, Play, Me |
| Features by tab | `/docs/guide/studio.md` lines ~156-200+ | ✅ Included | Detailed per-tab breakdown |

**Key docs**:
- **Workspace Tab**: Lines 13-30 (file management, content editing)
- **Chat Tab**: Lines 31-38 (AI assistant, project context)
- **World Tab**: Lines 40-62 (characters, living world, events)
- **Play Tab**: Lines 63-70 (preview, sync)
- **Resource Management**: Lines 72-120 (scenes, audio)
- **Technical Architecture**: Lines 156-213 (stacks, stores, state)

**Action needed**: Update `/docs/guide/studio.md` when new Phase M1-M3 features ship

---

## 📊 Documentation by Feature

### Scenes
```
DOCUMENTED
├─ User guide (studio.md)
├─ Architecture pattern (can reference LOCATIONS_CRUD_PATTERN.md)
└─ Implementation (ScenesPage.vue as reference)

TODO: Create dedicated /docs/guide/scenes.md if it deserves deep dive
```

### Locations
```
GENERATED (COMPLETE)
├─ LOCATIONS_CRUD_PATTERN.md (1075 lines)
├─ LOCATIONS_QUICK_START.md (350 lines)
├─ LOCATIONS_DETAILED_REFERENCE.md (600+ lines)
└─ EXPLORATION_SUMMARY.md (365 lines)

TODO: Create user-facing /docs/guide/locations.md after implementation
```

### Characters
```
DOCUMENTED
├─ User guide (studio.md + editor/character.md)
├─ Design philosophy (/docs/about/design/character.md)
├─ State management (/docs/guide/studio.md World tab)
└─ Implementation (CharacterEditorForm.vue, CharactersPage.vue)
```

### World/AI
```
DOCUMENTED
├─ Complete World tab (studio.md lines 40-62)
├─ AI Living World features
├─ Character memory & state tracking
├─ World events & time system
├─ Multi-character group chat
├─ Vision modes & player characters
└─ Knowledge base system
```

### Storage & Design
```
DOCUMENTED
├─ Storage system (/docs/about/design/storage.md)
├─ Character design (/docs/about/design/character.md)
├─ Internationalization (/docs/about/design/i18n.md)
└─ Markdown format pattern (all content uses YAML frontmatter)
```

---

## 🗂️ File Organization Pattern

### Standard Content Type Structure

**Storage**: `adv/{contentType}/{id}.md`

Examples:
- `adv/characters/protagonist.character.md`
- `adv/scenes/tavern-entrance.md`
- `adv/chapters/chapter-01.adv.md`
- `adv/audio/ambient-tavern.md`
- `adv/locations/{id}.md` ← New pattern

### Markdown Format (YAML + Optional Body)

```markdown
---
id: unique-id
name: Display Name
type: content-type
field1: value1
field2: value2
---
# Optional markdown body content
```

**Note**: Most content doesn't use markdown body - all data stored in frontmatter

---

## 🔧 Documentation Infrastructure

### VitePress Configuration

**File**: `/docs/.vitepress/config/index.ts`

**Key sections**:
- **Navigation** (lines 18-123): Top nav bar with dropdowns
- **Sidebar functions**:
  - `sidebarGuide()` (lines 240-344) - Main guide structure
  - `sidebarAI()` (lines 125-151) - AI & Skills
  - `sidebarAGUI()` (lines 153-238) - Component library
  - `sidebarAbout()` (lines 361-448) - Design & dev docs
- **Locales** (lines 520-527): Language configuration

### Sidebar Entry Points

To add new content, modify the appropriate sidebar function:

```typescript
// Example: Adding locations to guide sidebar
function sidebarGuide(): DefaultTheme.SidebarItem[] {
  return [
    // ... existing items ...
    {
      text: '위치 관리',
      link: '/guide/locations',  // New page
    },
  ]
}
```

---

## 🌐 Language Organization

### Primary: 简体中文 (Chinese)

- **All major docs** in Chinese
- **File structure**: `/docs/guide/`, `/docs/about/`, `/docs/studio/`
- **i18n keys**: `apps/studio/src/i18n/locales/zh-CN.json`

### Secondary: English

- **Limited coverage**: Only `/docs/en/guide/` directory
- **Full support** for common features
- **Patterns**: Parallel structure to Chinese docs
- **i18n keys**: `apps/studio/src/i18n/locales/en.json`

---

## 📱 Multi-Language Support

All UI text uses i18n keys stored in:

| File | Purpose | Scope |
|------|---------|-------|
| `apps/studio/src/i18n/locales/zh-CN.json` | Chinese translations | Everything |
| `apps/studio/src/i18n/locales/en.json` | English translations | Common features |

**When adding docs**, also add i18n keys:

```json
{
  "workspace": {
    "locations": "位置管理"
  },
  "locations": {
    "name": "名称",
    "type": "类型",
    "description": "描述"
  }
}
```

---

## 🎓 Documentation Hierarchy

### For Users (Tutorial/Guide)

```
/docs/guide/
├─ studio.md ← Main entry, 51KB comprehensive guide
├─ editor/
│  └─ character.md ← Example of content type tutorial
└─ config/ ← Feature configuration
```

### For Developers (Architecture/Design)

```
/docs/about/
├─ design/
│  ├─ character.md ← Design patterns for content types
│  ├─ storage.md ← Storage system architecture
│  └─ i18n.md ← Internationalization patterns
└─ dev/
   ├─ stores.md ← State management (Pinia)
   ├─ parser.md ← Parsing system
   └─ standard.md ← Development standards
```

### For Implementation (Reference/Patterns)

```
Generated guides (4 files):
├─ LOCATIONS_CRUD_PATTERN.md ← Use as template for new content types
├─ LOCATIONS_QUICK_START.md ← Implementation checklist
├─ LOCATIONS_DETAILED_REFERENCE.md ← Line-by-line guide
└─ EXPLORATION_SUMMARY.md ← Overview & decisions
```

---

## ✅ Checklist: Adding New Feature Documentation

### Step 1: Create User Documentation
- [ ] Create or update `/docs/guide/{feature}.md`
- [ ] Add to `sidebarGuide()` in `.vitepress/config/index.ts`
- [ ] Include examples and screenshots
- [ ] Add "Last Updated" date

### Step 2: Create Architecture Documentation
- [ ] Add to `/docs/about/design/` if new content type
- [ ] Or add to `/docs/about/dev/` if new system/store
- [ ] Document data model and validation
- [ ] Explain integration points

### Step 3: Update Internationalization
- [ ] Add keys to `apps/studio/src/i18n/locales/zh-CN.json`
- [ ] Add keys to `apps/studio/src/i18n/locales/en.json`
- [ ] Test both languages in UI

### Step 4: Build & Verify
- [ ] Run `pnpm run build` in `/docs/`
- [ ] Run `pnpm run dev` and preview locally
- [ ] Check sidebar navigation
- [ ] Test edit link functionality
- [ ] Verify language switcher

### Step 5: Commit Documentation
- [ ] Commit with message: `docs: add {feature} documentation`
- [ ] Reference relevant issues/PRs
- [ ] Include examples in commit message

---

## 🔗 Key Files Quick Reference

| Purpose | File | Lines | Action |
|---------|------|-------|--------|
| **Navigation config** | `.vitepress/config/index.ts` | 18-123 | Update when adding top nav items |
| **Guide sidebar** | `.vitepress/config/index.ts` | 240-344 | Add new guide pages here |
| **About sidebar** | `.vitepress/config/index.ts` | 361-448 | Add architecture/design docs here |
| **Studio docs** | `guide/studio.md` | All | Update when studio features change |
| **Studio roadmap** | `studio/next-phase-plan.md` | All | Update phase progress |
| **Character design** | `about/design/character.md` | All | Model for new content type docs |
| **Storage system** | `about/design/storage.md` | All | Reference for data persistence |
| **Stores docs** | `about/dev/stores.md` | All | Document new Pinia stores |
| **i18n Chinese** | `apps/studio/src/i18n/locales/zh-CN.json` | - | Add all Chinese strings |
| **i18n English** | `apps/studio/src/i18n/locales/en.json` | - | Add English strings |

---

## 📚 Reference Documentation for Implementation

### For Scene/Location/Character Features

**Use these as patterns**:
1. `ScenesPage.vue` (316 lines) - Full CRUD page example
2. `sceneMd.ts` (73 lines) - Markdown parsing pattern
3. `SceneCard.vue` (80 lines) - Content card component
4. `SceneEditorForm.vue` (119 lines) - Content form component

**Copy these files for new content types**:
- All 4 files above have reusable structure
- Just rename and update for new content type
- Estimated time: 2-3 hours for new content type

### For State Management

**Reference**:
- `useCharacterStateStore.ts` - Dynamic state (position, health, attributes)
- `useCharacterMemoryStore.ts` - Memory persistence
- `useProjectContent.ts` - Content loading (main loader)
- `useContentSave.ts` - File saving logic
- `useContentDelete.ts` - File deletion logic

### For Documentation Patterns

**Reference**:
- `/docs/guide/editor/character.md` - Tutorial format
- `/docs/about/design/character.md` - Design doc format
- `/docs/guide/studio.md` - Feature documentation format (51KB, comprehensive)

---

## 🚀 Next Steps

### To Add Scene Documentation
1. Update `/docs/guide/studio.md` - Add new scene features section
2. Add sidebar entry if creating dedicated page
3. Add i18n keys for new fields

### To Add Location Documentation
1. Reference `/docs/LOCATIONS_*.md` (generation documentation complete)
2. Create `/docs/guide/locations.md` - User documentation
3. Update `/docs/guide/studio.md` - Add locations management section
4. Update VitePress sidebar in `.vitepress/config/index.ts`
5. Add i18n keys for Chinese/English

### To Add Studio Feature Documentation
1. Update `/docs/guide/studio.md` - Add feature to appropriate tab section
2. Update `/docs/studio/next-phase-plan.md` - Add to Phase roadmap
3. Update technical architecture section if state management changed
4. Add i18n keys for new UI text

---

## 💡 Pro Tips

1. **Always update sidebar first** - VitePress won't show docs without sidebar entry
2. **Use consistent naming** - Match existing patterns (kebab-case for files)
3. **Test locally before committing** - Run `pnpm run dev` in docs directory
4. **Keep docs near code** - Documentation location should parallel source structure
5. **Bilingual from start** - Add i18n keys even if only Chinese text initially
6. **Include examples** - Code examples and screenshots are much appreciated
7. **Link between docs** - Cross-reference related features
8. **Date your updates** - Include "Last Updated" in frontmatter for tracking

---

## 📞 Support

- **VitePress Docs**: https://vitepress.dev/
- **ADV.JS Contributing**: `/docs/contributing/writing-guide.md`
- **Edit on GitHub**: All docs have "帮助改善此页面" edit link

---

**Status**: ✅ Complete Documentation Structure Analysis

**Use this guide to quickly navigate and add/update documentation for Scene, Location, and Studio features!**

