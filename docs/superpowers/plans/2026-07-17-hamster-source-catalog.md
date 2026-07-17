# Hamster Source Catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the four-chapter thematic outline with a revision-locked, machine-auditable catalog of all 19 source sections, the complete visible cast, and reusable scenes for the two sequential hamster works.

**Architecture:** `demo/hamster/adv/adaptation.json` is the single structural ledger. Character and scene cards contain authoring detail and image prompts, while a focused Vitest contract prevents the source order, hashes, section count, card paths, and COS prefix from drifting.

**Tech Stack:** JSON, ADV.JS `.character.md` and scene Markdown, Vitest, the `adv-adapt` source-anchor convention.

## Global Constraints

- Lock source files to repository commit `4a09ad4b730518144bd3d4b72fb584e83003c335`.
- Record SHA-256 `f18d252fe769f3afaed50e5aeae891a70d899757cf9802d33cda736c56c40c5f` for `hamster.md`.
- Record SHA-256 `f60363782f9c22e72f63d4bbf481dd83eb1f9e7780460e8b63dee419ed900fc6` for `the-common-hamster.md`.
- Preserve source order: `hamster` first, `the-common-hamster` second.
- Catalog 6 required sections from 《仓鼠》 and 13 required sections from 《仓生》.
- Keep the public asset base at `https://cos.advjs.yunle.fun/` with object prefix `games/hamster/v1/`.
- Do not remove the currently playable four-chapter files until their replacements compile and pass runtime tests.

---

### Task 1: Add the source-catalog contract test

**Files:**

- Create: `tests/unit/hamster-adaptation-contract.test.ts`

**Interfaces:**

- Produces: assertions for immutable source identity, 19 unique section mappings, complete card paths, scene paths, and the fixed asset policy.

- [ ] **Step 1: Write the failing manifest assertions**

Read `demo/hamster/adv/adaptation.json`. Assert schema version `1`, adaptation mode `canonical-plus`, the exact two source IDs/revisions/hashes/orders, section counts `6` and `13`, and 19 unique chapter filenames. Assert every section is required.

- [ ] **Step 2: Write failing cast and scene assertions**

Require cards for `observer`, `reader`, `pet-hamster`, `wang-an`, `wang-an-father`, `doctor`, `wheelchair-girl`, `ba`, `deputy-chief`, `fat-sentry`, `thin-sentry`, `hamster-child`, `hamster-mayor`, `explorer-king`, `hamster-commander`, and `hamster-crowd`. Require every non-mentioned character and every scene to reference an existing card.

- [ ] **Step 3: Run the test and verify RED**

Run: `pnpm vitest run tests/unit/hamster-adaptation-contract.test.ts`

Expected: FAIL because `adv/adaptation.json` does not exist.

### Task 2: Create the revision-locked adaptation ledger

**Files:**

- Create: `demo/hamster/adv/adaptation.json`

**Interfaces:**

- Produces: 19 stable source keys and target chapter filenames consumed by the coverage audit and subsequent script-authoring plan.

- [ ] **Step 1: Add the two source records**

Use published URLs for attribution and commit-addressed raw URLs for fidelity review. Include revision, SHA-256, license, order, and original title.

- [ ] **Step 2: Map all source headings**

Map 《仓鼠》 to chapters `01`–`06` and 《仓生》 to `07`–`19`. Use lowercase source IDs and one target `.adv.md` filename per section. Keep forewords and postscripts required so “complete” retains authorial framing.

- [ ] **Step 3: Add cast, scene, and asset-policy records**

Classify principal, supporting, ensemble, creature, and mentioned historical characters. Record `needsTachie`, `scriptCard`, and first source section. Add reusable scene IDs and cards. Set the exact public base URL and object prefix.

### Task 3: Fill source-faithful character and scene cards

**Files:**

- Modify: `demo/hamster/adv/characters/observer.character.md`
- Modify: `demo/hamster/adv/characters/reader.character.md`
- Create: character cards named in Task 1
- Create: scene cards named by the adaptation ledger

**Interfaces:**

- Produces: authoring context for `adv-create`, `adv-review`, Studio, and the later `adv-art` expression matrix.

- [ ] **Step 1: Correct the two principal cards**

Describe the observer as playful, proud, technically capable, impulsive, and gradually vulnerable; describe the reader/assistant as quiet, bookish, dryly skeptical, compassionate, and fascinated by the stars. Give each an English image prompt and reciprocal relationship.

- [ ] **Step 2: Add speaking and visible supporting cards**

Give every card an exact source role, appearance, personality, background, concept, and speech style. Do not fabricate personal names absent from the source; keep role-based names such as `仓鼠副首领` and `轮椅姑娘`.

- [ ] **Step 3: Add scene cards**

Cover the summer simulated room, starfield room, simulated orbit, academy terminal, empty initialized Earth, hospital room/garden, newborn Earth, prehistoric grassland, hamster village, sunflower city, exploration space, solar-system frontier, and real workstation. Include a concise English `imagePrompt` for each.

- [ ] **Step 4: Run contract and existing demo tests**

```bash
pnpm vitest run \
  tests/unit/hamster-adaptation-contract.test.ts \
  tests/unit/hamster-demo-runtime.test.ts \
  tests/unit/content-skills.test.ts
```

Expected: PASS; the existing four-chapter runtime remains playable while the new catalog is prepared.

- [ ] **Step 5: Commit**

```bash
git add demo/hamster/adv tests/unit/hamster-adaptation-contract.test.ts docs/superpowers/plans/2026-07-17-hamster-source-catalog.md
git commit -m "feat(hamster): catalog complete source adaptation"
```
