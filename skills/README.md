# ADV.JS Skills

OpenClaw Skills for ADV.JS interactive narrative engine.

## Directory Structure

Each skill is a subdirectory containing a `SKILL.md` definition file:

```
skills/
├── README.md
└── adv-story/
    ├── SKILL.md          # OpenClaw Skill definition
    └── examples/
        └── demo.adv.md   # Example script
```

## Available Skills

### adv-story

Interactive ADV narrative player. Allows OpenClaw agents to drive ADV.JS stories through the `adv play` CLI commands.

- **Load a script**: `adv play <script.adv.md>`
- **Advance**: `adv play next --session-id <id>`
- **Choose**: `adv play choose <number> --session-id <id>`
- **Status**: `adv play status --session-id <id>`

## Creating New Skills

1. Create a new directory under `skills/`
2. Add a `SKILL.md` file with YAML frontmatter and Markdown instructions
3. Include example files in an `examples/` subdirectory
