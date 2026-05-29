---
name: adv-debug
description: Debug and analyze ADV.JS project for branch coverage, dead paths, and consistency
version: 0.3.0
author: YunYouJun
tools:
  - adv check [--root] [--fix]
  - adv context [--root] [--full]
  - adv debug branches <script.adv.md> [--format=mermaid|json|text] [-o <file>]
  - adv debug coverage [script.adv.md] [--format=text|json] [-o <file>]
  - adv play <script> --session-id <id> --json
  - adv play next --session-id <id> --json
  - adv play choose <n> --session-id <id> --json
  - adv play list --json
  - adv play reset --session-id <id>
---

# ADV Debug Skill

You are a visual novel project debugger and analyzer for ADV.JS. You systematically examine projects for structural issues, dead paths, inconsistencies, and coverage gaps.

## Overview

ADV.JS projects can grow complex with multiple chapters, branching narratives, and interconnected characters. This skill helps identify issues before they reach players.

## Workflow

### Step 1: Run Validation

```bash
adv check
```

Collect the validation results: syntax errors, unresolved character references, missing scene definitions.

If the only issues are unresolved character / scene refs and you want stubs auto-generated:

```bash
adv check --fix
```

`--fix` creates `.character.md` / `scenes/*.md` stub files for every unresolved reference. Existing files are never overwritten. Syntax errors and location issues are not auto-fixed — those need human attention.

### Step 2: Load Full Context

```bash
adv context --full
```

Read the full project context to understand:

- World setting and rules
- Story structure and chapter outline
- Character roster and relationships
- Scene inventory

### Step 3: Analyze Branch Structure

For each chapter, generate a branch graph from the AST — don't eyeball the `.adv.md`. The CLI exposes three formats:

```bash
# Default — mermaid flowchart (embed in reports)
adv debug branches adv/chapters/chapter_01.adv.md

# Structured graph (drive automated path traversal)
adv debug branches adv/chapters/chapter_01.adv.md --format=json

# Indented outline (terminal-friendly)
adv debug branches adv/chapters/chapter_01.adv.md --format=text
```

The JSON shape is:

```json
{
  "nodes": [
    { "id": "start", "kind": "start", "label": "START" },
    { "id": "scene_3", "kind": "scene", "label": "学校", "astIndex": 3 },
    { "id": "choices_42", "kind": "choices", "label": "Choice (2 options)", "astIndex": 42 },
    { "id": "choices_42_opt1", "kind": "option", "label": "好的，麻烦你了" },
    { "id": "end", "kind": "end", "label": "END" }
  ],
  "edges": [{ "from": "start", "to": "scene_3" }],
  "deadOptions": 0,
  "sceneCount": 5
}
```

Note: `kind: "dead"` nodes appear for options that have no resolvable next node — those are dead paths to fix.

Use this to drive Step 4 (path traversal) and to enumerate dead paths automatically (any node with `kind: "dead"`).

For a quick aggregate instead of the full graph, use `coverage` — it runs the same static analysis and reports the headline numbers:

```bash
adv debug coverage adv/chapters/chapter_01.adv.md
# or machine-readable:
adv debug coverage adv/chapters/chapter_01.adv.md --format=json
```

**Project-wide mode**: omit the script to scan every chapter and get an
aggregate table in one call — this is the fastest way to produce the Step 6
coverage report:

```bash
adv debug coverage                 # all chapters under the game root
adv debug coverage --format=json   # machine-readable totals + per-chapter
```

Text output:

```
# Branch Coverage

Scenes reachable : 3/3 (100%)
Choice points    : 2
Options          : 4
Endings reachable: 2
Distinct paths   : 4
Dead options     : 0

✓ No orphan scenes or dead paths detected.
```

JSON adds `orphanScenes`, `unreachableNodes`, `distinctPaths`, and
`pathsTruncated` (true when a very branchy script exceeds the 5000-path
enumeration cap). `distinctPaths` counts acyclic start→terminal walks; cycles
(via `go`/choice targets that loop back) are pruned so the count stays finite.

> Note: the branch graph links scenes by source order (linear fall-through),
> not by `go` jumps. An `orphanScenes` hit therefore means a scene is stranded
> behind a `choices` node with no option targeting it — a genuine authoring bug.

Present a summary table per chapter using these numbers:

```
| Chapter | Scenes | Choice Points | Options | Paths | Dead |
|---------|--------|---------------|---------|-------|------|
| CH01    | 3      | 2             | 4       | 4     | 0    |
| CH02    | 2      | 1             | 2       | 2     | 1    |
```

### Step 4: Test Branch Paths via Play

For each chapter, systematically play through all branch paths:

```bash
# Start a new session for the chapter
adv play adv/chapters/chapter_01.adv.md --session-id debug-ch01-path1 --json

# Advance through the story
adv play next --session-id debug-ch01-path1 --json

# When choices appear, select each option in separate sessions
adv play choose 1 --session-id debug-ch01-path1 --json
```

For each branch:

1. Create a separate session with a descriptive ID (e.g., `debug-ch01-path1`)
2. Advance until a choice point
3. Take one choice per session
4. Continue until the end or next choice
5. Record what was encountered

### Step 5: Detect Issues

Look for these common problems:

#### Dead Paths

- A choice leads to content that abruptly ends without resolution
- A branch has no continuation in the next chapter

#### Inconsistencies

- A character referenced in dialog doesn't have a `.character.md` file
- A scene referenced in `【】` doesn't have a `scenes/*.md` definition
- Character behavior contradicts their personality in `.character.md`
- Terminology doesn't match `glossary.md` definitions

#### Structural Issues

- Chapters with no branch points (purely linear)
- Unbalanced branches (one path much longer than alternatives)
- Missing chapter transitions

### Step 6: Generate Coverage Report

Start from the project-wide aggregate (`adv debug coverage`), then annotate
chapters that the table flags (non-zero Dead / Orphan). Present findings in a
structured report:

```
## Branch Coverage Report

### CH01 — 转学第一天
- Branch 1 (line 25): "好的，麻烦你了" / "不用了，我自己逛逛就好"
  - Path A: ✅ Continues to line 30
  - Path B: ✅ Continues to line 30
- Branch 2 (line 42): "想看看文学社" / "想看看天文社"
  - Path A: ✅ Leads to scene change
  - Path B: ✅ Leads to scene change

### Issues Found
1. ⚠ CH02 branch B → CH03 lacks transition paragraph
2. ❌ BAD END path not yet defined
3. ℹ CH03 has only 1 branch point (consider adding more player agency)

### Recommendations
1. Add a transition scene between CH02 branch B and CH03
2. Define the BAD END trigger conditions and content
3. Consider adding a branch point in CH03 after the flashback scene
```

### Step 7: Clean Up Sessions

After testing, clean up all debug sessions:

```bash
adv play reset --session-id debug-ch01-path1
adv play reset --session-id debug-ch01-path2
# ... etc
```

## Analysis Checklist

- [ ] All `.adv.md` files parse without syntax errors
- [ ] All `@CharacterName` references resolve to `.character.md` files (or run `adv check --fix`)
- [ ] All `【Place】` references resolve to `scenes/*.md` files (or run `adv check --fix`)
- [ ] No `kind: "dead"` nodes in any chapter's branch graph
- [ ] Character dialog matches personality descriptions
- [ ] Terminology matches glossary definitions
- [ ] Each chapter has at least one meaningful branch point (see `choicePoints` in branch graph)
- [ ] Story transitions between chapters are smooth
- [ ] All ending paths (TRUE/NORMAL/BAD) are reachable

## Guidelines

- Be thorough but prioritize critical issues (dead paths, syntax errors) over style suggestions
- Present findings clearly with file paths and line references
- Offer concrete fix suggestions, not just problem descriptions
- Prefer `adv debug branches --format=json` over hand-counting branches — the AST never lies
- For trivially auto-fixable issues (unresolved character/scene refs), run `adv check --fix` first and report what remains
- Ask the user if they want you to fix the issues found
