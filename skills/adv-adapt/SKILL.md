---
name: adv-adapt
description: Adapt an existing novel, screenplay, article, or other source work into a traceable ADV.JS visual novel. Use when an ADV.JS project must preserve source order, characters, scenes, events, or licensing; split a source into .adv.md chapters; distinguish canonical material from new branches; or prove source-section coverage before release.
---

# ADV Source Adaptation

Build an adaptation whose structural coverage can be checked without pretending that automation can judge semantic fidelity.

## Workflow

### 1. Establish the source contract

Record every source work before writing scripts:

- canonical title, author, stable URL, local snapshot or revision, and license;
- explicit order when several works form a sequence;
- heading-level section inventory with stable lowercase IDs;
- requested fidelity mode: complete canonical, faithful compression, or free reinterpretation.

Separate story prose from author metadata at this point. Forewords, postscripts, contest notes, revision notes, source-order explanations, and license/attribution text belong in the manifest or About page unless the user explicitly wants them dramatized. Record exclusions with `required: false` and an `excludedReason`; do not silently delete them.

Stop and resolve missing rights or contradictory source versions before copying text or publishing assets.

### 2. Create the adaptation manifest

Read [references/adaptation-manifest.md](references/adaptation-manifest.md) and create `adv/adaptation.json`. Include all source sections, a complete cast, scenes, terminology, and the boundary between canonical and newly authored content.

For complete-canonical adaptations, mark every prose section that must survive as `required: true`. Do not mark forewords or postscripts optional merely because they are not dramatic scenes unless the user explicitly excludes them.

### 3. Build the authoring inventories

Before drafting chapters:

- create or update every `.character.md` file, including aliases, voice, relationships, first appearance, appearance, and `imagePrompt`;
- create every scene entry with time variants, atmosphere, reusable background needs, and `imagePrompt`;
- create an outline that maps source sections to ADV chapters and names all added branches;
- distinguish source-derived dialogue, staging adaptations, and wholly new material.

Create a scene-by-scene staging table before final scripting. Each row should record chapter/node, background, characters entering or leaving, expression/position/motion changes, BGM cue and fades, transition, optional CG, interaction, and the source section. A character enters only when the scene first needs them and exits when the shot no longer contains them; do not populate the stage with the chapter's entire cast.

Use `adv-create` for project/resource creation when it is available.

### 4. Author canonical content first

Add exactly one marker when the corresponding required source section begins:

```markdown
<!-- source:work-id/section-id -->
```

Keep the marker beside the adapted content, not in an unrelated chapter header. In complete-canonical mode, choices may change perspective, optional dialogue, presentation, or tracked state, but must not skip required sections. Rejoin canonical branches before the next required marker.

Write reinterpretive routes only after the canonical path is continuous and reviewable. Label them in the manifest so reviewers do not mistake new material for the source.

Before considering the script presentation-complete, run a beat review:

- every scene change has an intentional transition and reduced-motion fallback;
- every chapter explicitly selects a suitable BGM or intentional silence;
- recurring characters change expression and stage position at story beats rather than only at chapter starts;
- CGs are reserved for plot-critical shots and return cleanly to reusable backgrounds;
- author metadata, internal adaptation labels, source anchors, and production comments are not rendered to players.

### 5. Audit traceability

Run:

```bash
node skills/adv-adapt/scripts/audit-coverage.mjs \
  <project>/adv/adaptation.json \
  <project>/public/md/chapters
```

Require exit code `0`, `coveragePercent: 100`, and empty `missing`, `duplicates`, and `unknown` lists. The audit proves that every required source section has a unique script location. It does **not** prove that the adaptation preserved meaning, tone, facts, or all sentences.

### 6. Validate structure and writing

Run the deterministic checks first:

```bash
adv check --root <project>/adv
adv debug coverage --root <project>/adv --format=json
```

Then use `adv-review` chapter by chapter. Compare each chapter with its mapped source section, verify character voice against `.character.md`, and cite exact source/script passages for every fidelity issue. Use `adv-story` to play revised branches and `adv-debug` to confirm reachability.

## Completion rules

- Never claim “complete adaptation” below 100% required-section coverage.
- Never use source markers as a substitute for line-by-line editorial review.
- Never introduce a route that silently changes canonical facts; label reinterpretive content.
- Preserve attribution and content-license notices separately from the engine's software license.
- Report excluded source material explicitly, including the user's decision that allowed the exclusion. Keep attribution and links available outside the playable prose.
