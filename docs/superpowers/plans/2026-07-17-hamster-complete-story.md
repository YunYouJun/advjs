# Hamster Complete Story Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the four-chapter showcase outline with a source-traceable 19-chapter adaptation of 《仓鼠》 and 《仓生》, plus an interpretive A+ route unlocked only after the canonical ending.

**Architecture:** Every required source section maps to one `.adv.md` chapter and one unique `<!-- source:work/section -->` anchor. Canonical choices adjust presentation variables but always rejoin the locked source event order. The first chapter exposes the interpretive route only when browser-owned meta progression restores `canonicalCompleted`; interpretive endings use a duplicate-safe built-in array action.

**Tech Stack:** ADV Markdown, declarative Runtime conditions/actions, `@advjs/plugin-interactions`, Vitest, source coverage audit.

## Global Constraints

- Preserve the exact 19-section order in `adv/adaptation.json`.
- Cover every major event, reveal, relationship, and causal transition from the locked sources.
- Mark newly written interpretive material as non-canonical and never give it a source anchor.
- Do not let canonical choices skip or rewrite a source event.
- Keep all story logic declarative; executable JavaScript in chapter Markdown is forbidden.
- First completion sets `canonicalCompleted: true`; `storyMode` resets to `canonical` on every new game.
- Use `variables/push-unique` for persistent ending IDs so replaying an ending is idempotent.

---

### Task 1: Add duplicate-safe array unlocks

**Files:**

- Modify: `packages/core/src/runtime/registry.ts`
- Modify: `packages/core/test/runtime/actions.test.ts`
- Modify: `docs/guide/runtime/conditions-and-actions.md`

- [x] Write a failing Runtime test for `variables/push-unique` covering add, duplicate no-op, and JSON structural equality.
- [x] Run the focused test and verify RED.
- [x] Implement the minimal built-in action without changing `variables/push` semantics.
- [x] Document the action and run the focused test, ESLint, and typecheck.

### Task 2: Lock the complete-script contract

**Files:**

- Modify: `tests/unit/hamster-adaptation-contract.test.ts`
- Modify: `tests/unit/demo-project-layout.test.ts`
- Modify: `tests/unit/hamster-demo-runtime.test.ts`

- [x] Assert the chapter directory contains exactly the 19 manifest filenames.
- [x] Assert every required source anchor occurs exactly once and in manifest order.
- [x] Compile all 19 chapters and verify zero diagnostics.
- [x] Assert first-play canonical routing, canonical completion, restored A+ routing, and duplicate-safe interpretive ending unlocks.
- [x] Run the tests and verify RED against the existing four chapters.

### Task 3: Adapt the six sections of 《仓鼠》

**Files:**

- Replace: `demo/hamster/public/md/chapters/01-cage.adv.md` through `04-dim-stars.adv.md`
- Create: the six manifest-mapped `01-*.adv.md` through `06-*.adv.md` files

- [x] Write the route gate and `hamster/hamster-cage` chapter.
- [x] Adapt the three-day warning and simulated-world reveal.
- [x] Integrate `star-map/compare` with the solar-system/black-domain deduction.
- [x] Adapt world reset, the unnamed hamster handoff, the report, recurrence, and source postscript.
- [x] Compile all six chapters and audit their six source anchors.

### Task 4: Adapt the thirteen sections of 《仓生》

**Files:**

- Create: the thirteen manifest-mapped `07-*.adv.md` through `19-*.adv.md` files

- [x] Adapt the source preface, 42nd rollback, missing logout, and empty-world awakening.
- [x] Adapt the simulated-universe explanation and proposal to rebuild Earth.
- [x] Adapt Wang An's vignette and Earth initialization without omitting its ethical tension.
- [x] Adapt hamster-human fusion, first extinction, memory crystals, dinosaurs, Ba, and the village.
- [x] Adapt agriculture, the wheel, ironworking, divine monarchy, and accelerated modernity.
- [x] Integrate `civilization/initialize` without changing the canonical civilization outcome.
- [x] Adapt Explorer King's flight, encounter, stellar energy reveal, and permission loss.
- [x] Adapt the fleet confrontation, circular causality, stellar weapons, refusal, and workstation shutdown.
- [x] Set canonical completion at the source ending and preserve the source postscript separately.

### Task 5: Align config and prove both modes

**Files:**

- Modify: `demo/hamster/adv.config.ts`
- Modify: `demo/hamster/README.md`
- Modify: `demo/hamster/ASSETS.md`
- Modify: tests from Task 2

- [x] Configure the exact 19 chapters with stable source-section IDs and flow targets.
- [x] Keep current local placeholder art valid until the dedicated COS art phase replaces it.
- [x] Run source coverage audit and require 19/19 with no duplicate or unknown anchors.
- [x] Run Runtime route tests, project layout tests, `adv check`, typecheck, lint, and hamster build.
- [x] Commit the complete story as one content-focused Conventional Commit.
