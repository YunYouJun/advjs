# @advjs/mcp-server

ADV.JS MCP (Model Context Protocol) Server — lets AI editors like Claude Code and Cursor access your visual novel project through a standardized interface.

## Installation

### Option 1: npx (recommended)

Add to your project's `.mcp.json`:

```json
{
  "mcpServers": {
    "advjs": {
      "command": "npx",
      "args": ["@advjs/mcp-server"]
    }
  }
}
```

### Option 2: Global install

```bash
npm install -g @advjs/mcp-server
```

Then in `.mcp.json`:

```json
{
  "mcpServers": {
    "advjs": {
      "command": "adv-mcp-server"
    }
  }
}
```

## How It Works

The MCP Server runs in your project directory and exposes your game content (world setting, characters, chapters, scenes) as structured resources that AI can read. It also provides tools for validation and prompt templates for common creative tasks.

**Architecture**: The MCP Server is a thin protocol adapter — all business logic lives in the `advjs` CLI package. This means `adv context` and `adv check` produce the same results whether used from the command line or through MCP.

## Resources

Resources are read-only data the AI can access:

| URI                      | Description                                                  |
| ------------------------ | ------------------------------------------------------------ |
| `adv://project/overview` | Combined world.md + outline.md summary                       |
| `adv://world`            | World bible (world.md)                                       |
| `adv://outline`          | Story outline (outline.md)                                   |
| `adv://glossary`         | Terminology glossary (glossary.md)                           |
| `adv://characters`       | Characters overview (characters/README.md)                   |
| `adv://characters/{id}`  | Individual character card (e.g. `adv://characters/aria`)     |
| `adv://chapters`         | Chapters overview (chapters/README.md)                       |
| `adv://chapters/{id}`    | Individual chapter script (e.g. `adv://chapters/chapter_01`) |
| `adv://scenes`           | Scenes overview (scenes/README.md)                           |

### Reading a Character

When the AI requests `adv://characters/aria`, the server reads `adv/characters/aria.character.md` and returns its full content.

### Reading a Chapter

When the AI requests `adv://chapters/chapter_01`, the server reads `adv/chapters/chapter_01.adv.md` and returns the script content.

## Tools

Tools are actions the AI can execute:

### `adv_validate`

Validates the project: checks script syntax, character reference consistency, and scene completeness.

**Parameters:**

- `root` (optional): Game content root directory

**Returns:** Validation results with pass/fail status and detailed issue list.

**Example output:**

```
All checks passed!
- 3 scripts checked
- 5 character references
- 2 scene references
```

Or on failure:

```
Found 2 issue(s):
✗ [character] chapters/chapter_01.adv.md: Unknown
⚠ [scene] chapters/chapter_02.adv.md: library
```

## Prompts

Prompts are pre-built templates for common creative tasks:

### `write-chapter`

Generates a comprehensive prompt for writing a new chapter, including world setting, story outline, character information, and glossary terms.

**Parameters:**

- `chapterNumber` (required): Chapter number to write (e.g. "3")
- `summary` (optional): Brief summary of what should happen

### `create-character`

Generates a prompt for creating a new character card with the proper `.character.md` format.

**Parameters:**

- `name` (required): Character name
- `role` (optional): Character role (e.g. "protagonist", "supporting")

### `review-script`

Generates a comprehensive review checklist for an existing chapter script.

**Parameters:**

- `chapterFile` (optional): Chapter filename to review (e.g. "chapter_01.adv.md")

## CLI Alternative: `adv context`

If your AI editor doesn't support MCP, you can use the CLI to export project context:

```bash
# Default: world.md + outline.md + README summaries + glossary
adv context

# Full: include all character cards and chapter scripts
adv context --full

# Chapter-specific: only context relevant to chapter 2
adv context --chapter 2
```

The output is a single Markdown document you can paste into any AI chat.

## Project Structure Expected

The MCP server expects the standard ADV.JS project structure:

```
my-game/
├── adv.config.json          # Optional: { "root": "adv" }
└── adv/
    ├── world.md             # World bible
    ├── outline.md           # Story outline
    ├── glossary.md          # Terminology (optional)
    ├── chapters/
    │   ├── README.md        # Chapter overview
    │   └── chapter_01.adv.md
    ├── characters/
    │   ├── README.md        # Character overview
    │   └── aria.character.md
    └── scenes/
        ├── README.md        # Scene overview
        └── school.md
```

See [Project Structure](/guide/project-structure) and [AI Formats](/ai/formats) for details on each file format.
