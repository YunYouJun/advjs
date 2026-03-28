---
name: adv-debug
description: Debug and analyze ADV.JS project for branch coverage, dead paths, and consistency
version: 0.1.0
author: YunYouJun
tools:
  - adv check [--root]
  - adv context [--root] [--full]
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

For each chapter, examine the `.adv.md` files and identify:

- **Branch points**: Lines with `- Choice text` options
- **Number of choices** at each branch point
- **Branch depth**: How deeply nested branches go

Present as a summary table:

```
| Chapter | Branch Points | Total Choices | Estimated Paths |
|---------|--------------|---------------|-----------------|
| CH01    | 2            | 4             | 4               |
| CH02    | 1            | 2             | 2               |
| CH03    | 1            | 2             | 2               |
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

Present findings in a structured report:

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
- [ ] All `@CharacterName` references resolve to `.character.md` files
- [ ] All `【Place】` references resolve to `scenes/*.md` files
- [ ] All branches have content after each choice
- [ ] Character dialog matches personality descriptions
- [ ] Terminology matches glossary definitions
- [ ] Each chapter has at least one meaningful branch point
- [ ] Story transitions between chapters are smooth
- [ ] All ending paths (TRUE/NORMAL/BAD) are reachable

## Guidelines

- Be thorough but prioritize critical issues (dead paths, syntax errors) over style suggestions
- Present findings clearly with file paths and line references
- Offer concrete fix suggestions, not just problem descriptions
- Ask the user if they want you to fix the issues found
