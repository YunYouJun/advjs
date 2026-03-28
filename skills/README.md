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

### adv-story (v0.2.0)

Interactive ADV narrative player with context awareness and multi-chapter navigation.

- **Context**: `adv context` — Load project world and characters
- **Load a script**: `adv play <script.adv.md>`
- **Advance**: `adv play next --session-id <id>`
- **Choose**: `adv play choose <number> --session-id <id>`
- **Status**: `adv play status --session-id <id>`

### adv-create (v0.1.0)

Create a complete ADV.JS visual novel project from a concept description.

- **Initialize**: `adv init <dir> --name <name>`
- **Customize**: Edit world, characters, outline, scenes
- **Validate**: `adv check`

### adv-debug (v0.1.0)

Debug and analyze ADV.JS projects for branch coverage, dead paths, and consistency.

- **Validate**: `adv check`
- **Analyze**: `adv context --full`
- **Test paths**: `adv play` through all branches
- **Report**: Coverage tables and fix suggestions

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
