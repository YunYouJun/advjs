# ADV.JS Content & Resource Types Analysis

## Overview

This report documents all resource/content types available in the advjs monorepo, including what's already implemented with infrastructure and what would be new additions.

---

## 1. CURRENTLY IMPLEMENTED RESOURCE TYPES

### A. Core Story Content Types

#### 1. **Chapters** (.adv.md files)

- **Type Definition**: `packages/types/src/game/chapter.ts`
- **Parser**: `packages/parser/src/core.ts`
- **Format**: Fountain-like markdown syntax with support for multiple node types
- **Infrastructure**: ✅ COMPLETE
  - Frontmatter parsing (scene, background)
  - AST parsing and serialization
  - Flow nodes (dialogue, backgrounds, tachies, etc.)
  - Syntax: `@character`, `> narration`, choices with branching

#### 2. **Characters** (.character.md files)

- **Type Definition**: `packages/types/src/game/character.ts`
- **Parser**: `packages/parser/src/character.ts`
- **Format**: YAML frontmatter + markdown body sections
- **Infrastructure**: ✅ COMPLETE
  - Frontmatter fields: id, name, avatar, actor, cv, aliases, tags, faction, tachies, relationships
  - Body sections: appearance, personality, background, concept, speechStyle, knowledgeDomain, expertisePrompt
  - Dynamic state support: `AdvCharacterDynamicState` (location, health, activity, attributes, recentEvents)
  - Relationship mapping system
  - AI-friendly export format
  - Character visualization support (立绘/tachies)

#### 3. **Scenes** (.md files in adv/scenes/)

- **Type Definition**: `packages/types/src/game/scene.ts`
- **Parser**: `apps/studio/src/utils/sceneMd.ts` (custom parser)
- **Format**: YAML frontmatter + markdown body
- **Infrastructure**: ✅ BASIC (Extensible)
  - Types: image | model
  - Fields: id, name, description, imagePrompt, src, tags
  - Scene alias support
  - Image generation prompt support

### B. Audio & Music

#### 1. **BGM/Music**

- **Type Definition**: `packages/types/src/game/music.ts`
- **Config**: `packages/types/src/config/game.ts`
- **Infrastructure**: ✅ PARTIAL
  - Interface: `AdvMusic` (name, description, src)
  - Game config supports:
    - Custom collection: `bgm.collection: AdvMusic[]`
    - Music library (local or remote): `bgm.library: Record<string, AdvMusic | AdvMusic[]>`
    - Autoplay option
  - Flow node integration: `AdvDialoguesNode` supports `bgmThemeId` and `bgmSrc`
  - **Status**: Infrastructure exists but no dedicated .music.md format yet

#### 2. **Audio/Sound Effects (SE)**

- **Infrastructure**: ⚠️ COMMENTED OUT
  - Commented code in `packages/types/src/config/game.ts` suggests planned audio support:
    ```typescript
    // audios: Record<string, string>
    ```
  - **Status**: Partially planned but not fully implemented

### C. Flow & Branching

#### 1. **Flow/Branching Logic**

- **Type Definition**: `packages/types/src/flow/node.ts`
- **Edge Definition**: `packages/types/src/flow/edge.ts`
- **Package**: `@advjs/flow` provides visual flow editor components
- **Infrastructure**: ✅ COMPLETE
  - Node types:
    - `AdvStartNode` - Start point
    - `AdvBackgroundNode` - Background/scene management
    - `AdvTachieNode` - Character position/animation
    - `AdvDialoguesNode` - Dialogue sequences with BGM
    - `AdvEndNode` - End point
    - `AdvFountainNode` - Direct fountain format support
  - Edge system for connections
  - Configurable next/prev navigation
  - Cross-chapter navigation support
  - Runtime tracking

#### 2. **Choices & Branching**

- **AST Type**: `packages/types/src/ast/index.ts` - `Choices` interface
- **Infrastructure**: ✅ COMPLETE
  - Multiple choice options per node
  - Custom action code per choice
  - Target navigation
  - Default selection

### D. Knowledge Base System

#### 1. **Knowledge/Reference Files** (adv/knowledge/\*.md)

- **Composable**: `apps/studio/src/composables/useKnowledgeBase.ts`
- **Infrastructure**: ✅ COMPLETE
  - Hierarchical structure: adv/knowledge/ or adv/knowledge/{domain}/
  - Automatic domain extraction
  - Section-based parsing (split by ## headings)
  - Keyword-based search and retrieval
  - Cloud storage support (COS)
  - Character-level context injection for AI
  - Used by: Character state simulation, world events generation
  - **File structure**:
    - adv/knowledge/ (general domain)
    - adv/knowledge/law/ (specialized domains)
    - adv/knowledge/{domain}/\*.md

### E. World Simulation State

#### 1. **World Clock & Events**

- **Type Definition**: `packages/types/src/game/world.ts`
- **Infrastructure**: ✅ COMPLETE
  - WorldClockState: date, period, weather, running, timeScale
  - DayPeriod: morning | afternoon | evening | night
  - WorldEvent: id, date, period, summary, type, characterIds, timestamp
  - Event types: daily | social | unexpected | weather | manual
  - Event history tracking

#### 2. **Character Dynamic State**

- **Type Definition**: `packages/types/src/game/character.ts` - `AdvCharacterDynamicState`
- **Store**: `apps/studio/src/stores/useCharacterStateStore.ts`
- **Infrastructure**: ✅ COMPLETE
  - Fields: location, health, activity, attributes (custom numeric), recentEvents, lastUpdated
  - Persistence to Dexie (IndexedDB)
  - Mood tracking (6-level system)
  - Integration with character chat for AI simulation
  - Used by: World simulation, event generation

### F. Project Content Management

#### 1. **Project Stats**

- **Type Definition**: `apps/studio/src/composables/useProjectContent.ts` - `ProjectStats`
- **Infrastructure**: ✅ PARTIAL
  - Current stats: chapters, characters, scenes, knowledge
  - **Status**: Extensible for additional resource types

#### 2. **Project Persistence**

- **Composable**: `apps/studio/src/composables/useProjectContent.ts`
- **Infrastructure**: ✅ COMPLETE
  - Multi-source loading: Local directory or COS cloud
  - Automatic project discovery
  - Content synchronization
  - Watch-based auto-reload on project switch

---

## 2. RESOURCE TYPES WITH PARTIAL/COMMENTED INFRASTRUCTURE

### A. Audio/Sound Effects (SE)

- **Location**: Commented in `packages/types/src/config/game.ts`
- **Status**: ⚠️ Infrastructure sketched but not implemented
- **Needed**:
  - `.music.md` or `.audio.md` file format
  - Type definitions for sound effects
  - Parser implementation
  - Runtime audio loading/playback

### B. Images/CG Gallery

- **Current Support**:
  - Background images: ✅ Built into scenes
  - Character sprites (tachies): ✅ In character.tachies
  - General image assets: Via PixiJS AssetsManifest
- **Missing**:
  - Dedicated CG gallery metadata format
  - Gallery unlock tracking
  - Image categorization system
  - **Status**: Partial (images supported, gallery system missing)

---

## 3. RESOURCE TYPES NOT YET IMPLEMENTED

### A. Items/Inventory System

- **Status**: ❌ NO INFRASTRUCTURE
- **Needed**:
  - Item type definitions
  - Inventory data structure
  - `.item.md` file format
  - Parser and persistence
  - Item interaction logic

### B. Achievements/Trophies

- **Status**: ❌ NO INFRASTRUCTURE
- **Needed**:
  - Achievement metadata format
  - Unlock conditions
  - Progress tracking
  - Display system

### C. Saves/Game State

- **Status**: ⚠️ PARTIAL
  - Character dynamic state can be saved
  - World events can be persisted
  - **Missing**: Complete save/load system with slot management

### D. Variables/Flags

- **Status**: ⚠️ PARTIAL
  - Code execution in choices: ✅ `Code` operations
  - Attributes in character state: ✅ `attributes: Record<string, number>`
  - **Missing**: Global game state manager, persistent flags

### E. Dialogue History/Log

- **Status**: ❌ NO INFRASTRUCTURE
- **Needed**: Dialogue tracking and replay system

### F. Localization/i18n

- **Config**: `packages/types/src/config/adv.ts` mentions locales directory
- **Status**: ⚠️ INFRASTRUCTURE SKETCHED
  - Config path exists: `/<rootDir>/locales`
  - **Missing**: Actual implementation

---

## 4. FILE TYPE SUMMARY

### Supported File Types by Extension

| Extension             | Type                | Parser                                               | Infrastructure |
| --------------------- | ------------------- | ---------------------------------------------------- | -------------- |
| `.adv.md`             | Chapter/dialogue    | ✅ `packages/parser/src/core.ts`                     | ✅ COMPLETE    |
| `.character.md`       | Character           | ✅ `packages/parser/src/character.ts`                | ✅ COMPLETE    |
| `.md` (in scenes/)    | Scene               | ✅ `apps/studio/src/utils/sceneMd.ts`                | ✅ BASIC       |
| `.md` (in knowledge/) | Knowledge/Reference | ✅ `apps/studio/src/composables/useKnowledgeBase.ts` | ✅ COMPLETE    |
| `.adv.json`           | Flow-based chapter  | ✅ (via JSON parsing)                                | ✅ BASIC       |
| `.json`               | Config/manifest     | ✅ (standard JSON)                                   | ✅ COMPLETE    |

### Missing File Types

- `.music.md` - Music/audio metadata (planned, not implemented)
- `.item.md` - Item definitions (not planned)
- `.achievement.md` - Achievement definitions (not planned)
- `.cg.md` or `.gallery.md` - CG gallery metadata (not planned)

---

## 5. AST & SYNTAX SUPPORT

### Current AST Node Types (AdvAst)

From `packages/types/src/ast/index.ts`:

- **Structural**: Text, Paragraph, Narration, SceneInfo, Heading
- **Characters**: Character, Dialog, Words, Tachie
- **Interaction**: Choices, Choice, Go
- **Visual**: Background, Camera, Image
- **Code**: Code (operations), CodeOperation, CodeFunction
- **Formatting**: Emphasis, Strong, Delete, Link, Break

### Code Operations

Supported code-based operations:

- Camera control
- Tachie positioning
- Background loading
- Navigation (Go)

**Status**: Extensible for additional operations

---

## 6. PROJECT STRUCTURE CONVENTIONS

### Discovered Directory Structure

From `projectTemplate.ts` and demo projects:

```
adv/
├── world.md                    # World settings
├── outline.md                  # Story outline
├── chapters/                   # Chapter files
│   ├── 01.adv.md
│   └── 02.adv.md
├── characters/                 # Character definitions
│   ├── hero.character.md
│   └── npc.character.md
├── scenes/                     # Scene definitions
│   ├── bedroom.md
│   └── park.md
└── knowledge/                  # Knowledge base
    ├── general/
    │   └── overview.md
    ├── law/
    │   ├── criminal.md
    │   └── civil.md
    └── science/
        └── physics.md
```

### Asset Directories (from demo/love/public)

- `img/bg/` - Background images
- `img/characters/` - Character sprites

---

## 7. STATS INTERFACE

### Current ProjectStats (useProjectContent.ts)

```typescript
interface ProjectStats {
  chapters: number
  characters: number
  scenes: number
  knowledge: number
}
```

### Possible Extensions

```typescript
interface ProjectStats {
  chapters: number
  characters: number
  scenes: number
  knowledge: number
  // Potential additions:
  items?: number
  achievements?: number
  locations?: number
  musicTracks?: number
}
```

---

## 8. @advjs/flow PACKAGE

### Location

`packages/flow/`

### Contents

- **Components**: Flow editor nodes and visualization
- **Composables**:
  - `useFlowHistory` - Undo/redo system
  - `useFlowLayout` - Node positioning
  - `useGlobalFlowEditor` - Global state management
- **Types**: `FlowNodeStatus` = '' | 'running' | 'idle' | 'done' | 'error'
- **Utils**: Editor utilities

### Purpose

Visual node-based flow editor for chapter authoring (alternative to fountain/markdown)

---

## 9. CONFIGURATION INFRASTRUCTURE

### Supported Config Directories

From `packages/types/src/config/adv.ts`:

- `/<rootDir>/setups` - Setup files
- `/<rootDir>/locales` - Localization files
- `/<rootDir>/components` - Custom components
- `/<rootDir>/layouts` - Layout templates
- `/<rootDir>/pages` - Page definitions
- `/<rootDir>/styles` - Stylesheets

---

## 10. SUMMARY: NEW RESOURCE TYPES THAT COULD BE ADDED

### High Priority (Framework ready)

1. **Sound Effects (SE)** - Partially planned in config
2. **Items/Inventory** - Could use existing character.attributes pattern
3. **Global Variables/Flags** - Could extend from code operations

### Medium Priority (Needs new infrastructure)

1. **CG Gallery System** - Images exist, need metadata/unlock system
2. **Achievements** - New system needed
3. **Dialogue History** - New system needed
4. **Save Slots** - Extend character state system

### Low Priority (Larger scope)

1. **Localization System** - Config exists, needs implementation
2. **Advanced Inventory** - Complex system
3. **Crafting System** - Game-specific

---

## 11. KEY FILES REFERENCE

### Type Definitions

- `packages/types/src/game/` - All game content types
- `packages/types/src/flow/` - Branching/flow types
- `packages/types/src/ast/` - Abstract syntax tree
- `packages/types/src/config/` - Configuration schemas

### Parsers

- `packages/parser/src/core.ts` - Fountain/markdown parser
- `packages/parser/src/character.ts` - Character parser
- `packages/parser/src/syntax/` - Syntax rules

### Studio/UI

- `apps/studio/src/composables/useKnowledgeBase.ts` - Knowledge system
- `apps/studio/src/composables/useProjectContent.ts` - Project loading
- `apps/studio/src/stores/useCharacterStateStore.ts` - Character state
- `apps/studio/src/utils/projectTemplate.ts` - Project template

### Flow Editor

- `packages/flow/` - Complete flow editor package
- `packages/flow/components/` - Flow editor components
- `packages/flow/composables/` - Flow state management
