# ADV.JS Documentation Site Structure & Navigation Guide

**Last Updated**: 2026-04-13  
**Status**: Complete Overview  
**Purpose**: Navigate and understand the docs directory to add/update Scene, Location, and Studio features

---

## Quick Summary

**Repository**: `/Users/yunyou/repos/gh/yyj/advjs/`  
**Docs Root**: `/Users/yunyou/repos/gh/yyj/advjs/docs/`  
**VitePress Config**: `/Users/yunyou/repos/gh/yyj/advjs/docs/.vitepress/config/index.ts`  
**Languages**: 简体中文 (Primary) + English (Limited)  

---

## 📁 Directory Structure Overview

```
docs/
├── .vitepress/              # VitePress configuration & build output
│   ├── config/
│   │   ├── index.ts        # Main VitePress config (nav, sidebar, locale)
│   │   ├── head.ts         # Meta tags, analytics
│   │   └── constants.ts    # Constants (site title, description)
│   ├── theme/              # Custom theme components
│   └── dist/               # Build output
│
├── guide/                   # 📚 Main guide documentation (PRIMARY FOCUS)
│   ├── index.md            # Guide introduction
│   ├── quick-start.md      # Quick start tutorial
│   ├── project-structure.md # Project structure explanation
│   ├── features.md         # Feature overview
│   ├── cli.md              # CLI commands documentation
│   ├── mode.md             # Run/build modes
│   ├── record/
│   │   └── video.md        # Video recording feature
│   ├── studio.md           # ⭐ STUDIO DOCUMENTATION (51KB, COMPREHENSIVE)
│   ├── config/
│   │   ├── index.md        # Configuration basics
│   │   └── animation.md    # Animation configuration
│   ├── editor/
│   │   ├── index.md        # Core editor intro
│   │   ├── basic.md        # Basic operations
│   │   ├── script.md       # Script editor
│   │   ├── character.md    # Character management
│   │   ├── flow.md         # Flow/node editor
│   │   └── vrm.md          # VRM model editor
│   ├── advscript/          # AdvScript language docs
│   │   ├── index.md        # What is AdvScript?
│   │   ├── syntax.md       # Basic syntax
│   │   ├── code.md         # Extended syntax (TypeScript)
│   │   └── faq.md          # FAQ
│   └── typescript/
│       └── how.md          # Using with TypeScript
│
├── studio/                  # ⭐ STUDIO-SPECIFIC DOCS
│   └── next-phase-plan.md  # Studio Phase M1-M3+ roadmap
│
├── about/                   # Design & development info
│   ├── index.md            # About ADV.JS
│   ├── env.md              # Environment setup
│   ├── design/
│   │   ├── index.md        # Design philosophy
│   │   ├── storage.md      # Storage system architecture
│   │   ├── character.md    # Character system design
│   │   ├── i18n.md         # Internationalization design
│   │   ├── grammar.md      # Grammar/parser design
│   │   └── ui.md           # UI design
│   ├── dev/                # Development documentation
│   │   ├── index.md        # What is this?
│   │   ├── standard.md     # Development standards
│   │   ├── icons.md        # Icons system
│   │   ├── parser.md       # Parser system
│   │   ├── stores.md       # State management (Pinia stores)
│   │   ├── dependencies.md # Dependencies explanation
│   │   ├── pominis.md      # Pominis system
│   │   ├── faq.md          # Development FAQ
│   │   ├── ref.md          # References
│   │   ├── build.md        # Build system
│   │   ├── render.md       # Rendering system
│   │   ├── features.md     # Development features
│   │   └── todo.md         # TODO/roadmap items
│   ├── future/
│   │   └── index.md        # Future vision & ideas
│   └── contributing/       # Contributing guide
│
├── api/                     # API documentation (TypeDoc)
│   └── typedoc-sidebar.json # Auto-generated from code
│
├── agui/                    # AGUI Component Library
│   ├── index.md            # AGUI intro
│   ├── design.md           # Design style guide
│   ├── quick-start.md      # Quick start
│   └── components/         # Component docs
│       ├── layout.md
│       ├── assets-explorer.md
│       ├── button.md
│       ├── checkbox.md
│       ├── input.md
│       ├── input-number.md
│       ├── number-slider.md
│       ├── radio.md
│       ├── select.md
│       ├── sidebar.md
│       ├── switch.md
│       ├── tabs.md
│       └── tree.md
│
├── ai/                      # AI & Skills Documentation
│   ├── index.md            # AI intro
│   ├── ai-first-strategy.md
│   ├── formats.md          # Content format specifications
│   ├── strategy.md         # Generation strategy
│   ├── mcp.md              # MCP integration
│   ├── ref.md              # References
│   ├── faq.md              # FAQ
│   └── skills/             # ADV.JS Skills
│       ├── index.md        # Skills intro
│       ├── adv-story.md    # adv-story skill
│       ├── openclaw.md     # OpenClaw integration
│       └── roadmap.md      # Skills roadmap
│
├── ecosystem/              # Ecosystem & integrations
│   └── index.md
│
├── resources/              # Resources & learning
│   ├── index.md            # Resource overview
│   ├── showcases.md        # Project showcases
│   └── learning.md         # Learning resources
│
├── contributing/           # Contribution guidelines
│   ├── index.md            # Contributing guide
│   └── writing-guide.md    # Documentation writing guide
│
├── public/                 # Static assets
│   ├── favicon.svg
│   └── ...
│
├── en/                      # English translations (limited)
│   └── guide/
│
├── LOCATIONS_CRUD_PATTERN.md       # (Generated documentation)
├── LOCATIONS_QUICK_START.md        # (Generated documentation)
├── LOCATIONS_DETAILED_REFERENCE.md # (Generated documentation)
├── EXPLORATION_SUMMARY.md          # (Generated documentation)
├── README.md               # Docs root README
├── package.json
├── uno.config.ts
├── vite.config.ts
├── typedoc.json
└── netlify.toml
```

---

## 🗺️ Navigation Structure (from VitePress config)

The VitePress sidebar is defined in `/docs/.vitepress/config/index.ts` with these sections:

### Navigation Bar (Top)

```
指南 → /guide/
AI → /ai/
API → /api/
AGUI → /agui/
关于 (About)
  ├─ ADV.JS → /about/index
  ├─ 设计 (Design) → /about/design/
  ├─ 开发 (Dev) → /about/dev/
  ├─ 设想 (Future) → /about/future/
  ├─ 发展路线 (Roadmap)
  │  └─ Studio 下一阶段计划 → /studio/next-phase-plan
  └─ 贡献 (Contributing)
     ├─ 参与贡献 → /contributing/
     └─ 文档写作指南 → /contributing/writing-guide

资源 (Resources)
  ├─ 素材 (Assets) → /resources/
  ├─ 案例 (Showcases) → /resources/showcases
  └─ 学习资源 (Learning) → /resources/learning

生态 (Ecosystem)
  ├─ 总览 (Overview) → /ecosystem/
  ├─ 工具 (Tools)
  │  ├─ 剧本解析器 → https://parser.advjs.org
  │  └─ VRM 模型编辑器 → https://vrm.advjs.org
  └─ Help
     ├─ GitHub Issues
     └─ GitHub Discussions
```

### Sidebar for `/guide/` Section

```
指南 (Guide)
├─ 介绍 → /guide/
├─ 快速开始 → /guide/quick-start
├─ 项目结构 → /guide/project-structure
├─ 运行与编译 → /guide/mode
├─ 功能 → /guide/features
├─ CLI → /guide/cli
├─ 录制视频 → /guide/record/video
└─ Studio → /guide/studio ⭐

配置 (Configuration)
├─ 基础配置 → /guide/config/
└─ 动画 → /guide/config/animation

编辑器 (Editor)
├─ 核心编辑器 → /guide/editor/
│  ├─ 基础操作 → /guide/editor/basic
│  ├─ 剧本编辑器 → /guide/editor/script
│  ├─ 角色管理 → /guide/editor/character
│  └─ 节点编辑器 → /guide/editor/flow
└─ VRM 模型编辑器 → /guide/editor/vrm

AdvScript
├─ 什么是 AdvScript? → /guide/advscript/
├─ 基础语法 → /guide/advscript/syntax
├─ 扩展语法 → /guide/advscript/code
├─ 常见问题 → /guide/advscript/faq
└─ 与 TypeScript 使用 → /guide/typescript/how
```

### Sidebar for `/ai/` Section

```
AI
├─ 介绍 → /ai/
├─ AI 优先战略 → /ai/ai-first-strategy
├─ 创作文件格式规范 → /ai/formats
├─ 生成策略 → /ai/strategy
├─ MCP → /ai/mcp
├─ 参考 → /ai/ref
└─ FAQ → /ai/faq

Skills
├─ 介绍 → /ai/skills/
├─ adv-story → /ai/skills/adv-story
├─ OpenClaw 集成 → /ai/skills/openclaw
└─ 路线图 → /ai/skills/roadmap
```

---

## 📝 Key Documentation Files for Scene/Location/Studio

### For Understanding Studio Architecture:

1. **`/docs/guide/studio.md`** (51KB - MAIN REFERENCE)
   - Complete Studio feature documentation
   - Workspace, Chat, World, Play, Resources management
   - Technical architecture, state management, storage

2. **`/docs/studio/next-phase-plan.md`** (20KB)
   - Phase M1-M3 roadmap (Mobile-first)
   - Completed phases 1-27 overview
   - Future features and enhancements

### For LOCATIONS Implementation:

3. **`/docs/LOCATIONS_CRUD_PATTERN.md`** (1075 lines)
   - Complete architectural guide
   - Detailed patterns and conventions
   - Full code examples for implementation

4. **`/docs/LOCATIONS_QUICK_START.md`** (350 lines)
   - Quick reference checklist
   - File creation summary
   - Code snippets

5. **`/docs/LOCATIONS_DETAILED_REFERENCE.md`** (600+ lines)
   - Line-by-line implementation guide
   - 6-phase workflow
   - Data models and testing checklist

6. **`/docs/EXPLORATION_SUMMARY.md`** (365 lines)
   - Overview of findings
   - Key architectural decisions
   - Implementation phases

### For Scene Documentation:

7. **`/docs/guide/editor/character.md`**
   - Character management (could be model for Scene docs)

### For Configuration & Design:

8. **`/docs/guide/config/index.md`** - Configuration documentation
9. **`/docs/about/design/character.md`** - Design philosophy for content types
10. **`/docs/about/design/storage.md`** - Storage system architecture

---

## 🎯 Content Organization Principles

### Markdown Storage Format

All content uses YAML frontmatter:

```markdown
---
id: unique-identifier
name: Display Name
type: content-type
{other-fields}: values
---
# Optional markdown body
```

### File Path Convention

**Pattern**: `adv/{contentType}/{id}.md`

Examples:
- Characters: `adv/characters/protagonist.character.md`
- Scenes: `adv/scenes/tavern-entrance.md`
- Chapters: `adv/chapters/chapter-01.adv.md`
- Audio: `adv/audio/ambient-tavern.md`
- **Locations** (new): `adv/locations/{id}.md`

### Language Organization

- **Primary**: 简体中文 (Chinese) - Full documentation
- **Secondary**: English - Limited (guide section only in `/en/`)

---

## 🔄 How to Add New Content/Features

### For Scene Documentation

1. **Update `/docs/guide/studio.md`** - Add section to "资源管理" or create new subsection
2. **Optional**: Create `/docs/guide/scenes.md` if scene management warrants dedicated page
3. **Update sidebar** in `.vitepress/config/index.ts` if new page added
4. **Add i18n keys** to both language files

### For Location Documentation

1. **Use existing documentation** in `/docs/LOCATIONS_*.md` as reference
2. **Create `/docs/guide/locations.md`** (new page, ~2-3KB)
3. **Update `/docs/guide/studio.md`** - Add locations management section
4. **Update sidebar** in `.vitepress/config/index.ts`
   ```typescript
   {
     text: '位置管理',
     link: '/guide/locations',
   },
   ```
5. **Add i18n keys** to `apps/studio/src/i18n/locales/`

### For Studio Feature Documentation

1. **Update `/docs/guide/studio.md`** - Most comprehensive source
2. **Reference `/docs/studio/next-phase-plan.md`** for roadmap context
3. **Add new tabs/sections** if major UI changes
4. **Update architecture section** if state management changes

### For Design/Architecture Documentation

1. **Update `/docs/about/design/character.md`** pattern for new content types
2. **Add to `/docs/about/dev/stores.md`** if new Pinia store created
3. **Add to `/docs/about/dev/parser.md`** if new parsing logic needed

---

## 📊 Documentation Statistics

| Section      | Files | Purpose                          |
| ------------ | ----- | -------------------------------- |
| `guide/`     | 20+   | User documentation & tutorials   |
| `studio/`    | 1     | Studio-specific roadmap          |
| `about/`     | 15+   | Architecture & development       |
| `api/`       | 1     | TypeDoc auto-generated API       |
| `agui/`      | 15+   | AGUI component library           |
| `ai/`        | 10+   | AI & Skills documentation        |
| Generated    | 4     | LOCATIONS implementation guides  |

**Total**: 80+ markdown files

---

## 🛠️ VitePress Config Key Parameters

### Location Configuration

```typescript
// File: docs/.vitepress/config/index.ts

// Line 520-527: Locale configuration
locales: {
  root: {
    label: '简体中文',
  },
  en: {
    label: 'English',
  },
}

// Line 450-470: Sidebar configuration
const sidebar: DefaultTheme.Config['sidebar'] = {
  '/guide/': sidebarGuide(),
  '/ai/': sidebarAI(),
  '/about/': sidebarAbout(),
  '/studio/': /* needs to be added if docs split */
}

// Line 18-123: Navigation configuration
const nav: DefaultTheme.Config['nav'] = [
  { text: '指南', link: '/guide/' },
  // ...
]
```

### Edit Link Configuration

```typescript
// Line 492-495
editLink: {
  pattern: 'https://github.com/YunYouJun/advjs/edit/main/docs/:path',
  text: '✍️ 帮助改善此页面',
}
```

---

## 🔍 Finding Existing Documentation

### Search by Content Type

**Scenes**:
- `/docs/guide/studio.md` (lines ~240-260) - Scene management section

**Characters**:
- `/docs/guide/editor/character.md` - Character editor
- `/docs/guide/studio.md` (lines ~43-62) - World tab, character interaction
- `/docs/about/design/character.md` - Design philosophy

**Locations** (to be added):
- Generation docs: `/docs/LOCATIONS_*.md` (4 files)
- Use these as implementation reference

**World/Project**:
- `/docs/guide/studio.md` - Complete World tab documentation (lines ~40-62)
- `/docs/studio/next-phase-plan.md` - Future development

---

## 💡 Best Practices for Documentation

### File Naming
- Use kebab-case: `my-feature.md`
- Content type prefix optional: `scene-management.md` or `scenes.md`

### Directory Structure
- Group by functional area
- Use index.md for section introductions
- Avoid deep nesting (max 3 levels)

### Writing Style
- Bilingual when possible (Chinese primary)
- Use headings hierarchy: H1 (title) → H2 (sections) → H3 (subsections)
- Include code examples for technical docs
- Add "Last Updated" dates for changelogs

### Sidebar Updates
- Always update `sidebarGuide()` function when adding new guide pages
- Maintain consistent naming (Chinese for Chinese docs)
- Group related items with `collapsed: true/false`

---

## 📱 Viewing the Documentation

### Build & Preview Locally

```bash
cd docs
pnpm install
pnpm run dev
# Visit http://localhost:5173
```

### Production URL

```
https://docs.advjs.org (primary)
https://advjs.org/docs (fallback)
```

### Build Output

Generated in `/docs/.vitepress/dist/`

---

## 🔗 Quick Links

| Resource                    | Location                                    |
| --------------------------- | ------------------------------------------- |
| VitePress Main Config       | `docs/.vitepress/config/index.ts`          |
| Navigation Structure        | Lines 18-123 in config/index.ts            |
| Sidebar Guide               | `sidebarGuide()` function, lines 240-344   |
| Sidebar About               | `sidebarAbout()` function, lines 361-448   |
| Sidebar AI                  | `sidebarAI()` function, lines 125-151      |
| Studio Documentation        | `/docs/guide/studio.md`                    |
| Studio Roadmap              | `/docs/studio/next-phase-plan.md`          |
| Contributing Guide          | `/docs/contributing/index.md`              |
| i18n Configuration          | `apps/studio/src/i18n/locales/*.json`     |

---

## ✅ Checklist for Adding Documentation

When adding new features, follow this checklist:

- [ ] **Write/update markdown** in appropriate section
- [ ] **Update VitePress sidebar** in `.vitepress/config/index.ts`
- [ ] **Add i18n keys** to `apps/studio/src/i18n/locales/`
- [ ] **Add "Last Updated" date** to frontmatter (optional)
- [ ] **Include examples** (code, screenshots, etc.)
- [ ] **Cross-reference** related documentation
- [ ] **Test build**: `pnpm run build` in docs directory
- [ ] **Preview**: `pnpm run dev` and visit locally
- [ ] **Commit** with descriptive message

---

**Need to add Scene/Location/Studio docs? Start with:**
1. Review `/docs/guide/studio.md` for context
2. Check `/docs/LOCATIONS_*.md` for implementation patterns
3. Update VitePress config if adding new pages
4. Follow VitePress markdown conventions
5. Build locally to verify rendering

Good luck! 🚀
