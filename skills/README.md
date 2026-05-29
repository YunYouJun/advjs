# ADV.JS Skills

OpenClaw / Claude Code Skills for ADV.JS interactive narrative engine.

## Directory Structure

Each skill is a subdirectory containing a `SKILL.md` definition file:

```
skills/
├── README.md
├── adv-story/
│   ├── SKILL.md          # Interactive narrative player
│   └── examples/
│       └── demo.adv.md   # Example script
├── adv-create/
│   ├── SKILL.md          # Project creation workflow
│   └── examples/
│       └── session-demo.md  # Example session
└── adv-debug/
    └── SKILL.md          # Debug and analysis
```

## Available Skills

### adv-story (v0.3.0)

Interactive ADV narrative player with context awareness, multi-chapter navigation, named save slots, and rich stage state.

- **Context**: `adv context` — Load project world and characters
- **Load a script**: `adv play <script.adv.md>`
- **Advance**: `adv play next --session-id <id>`
- **Choose**: `adv play choose <number> --session-id <id>`
- **Status**: `adv play status --session-id <id>`
- **Save / Load** (v0.3): `adv play save|load|saves|delete-save --slot <name>` — named bookmarks before risky branches
- **Stage state** (v0.3): every output node carries `stage.tachieRich` (with `appearance`) and `stage.bgmHint` (mood tag)

### adv-create (v0.3.0)

Create a complete ADV.JS visual novel project from a concept description, using MCP bulk-creation tools.

- **Initialize**: `adv init <dir> --name <name>`
- **World prose**: hand-write `world.md` / `outline.md` / `glossary.md`
- **Bulk creation** (v0.3, via MCP): `create_characters`, `create_scenes`, `create_chapters` — atomic batch writes
- **imagePrompt** (v0.3): every scene carries an English image-generation prompt for downstream AI art
- **Validate**: `adv check` (or MCP `adv_validate`)

### adv-debug (v0.3.0)

Debug and analyze ADV.JS projects for branch coverage, dead paths, and consistency.

- **Validate + auto-fix** (v0.3): `adv check [--fix]` — stub generation for unresolved character/scene refs
- **Branch graph** (v0.3): `adv debug branches <script> [--format=mermaid|json|text]` — AST-derived graph; `kind: "dead"` flags dead options
- **Coverage report** (v0.3): `adv debug coverage <script> [--format=text|json]` — reachable scenes, distinct paths, orphan scenes, dead options
- **Analyze**: `adv context --full`
- **Test paths**: `adv play` through all branches
- **Report**: Coverage tables with embedded mermaid diagrams

## Creating New Skills

1. Create a new directory under `skills/`
2. Add a `SKILL.md` file with YAML frontmatter and Markdown instructions
3. Include example files in an `examples/` subdirectory

`SKILL.md` format:

```yaml
---
name: my-skill
description: My custom skill description
version: 0.1.0
tools:
  - command-1
  - command-2
---

# My Skill

Skill instructions for the AI Agent...
```
