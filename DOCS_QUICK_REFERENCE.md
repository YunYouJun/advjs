# ADV.JS Documentation - Quick Reference Card

**Date**: 2026-04-13  
**Size**: 1 page cheat sheet  
**For**: Quickly locating and updating docs

---

## 🎯 Five-Minute Overview

```
What you need to know:

1. Docs are in /docs/ (VitePress format - markdown files)
2. Main content: /docs/guide/ (user-facing)
3. Architecture: /docs/about/ (developer docs)
4. Config: /docs/.vitepress/config/index.ts (navigation & sidebar)
5. Language: Chinese primary, English secondary
```

---

## 📍 Where to Find Each Topic

### Scene Management
```
User Guide        → /docs/guide/studio.md (lines 240-260)
Architecture      → /docs/LOCATIONS_CRUD_PATTERN.md (use as model)
Implementation    → ScenesPage.vue (316 lines, reference file)
```

### Location Management
```
Implementation    → /docs/LOCATIONS_CRUD_PATTERN.md (1075 lines - COMPLETE)
Quick Start       → /docs/LOCATIONS_QUICK_START.md (350 lines - COMPLETE)
Detailed Ref      → /docs/LOCATIONS_DETAILED_REFERENCE.md (600+ lines - COMPLETE)
Summary           → /docs/EXPLORATION_SUMMARY.md (365 lines - COMPLETE)

User Guide        → /docs/guide/locations.md (TO CREATE)
```

### Studio Features
```
Main Guide        → /docs/guide/studio.md (51KB, all tabs documented)
Roadmap           → /docs/studio/next-phase-plan.md (Phases M1-M3+)
Architecture      → studio.md lines 156-213 (Pinia stores, tech stack)
```

---

## 🔧 Update Checklist

### Adding New Documentation
```
1. Create/Edit markdown file in /docs/{section}/
2. Update sidebar in .vitepress/config/index.ts
3. Add i18n keys to both language files
4. Test: pnpm run dev in /docs/
5. Commit with descriptive message
```

### Key Files to Edit

| Task | File | Action |
|------|------|--------|
| Add guide page | `.vitepress/config/index.ts` | Add to `sidebarGuide()` (line ~240) |
| Add design doc | `.vitepress/config/index.ts` | Add to `sidebarAbout()` (line ~361) |
| Add top nav | `.vitepress/config/index.ts` | Add to `nav` array (line ~18) |
| Add UI text | `apps/studio/src/i18n/locales/` | Add keys to zh-CN.json + en.json |
| Update studio | `/docs/guide/studio.md` | Edit relevant section (51KB file) |

---

## 📁 Directory Map

```
/docs/
├── guide/              ← User documentation (20+ files)
│   ├── studio.md       ← MAIN FILE (51KB)
│   ├── editor/         ← Editor features
│   ├── advscript/      ← Language docs
│   └── config/         ← Configuration
│
├── studio/             ← Studio-specific (1 file)
│   └── next-phase-plan.md ← Roadmap
│
├── about/              ← Architecture (15+ files)
│   ├── design/         ← Design philosophy
│   └── dev/            ← Development docs
│
├── .vitepress/
│   └── config/
│       └── index.ts    ← NAVIGATION CONFIG (543 lines)
│
└── LOCATIONS_*.md      ← Generated implementation guides (4 files)
```

---

## 🌐 Language Files Location

```
Chinese (zh-CN)       → apps/studio/src/i18n/locales/zh-CN.json
English (en)          → apps/studio/src/i18n/locales/en.json
```

When adding features, always add keys to BOTH files.

---

## 📝 Documentation Workflow

```
┌─────────────────────────────────────┐
│ 1. Write/Update markdown in /docs/  │
└────────────────┬────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│ 2. Update sidebar in config/index.ts│
└────────────────┬────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│ 3. Add i18n keys (both languages)   │
└────────────────┬────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│ 4. Test locally: pnpm run dev       │
└────────────────┬────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│ 5. Commit & push                    │
└─────────────────────────────────────┘
```

---

## 🎨 Content Types & Storage

```
Pattern: adv/{type}/{id}.md

Characters       → adv/characters/name.character.md
Scenes          → adv/scenes/name.md
Chapters        → adv/chapters/name.adv.md
Audio           → adv/audio/name.md
Locations       → adv/locations/name.md  ← NEW

Format: YAML frontmatter + optional markdown body
```

---

## 🔗 Three Most Important Files

| # | File | Purpose | Size |
|---|------|---------|------|
| 1 | `/docs/guide/studio.md` | Main feature documentation | 51KB |
| 2 | `/docs/.vitepress/config/index.ts` | Navigation & sidebar | 543 lines |
| 3 | `/docs/LOCATIONS_CRUD_PATTERN.md` | Implementation reference | 1075 lines |

---

## ⚡ Quick Command Reference

```bash
# Preview docs locally
cd docs
pnpm install
pnpm run dev
# Visit http://localhost:5173

# Build for production
pnpm run build

# Check syntax
pnpm run typecheck
```

---

## 💡 Pro Tips

- **Always update sidebar FIRST** - Pages won't show without it
- **Copy existing patterns** - Use ScenesPage.vue as template
- **Test locally** - Build errors caught before push
- **Bilingual from start** - Add both language keys
- **Cross-reference** - Link between related docs
- **Include examples** - Code beats words

---

## 🚨 Common Mistakes

```
❌ Updated markdown but not sidebar → Page won't show
❌ Added sidebar entry but no .md file → Broken link
❌ Only added Chinese, forgot English → Missing translations
❌ Didn't test locally → Build fails on CI
❌ Changed sidebar without updating nav → Navigation broken
```

---

## ✅ Verification Checklist

Before committing:

- [ ] Markdown file exists
- [ ] Sidebar entry added to config
- [ ] i18n keys in both language files
- [ ] No broken links to other docs
- [ ] Built successfully: `pnpm run build`
- [ ] Previewed: `pnpm run dev`
- [ ] Edit link works
- [ ] Language switcher works (if bilingual)

---

## 📊 Documentation Status

| Section | Status | Files | Focus |
|---------|--------|-------|-------|
| `/guide/` | ✅ Complete | 20+ | User documentation |
| `/about/` | ✅ Complete | 15+ | Architecture & design |
| `/api/` | ✅ Auto | 1 | TypeDoc (auto-generated) |
| `/agui/` | ✅ Complete | 15+ | Component library |
| `/ai/` | ✅ Complete | 10+ | AI & Skills |
| Locations | ⏳ Gen docs ready | 4 | Implementation complete, user docs pending |

---

## 🎯 Common Tasks

### Task: Update Studio Documentation
```
1. Open: /docs/guide/studio.md
2. Find section (use Ctrl+F)
3. Update content
4. Test: pnpm run dev
5. Commit: git add docs && git commit -m "docs: update studio..."
```

### Task: Add New Feature Documentation
```
1. Create: /docs/guide/my-feature.md
2. Edit: .vitepress/config/index.ts → sidebarGuide()
3. Add keys to: i18n/locales/*.json
4. Test & commit
```

### Task: Update Sidebar Order
```
1. Edit: .vitepress/config/index.ts
2. Find: sidebarGuide() or sidebarAbout()
3. Reorder items
4. Test & commit
```

---

## 📞 Getting Help

- **VitePress Questions**: https://vitepress.dev/
- **Contributing Guide**: `/docs/contributing/writing-guide.md`
- **Issues**: GitHub Issues on ADV.JS repo
- **Discussions**: GitHub Discussions on ADV.JS repo

---

## 📈 Quick Stats

- **Total docs**: 80+ markdown files
- **Total lines**: 5000+ lines of documentation
- **Languages**: Chinese (primary) + English (secondary)
- **Build time**: ~10 seconds
- **Page views/month**: (varies by feature)

---

**REMEMBER**: VitePress builds from markdown files in `/docs/` directory. Update docs → Update config → Add i18n → Test → Commit.

**Ready to document!** 🚀

