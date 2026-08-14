# @advjs/mcp-server

ADV.JS MCP (Model Context Protocol) Server — lets AI editors like Claude Code and Cursor access your visual novel project through a standardized interface.

## Installation

Install the two fixed launch entry packages, then let `adv` merge the Skills and
MCP settings for the target Agent client:

```bash
npm install --global "advjs@0.1.4" "@advjs/mcp-server@0.1.4"
adv agent install --client codex --skills default --mcp --json
adv doctor . --client codex --json
```

Supported clients are `codex`, `claude-code`, and `cursor`. The installer reads
the integrity-checked catalog shipped inside the installed `advjs` package; it
does not fetch Skills from the repository. Use `--dry-run` to inspect every
target path before writing. Repeated installation is idempotent and updates only
the ADV.JS-managed MCP entry:

| Client      | Skills directory    | MCP configuration                         |
| ----------- | ------------------- | ----------------------------------------- |
| Codex       | `~/.agents/skills/` | `~/.codex/config.toml` managed block      |
| Claude Code | `~/.claude/skills/` | `~/.claude.json` → `mcpServers.advjs`     |
| Cursor      | `~/.cursor/skills/` | `~/.cursor/mcp.json` → `mcpServers.advjs` |

To install only optional workflows, use `--skills optional`; use `--skills all`
for both groups. Existing files are backed up with a content-hash suffix before
an atomic replacement.

### Manual MCP configuration

When automatic installation is unsuitable, add the globally installed binary
to the client's MCP JSON configuration:

```json
{
  "mcpServers": {
    "advjs": {
      "command": "adv-mcp-server",
      "args": []
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
| `adv://branches/{id}`    | Branch graph (nodes + edges) for a chapter, as JSON          |
| `adv://coverage/{id}`    | Branch coverage report for a chapter, as JSON                |

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

Use the structured MCP result as the source of truth. For CLI automation, run
`adv check --json`; its success and failure envelopes are validated against the
frozen [CLI Output v1 Schema](https://github.com/YunYouJun/advjs/blob/dev/tests/launch/contracts/cli-output.schema.json).

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
