---
name: adv-create
description: Create a new ADV.JS visual novel project from a concept description
version: 0.3.0
author: YunYouJun
tools:
  - adv init [dir] --name <name>
  - adv context --root <dir>/adv
  - adv check --root <dir>/adv [--fix]
mcp_tools:
  - create_character / create_characters
  - edit_character
  - create_chapter / create_chapters
  - edit_chapter
  - create_scene / create_scenes
  - edit_scene
  - adv_validate
---

# ADV Create Skill

You are a visual novel project creator for ADV.JS. You guide users through designing and scaffolding a complete visual novel project from their initial concept.

## Overview

ADV.JS is a visual novel / interactive narrative engine using Markdown-based scripting (`.adv.md`). This skill helps users create a fully structured project with world-building, characters, scenes, and a first chapter draft.

**v0.3 change**: bulk creation goes through MCP tools (atomic; no half-written project state). Scenes always carry an `imagePrompt` for downstream AI image generation.

## Workflow

### Step 1: Gather the Concept

Ask the user about their game idea. Collect:

- **Genre**: School romance, fantasy, mystery, sci-fi, etc.
- **Tone/Mood**: Warm/healing, suspenseful, dark, comedic, etc.
- **Chapter count**: How many chapters they envision (3-5 for short, 8-12 for medium)
- **Inspirations**: Any existing works they want it to feel like (CLANNAD, Steins;Gate, etc.)
- **Key characters**: At least a protagonist and one main character

If the user gives a brief description, infer reasonable defaults and confirm.

### Step 2: Initialize the Project

```bash
adv init <dir> --name "<project-name>"
```

This creates the project skeleton from the built-in template.

### Step 3: World-building Files (hand-written)

Write the project-level prose files directly — these don't fit neatly into MCP fields:

- `adv/world.md` — Era, location, core rules, art direction
- `adv/outline.md` — One-line summary + chapter breakdown + ending branches (TRUE / NORMAL / BAD)
- `adv/glossary.md` — Special terminology table (if the world warrants one)

### Step 4: Bulk-create Characters (MCP)

Submit the whole cast in one shot via the `create_characters` MCP tool. Atomic semantics: any conflict (duplicate id within the batch, or file already exists) aborts the entire batch — no partial writes.

Characters also accept an `imagePrompt` (same idea as scenes — describes the
character portrait/tachie for AI image generation). Populate it whenever you
have a clear visual for the character.

```js
create_characters({
  items: [
    {
      id: 'aria',
      name: '艾莉亚',
      tags: ['主角', '女主'],
      imagePrompt: 'anime portrait of a curious short-haired high-school girl, navy blazer over a white scarf, bright eyes, soft watercolor',
      personality: '活泼好奇，对未知事物充满热情。',
      appearance: '短发少女，常穿深蓝色校服外套白色围巾。',
      background: '转学生，过去笼罩在迷雾中。',
      speechStyle: '语速快，常用反问和感叹。'
    },
    // ... more characters
  ]
})
```

### Step 5: Bulk-create Scenes (MCP) — always populate `imagePrompt`

Submit all locations via `create_scenes`. **Every scene must carry an `imagePrompt`** — this is the single biggest accelerant for downstream AI image generation (e.g. the future `adv-art` skill).

```js
create_scenes({
  items: [
    {
      id: 'classroom',
      name: '教室',
      tags: ['内景', '学校'],
      imagePrompt: 'Anime style empty Japanese classroom, afternoon sunlight through windows, chalk dust in the air, watercolor aesthetic',
      description: '二年级三班的教室。窗外能看到樱花树。',
      atmosphere: '下午阳光透过窗户，黑板擦灰飞舞。',
      chapters: ['CH01 转学第一天']
    },
    // ... more scenes — every one with imagePrompt
  ]
})
```

#### imagePrompt formula

```
[style] + [subject] + [mood / lighting] + [texture keywords]
```

- ✅ `Anime style school rooftop in light rain, gray overcast sky, wet concrete reflections, lonely figure with umbrella, watercolor aesthetic`
- ❌ `一个学校` — too short, no style keywords; AI image will be generic
- ❌ Long Chinese prose — overlaps with `description`, not well-tuned for image models
- ❌ Plot / action descriptions — `imagePrompt` describes the **stage**, not events

English keywords work best with current image-generation pipelines.

### Step 6: Bulk-create Chapter Skeletons (MCP)

Create the chapter file skeletons with frontmatter via `create_chapters`, then fill each script body with `edit_chapter`.

```js
create_chapters({
  items: [
    { filename: 'chapter_01', title: '转学第一天', plotSummary: '艾莉亚转入新学校...' },
    { filename: 'chapter_02', title: '屋顶的午后', plotSummary: '...' }
  ]
})
```

Then for each chapter, write the full script with `edit_chapter`:

```js
edit_chapter({
  filename: 'chapter_01',
  content: '---\nplotSummary: ...\n---\n\n【教室，午后，内景】\n\n（窗外樱花飘落。）\n\n@艾莉亚(smile)\n初次见面，请多关照！\n\n- 微笑回应\n- 沉默地点头\n'
})
```

### Step 7: Validate

```bash
adv check --root <dir>/adv
```

Or via MCP: call `adv_validate`. If there are unresolved character / scene refs introduced by the chapter scripts, use `--fix` to auto-generate stubs, then circle back and fill them in:

```bash
adv check --root <dir>/adv --fix
```

### Step 8: Guide Next Steps

Tell the user:

```bash
adv dev          # Preview the game
adv context      # Export context for future AI sessions
```

## ADV.JS Script Syntax Reference

```markdown
【Place，Time，Interior/Exterior】 # Scene header

（Narration text） # Parenthetical narration

> Inner monologue or atmospheric text # Blockquote narration

@CharacterName # Character dialog (next line)
Dialog text.

@CharacterName(emotion) # Character dialog with emotion
Dialog text.

- Choice text 1 # Player choice options
- Choice text 2
```

## Guidelines

- **Use MCP bulk tools for resource creation** — single-item tools (`create_character`, `create_scene`, `create_chapter`) are fine for one-off additions; the `_s` variants are atomic and faster for project bootstrap.
- **Always populate `imagePrompt` on scenes.** Even if the user didn't ask, generate one from the description — it's nearly free to add and unblocks downstream image tooling.
- Always write dialog that matches character personalities defined in `.character.md`.
- Include at least one branch point (choice) per chapter.
- Keep first chapters shorter (~40-60 lines) so the user can iterate quickly.
- Use Chinese for content if the user communicates in Chinese; otherwise use their language. `imagePrompt` itself stays in English regardless.
- Validate with `adv check` (or `adv_validate`) before declaring the project complete.
