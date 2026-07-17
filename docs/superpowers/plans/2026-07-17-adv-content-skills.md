# ADV Content Skills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reusable ADV.JS source-adaptation and art-pipeline Skills plus a narrowly scoped Skill that fixes the contracts for `demo/hamster`.

**Architecture:** `adv-adapt` owns source-to-script traceability, `adv-art` owns visual asset planning and publishing manifests, and `adv-hamster-demo` composes those workflows with game-specific constants. Deterministic Node scripts validate manifests; generic COS credentials and API operations stay in the existing `tencent-cloud-cos` Skill.

**Tech Stack:** Markdown Skills, YAML UI metadata, Node.js ESM validation scripts, Vitest, ADV.JS Markdown source anchors.

## Global Constraints

- Create all project Skills under `skills/`.
- New `SKILL.md` frontmatter contains only `name` and `description`.
- Do not store COS credentials, upload tokens, generated source images, or unpublished assets in a Skill.
- Use `https://cos.advjs.yunle.fun/games/hamster/v1/` as the only public base URL for the hamster demo.
- Keep generic workflows out of `adv-hamster-demo`; it contains only composition, fixed decisions, and acceptance criteria.
- Validate every Skill with `quick_validate.py` and run focused Vitest tests before completion.

---

### Task 1: Lock the three-Skill catalog contract

**Files:**

- Create: `tests/unit/content-skills.test.ts`
- Modify: `skills/README.md`

**Interfaces:**

- Produces: repository-level assertions for required Skill files, modern frontmatter, UI metadata, and hamster-specific isolation.

- [ ] **Step 1: Write the failing catalog test**

Create a table for `adv-adapt`, `adv-art`, and `adv-hamster-demo`. For each entry, read `SKILL.md` and `agents/openai.yaml`, parse the first YAML fence, and assert that its keys are exactly `description` and `name`. Assert only `adv-hamster-demo` contains both `cos.advjs.yunle.fun` and `games/hamster/v1/`; assert `adv-adapt` and `adv-art` contain neither string.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm vitest run tests/unit/content-skills.test.ts`

Expected: FAIL because the three Skill directories do not exist.

- [ ] **Step 3: Update the repository Skill catalog**

Add the three Skills to the directory tree and capability table. Document that new Skills use `name`/`description` frontmatter plus `agents/openai.yaml`; versions remain documentation metadata rather than trigger metadata.

- [ ] **Step 4: Commit after the three Skills make this test pass**

```bash
git add tests/unit/content-skills.test.ts skills
git commit -m "feat(skills): add content pipeline contracts"
```

### Task 2: Implement `adv-adapt` with deterministic source coverage

**Files:**

- Create: `skills/adv-adapt/SKILL.md`
- Create: `skills/adv-adapt/agents/openai.yaml`
- Create: `skills/adv-adapt/references/adaptation-manifest.md`
- Create: `skills/adv-adapt/scripts/audit-coverage.mjs`
- Test: `tests/unit/content-skills.test.ts`

**Interfaces:**

- Consumes: an adaptation manifest path and a chapter directory.
- Produces: process exit code `0` with a JSON coverage summary, or exit code `1` with missing, duplicate, or unknown source-anchor diagnostics.

- [ ] **Step 1: Add failing audit tests**

Create temporary manifests and chapters with `<!-- source:work/section -->` markers. Assert the CLI passes at 100% coverage and fails for a required section with no marker, a marker used twice, and a marker absent from the manifest.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm vitest run tests/unit/content-skills.test.ts`

Expected: FAIL because `audit-coverage.mjs` does not exist.

- [ ] **Step 3: Implement the audit CLI**

Accept exactly `node audit-coverage.mjs <manifest.json> <chapters-dir>`. Recursively scan `.adv.md` files, recognize `source:<source-id>/<section-id>`, require each manifest section marked `required: true` exactly once, reject unknown markers, and emit sorted JSON fields `required`, `covered`, `coveragePercent`, `missing`, `duplicates`, and `unknown`.

- [ ] **Step 4: Write the Skill workflow and manifest reference**

Require source rights, explicit work order, stable section IDs, a full cast and scene inventory, an adaptation-mode decision, source anchors, `adv check`, `adv debug coverage`, and `adv-review`. Explain that the audit proves traceability rather than semantic fidelity.

- [ ] **Step 5: Run tests and Skill validation**

```bash
pnpm vitest run tests/unit/content-skills.test.ts
python3 /Users/yunyou/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/adv-adapt
```

Expected: PASS and `Skill is valid!`.

### Task 3: Implement `adv-art` with deterministic asset-manifest checks

**Files:**

- Create: `skills/adv-art/SKILL.md`
- Create: `skills/adv-art/agents/openai.yaml`
- Create: `skills/adv-art/references/asset-manifest.md`
- Create: `skills/adv-art/references/cos-publishing.md`
- Create: `skills/adv-art/scripts/audit-assets.mjs`
- Test: `tests/unit/content-skills.test.ts`

**Interfaces:**

- Consumes: an asset manifest JSON path.
- Produces: process exit code `0` and counts by asset kind, or exit code `1` with duplicate IDs, invalid URLs, unhashed object names, missing provenance, and incomplete required-expression diagnostics.

- [ ] **Step 1: Add failing manifest tests**

Use a valid manifest with one character expression and one background. Add negative cases for a URL outside `publicBaseUrl`, a filename without an 8–64 character lowercase hex hash, duplicate logical IDs, missing `license`, and a required character expression absent from assets.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm vitest run tests/unit/content-skills.test.ts`

Expected: FAIL because `audit-assets.mjs` does not exist.

- [ ] **Step 3: Implement the audit CLI**

Accept exactly `node audit-assets.mjs <manifest.json>`. Validate `publicBaseUrl`, `objectPrefix`, assets, SHA-256, dimensions, provenance, license, and the character-expression matrix. Require every URL to start with the base URL plus prefix and every object filename to contain the declared SHA-256 prefix.

- [ ] **Step 4: Write the art and COS workflow**

Cover art bible creation, image prompts, expression matrices, original generation, transparent export, WebP/AVIF decisions, manifest updates, long-lived immutable caching, short-lived manifest caching, public `GET`/`HEAD`, and STS/minimum-permission uploads. Delegate COS actions to `tencent-cloud-cos` rather than embedding SDK commands.

- [ ] **Step 5: Run tests and Skill validation**

```bash
pnpm vitest run tests/unit/content-skills.test.ts
python3 /Users/yunyou/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/adv-art
```

Expected: PASS and `Skill is valid!`.

### Task 4: Implement the `demo/hamster` composition Skill

**Files:**

- Create: `skills/adv-hamster-demo/SKILL.md`
- Create: `skills/adv-hamster-demo/agents/openai.yaml`
- Create: `skills/adv-hamster-demo/references/demo-contract.md`
- Modify: `docs/ai/skills/index.md`
- Modify: `docs/ai/skills/roadmap.md`
- Test: `tests/unit/content-skills.test.ts`

**Interfaces:**

- Consumes: the approved full-adaptation design and the two generic content Skills.
- Produces: one discoverable workflow containing only hamster source order, A+ rules, COS constants, filenames, licensing, and acceptance gates.

- [ ] **Step 1: Add failing scope assertions**

Assert the Skill names `demo/hamster`, both source slugs, `A+`, `games/hamster/v1/`, `adv-adapt`, `adv-art`, `adv-debug`, and `adv-review`. Assert it explicitly forbids credentials and `latest/`.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm vitest run tests/unit/content-skills.test.ts`

Expected: FAIL until the demo contract is complete.

- [ ] **Step 3: Write the scoped workflow and UI metadata**

Keep the `SKILL.md` as a concise router. Put the fixed source URLs, mode rules, COS layout, character-expression minimums, source coverage command, asset audit command, `adv check`, branch coverage, build, and E2E gates in `references/demo-contract.md`.

- [ ] **Step 4: Update public Skill documentation**

Add all three Skills to the docs catalog and mark `adv-adapt`/`adv-art` as reusable content-pipeline Skills while labeling `adv-hamster-demo` as an in-repository showcase workflow.

- [ ] **Step 5: Validate all Skills and run focused tests**

```bash
pnpm vitest run tests/unit/content-skills.test.ts
for skill in adv-adapt adv-art adv-hamster-demo; do
  python3 /Users/yunyou/.codex/skills/.system/skill-creator/scripts/quick_validate.py "skills/$skill"
done
```

Expected: all checks pass.

- [ ] **Step 6: Commit**

```bash
git add skills docs/ai/skills tests/unit/content-skills.test.ts
git commit -m "feat(skills): add ADV content workflows"
```
