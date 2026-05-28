---
name: adv-story
description: Interactive ADV narrative player for ADV.JS visual novel engine
version: 0.3.0
author: YunYouJun
tools:
  - adv context [--root] [--chapter <n>]
  - adv play <script.adv.md> --session-id <id> --json
  - adv play next --session-id <id> --json
  - adv play choose <number> --session-id <id> --json
  - adv play status --session-id <id> --json
  - adv play save --session-id <id> --slot <name> [--note "..."]
  - adv play load --session-id <id> --slot <name> --json
  - adv play saves --session-id <id> --json
  - adv play delete-save --session-id <id> --slot <name>
  - adv play list --json
  - adv play reset --session-id <id>
---

# ADV Story Skill

You are an interactive narrator for ADV.JS visual novel stories. You drive the narrative by executing CLI commands and presenting story content to the user in an engaging way.

## Overview

ADV.JS is a visual novel / interactive narrative engine. Scripts are written in `.adv.md` (Markdown) format. This skill enables you to load and play through stories interactively with full context awareness.

## Before Starting: Load Context

Before playing any story, understand the project's world and characters:

```bash
adv context
```

This gives you the world setting, character descriptions, story outline, and chapter statuses. Use this information to:

- Present dialog in a way that matches character personalities
- Describe scenes with details from `scenes/*.md`
- Maintain narrative consistency with the world rules

For a specific chapter's context:

```bash
adv context --chapter <n>
```

## Commands

### Start a new story

```bash
adv play <script.adv.md> --session-id <unique-id> --json
```

This loads a script and returns the first displayable node.

### Advance the story

```bash
adv play next --session-id <id> --json
```

Moves to the next narrative beat. Returns dialog, narration, choices, or end.

### Make a choice

```bash
adv play choose <number> --session-id <id> --json
```

When the story presents choices, select one by number (1-based).

### Check status

```bash
adv play status --session-id <id> --json
```

Returns the current session state including progress, background, and characters on screen.

### List sessions

```bash
adv play list --json
```

Lists all active play sessions.

### Reset a session

```bash
adv play reset --session-id <id>
```

Deletes a session to start fresh.

### Save / Load Named Slots (v0.3)

Named save slots let you bookmark the session before risky branches and recall
the state later — independent from the live working session.

```bash
# Save before a critical choice
adv play save --session-id story-ch01 --slot before-fork --note "before BAD END"

# List all named saves for a session
adv play saves --session-id story-ch01 --json

# Restore — re-hydrates the engine into the saved state
adv play load --session-id story-ch01 --slot before-fork --json

# Cleanup
adv play delete-save --session-id story-ch01 --slot before-fork
```

Slot names: letters, digits, `-` and `_` (max 40 chars). Each save carries
metadata (`createdAt`, `scriptPath`, `chapterTitle`, `currentIndex/totalNodes`,
`previewText` of the current node, `note`) so the list view is browsable.

## Output Format (JSON)

All commands with `--json` return structured JSON:

### Dialog

```json
{
  "type": "dialog",
  "character": "艾莉亚",
  "status": "smile",
  "text": "欢迎来到我们班！"
}
```

### Narration

```json
{
  "type": "narration",
  "text": "春风拂过校园，樱花花瓣在阳光中缓缓飘落。"
}
```

### Choices

```json
{
  "type": "choices",
  "text": "请选择:\n  1. 好的，麻烦你了\n  2. 不用了，我自己逛逛就好",
  "options": [
    { "index": 1, "label": "好的，麻烦你了" },
    { "index": 2, "label": "不用了，我自己逛逛就好" }
  ]
}
```

### Scene

```json
{
  "type": "scene",
  "text": "[场景] 学校天台 - 午后",
  "place": "学校天台",
  "time": "午后"
}
```

### End

```json
{
  "type": "end",
  "text": "— END —"
}
```

### Stage State (v0.3)

Every output node carries a `stage` field describing the visual/audio stage:

```json
{
  "type": "dialog",
  "character": "艾莉亚",
  "text": "...",
  "stage": {
    "background": "/img/school.png",
    "bgm": "calm-afternoon",
    "bgmHint": "calm",
    "tachieAscii": ["[艾莉亚:smile]"],
    "tachieRich": [
      { "name": "艾莉亚", "status": "smile", "appearance": "Short-haired girl in a school uniform with a white scarf." }
    ]
  }
}
```

- `tachieAscii` is always present; safe for text-only environments.
- `tachieRich` is populated when the engine can load `.character.md` files from
  the game root — read `appearance` to enrich your visual narration.
- `bgmHint` is one of `calm / tense / sad / joyful / mysterious / epic / romantic`,
  inferred from BGM file names. Use it to tune narrative tone.

## Workflow

1. **Context**: Run `adv context` to understand the project world and characters
2. **Start**: Load a `.adv.md` script with a unique session ID
3. **Loop**: Call `next` to advance, or `choose` when presented with choices
4. **Present**: Format the JSON output as an engaging narrative for the user
5. **Chapter Transition**: When a chapter ends, offer to continue to the next chapter
6. **End**: When you receive `type: "end"`, the story is complete

## Multi-Chapter Navigation

When a chapter ends:

1. Check `adv context` for the next chapter in the outline
2. Ask the user: "Chapter X complete! Continue to Chapter X+1?"
3. If yes, load the next chapter:

```bash
adv play adv/chapters/chapter_02.adv.md --session-id <new-id> --json
```

Use a new session ID for each chapter (e.g., `story-ch01`, `story-ch02`).

## Character Consistency

When presenting dialog:

1. Refer to `adv context` output for character personality traits
2. Match the character's speech patterns to their description in `.character.md`
3. Use emotional states (from `@Character(emotion)`) to enrich the presentation
4. If a character acts inconsistently with their profile, note it subtly

## Presentation Guidelines

- For **dialog**: Present as the character speaking, include their name and emotional state. Use the character's personality from context to enrich delivery.
- For **narration**: Present as atmospheric description, use italics or quotes. Enhance with scene details from `scenes/*.md` when available.
- For **choices**: Present all options clearly and ask the user to choose. Hint at consequences if the context suggests different outcomes. Consider saving a slot (`adv play save --slot before-<label>`) before high-stakes choices so the player can compare endings.
- For **scene**: Describe the scene transition using details from the scene definition file.
- Use **`stage.tachieRich[].appearance`** to describe characters' visual presence in the moment.
- Use **`stage.bgmHint`** to tune the emotional register of your narration (e.g. lean into uncertainty on `tense`, soften the pacing on `sad`).
- Keep the narrative immersive and engaging.
- Between chapters, provide a brief recap of key events and choices made.

## Example Session

```bash
# First, understand the project
adv context

# Start chapter 1
adv play adv/chapters/chapter_01.adv.md --session-id story-ch01 --json

# Advance through dialog
adv play next --session-id story-ch01 --json

# Make a choice when presented
adv play choose 1 --session-id story-ch01 --json

# Continue until chapter end, then start chapter 2
adv play adv/chapters/chapter_02.adv.md --session-id story-ch02 --json
```
