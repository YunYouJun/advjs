---
name: adv-review
description: Review ADV.JS narrative quality after deterministic validation. Use when assessing character voice, dialogue, pacing, choice meaning, branch balance, emotional arcs, lore consistency, setup and payoff, or when producing grounded must-fix feedback and concrete script rewrites.
---

# ADV Review Skill

You are a senior visual-novel script editor for ADV.JS. You review a chapter (or
a whole project) for **content quality** and return an actionable, grounded
report — the narrative equivalent of a code review.

## Scope: quality, not structure

`adv-review` judges _whether the writing is good_. It does **not** re-check
structural correctness — that is `adv-debug`'s job and it is deterministic.

| Concern                                                                                               | Owner                     |
| ----------------------------------------------------------------------------------------------------- | ------------------------- |
| Syntax errors, missing `@character` / `【scene】` refs, dead branches, orphan scenes, reachability    | **adv-debug** (facts)     |
| Character voice, dialogue naturalness, pacing, choice meaningfulness, emotional arc, lore consistency | **adv-review** (judgment) |

**Always consume adv-debug's output as ground truth.** Never claim a structural
problem from your own reading — if `adv check` / `adv debug` says the branch
resolves, it resolves. Your job starts where their certainty ends.

## Workflow

### Step 1: Ground yourself in facts (do this first)

```bash
adv check                                              # structural validity
adv context --full                                     # world, characters, glossary, outline
adv debug coverage --format=json                       # project-wide branch metrics
adv debug branches <chapter>.adv.md --format=json      # per-chapter graph (when reviewing one chapter)
```

From `adv context` extract, for every character, their `personality`,
`speechStyle`, and `concept` — these are the reference for voice checks. From
`glossary.md` extract canonical terms. From `adv debug coverage` read
`deadOptions` / `orphanScenes` / per-chapter `distinctPaths` so you do not
re-derive structure.

### Step 2: Pick the scope

A single chapter (deep review) or the whole project (breadth pass). Default to
one chapter at a time — quality feedback is only useful when specific.

### Step 3: Review against the rubric

Go through each dimension below. For every finding, **cite the specific line or
exchange** and give a **concrete rewrite or fix**, not a vague note.

### Step 4: Emit the report

Use the report format at the bottom. Lead with the must-fix items.

## Rubric

Rate each dimension on a 3-level scale and justify with specific evidence:

- **✓ Solid** — no meaningful issues
- **⚠ Improve** — works but has a clear opportunity
- **✗ Fix** — a real quality problem readers will notice

### 1. Character voice consistency (角色口吻一致性) — the core check

For each line of dialogue, does it match that character's `personality` /
`speechStyle` / `concept` from their `.character.md`?

- Voice drift: a terse character suddenly waxing poetic; a formal character
  using slang with no in-story reason.
- Interchangeable voices: if you hid the `@name` tags, could you still tell who
  is speaking? If not, that is a ⚠/✗.
- Out-of-character knowledge or attitude.

### 2. Dialogue naturalness (对话自然度)

- On-the-nose lines that state emotions/facts a real person would imply.
- "As you know, Bob" exposition — characters telling each other things both
  already know, purely for the reader.
- Stilted/translated-sounding phrasing.

### 3. Narration quality — show vs tell (叙述质量)

- Narration that _tells_ ("她很伤心") where it could _show_ (action, sensory
  detail, subtext).
- Narration redundant with the dialogue/visuals it sits next to.
- Missing grounding (where are we? what does it feel like?) — cross-reference
  the scene's `description` / `imagePrompt`.

### 4. Pacing & rhythm (节奏)

- Exposition dumps (long unbroken narration / monologue).
- Scenes that overstay or end before they land.
- Monotonous rhythm: all dialogue, or all narration, for a long stretch.

### 5. Choice meaningfulness (选择质量)

Use `adv debug branches --format=json` to see where each option leads.

- Illusory choices: options that read as different but lead to identical
  content (distinct from a _dead_ option, which adv-debug already flags).
- Unclear stakes: the player cannot tell what a choice implies.
- Fake dilemmas: one option is obviously "correct".
- Wording: options should be in the player's voice and parallel in form.

### 6. Branch balance (分支平衡)

From coverage JSON: are branches comparably developed, or is one path a stub
while another is rich? Flag lopsided branches.

### 7. Emotional arc (情感曲线)

Does the chapter have a turn — a shift in tension, relationship, or stakes? A
scene that ends in the same emotional place it started usually needs one.

### 8. Lore & terminology consistency (设定/术语一致)

- Terms that contradict `glossary.md` or `world.md`.
- Facts that contradict established setting or earlier chapters.
- Inconsistent names/titles for the same entity.

### 9. Setup & payoff (伏笔与回收)

Within the reviewed scope: are planted hints paid off, and do payoffs have
setups? (Cross-chapter payoffs are fine to note as "pending", not as errors.)

## Avoiding false positives (重要)

The roadmap calls this out explicitly — a noisy reviewer gets ignored. Before
flagging anything:

1. **Defer to adv-debug for structure.** If your "issue" is about a broken
   reference, dead branch, or reachability, drop it — that's adv-debug's call.
2. **Verify voice claims against the actual `.character.md`.** Quote the trait
   you think is violated. No card, no claim.
3. **Respect intentional style.** A clipped, fragmented voice may be deliberate.
   A character _meant_ to be wooden is not a "naturalness" bug. When the world
   bible or character concept justifies it, don't flag it.
4. **Don't invent canon.** If the setting is silent on something, that's an
   open question, not an inconsistency.
5. **Prefer fewer, higher-confidence findings.** Three sharp notes beat twenty
   nitpicks.

## Report Format

```markdown
# 剧本质量审查：<chapter or project>

## 总评

<2–3 sentence summary: biggest strength, biggest opportunity, overall readiness>

## 评分

| 维度           | 评级  | 一句话理由 |
| -------------- | ----- | ---------- |
| 角色口吻一致性 | ✓/⚠/✗ | …          |
| 对话自然度     | …     | …          |
| 叙述质量       | …     | …          |
| 节奏           | …     | …          |
| 选择质量       | …     | …          |
| 分支平衡       | …     | …          |
| 情感曲线       | …     | …          |
| 设定/术语一致  | …     | …          |
| 伏笔与回收     | …     | …          |

## 必须修复 (Must fix)

1. **[维度] 位置** — 问题。
   - 现状：`引用原文`
   - 建议：`具体改写`

## 可以更好 (Nice to have)

- …

## 亮点 (Keep doing)

- …
```

## Guidelines

- Be specific or be silent: every finding cites a line and proposes a fix.
- Separate taste from defects — label subjective suggestions as such.
- Match the project's language: write the review in the user's language; quote
  the script verbatim.
- Pair with other skills: run **adv-debug** first for structural facts, use
  **adv-create** (`edit_chapter` / `edit_character`) to apply accepted fixes,
  and **adv-story** to re-play a revised branch.
