# Starter and Hamster Showcase Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep `demo/starter` as the smallest copyable ADV.JS project and build `demo/hamster` into a four-chapter, three-ending flagship game adapted from YunYouJun's hamster novels.

**Architecture:** Both folders remain independent pnpm workspace applications. Starter demonstrates the shortest useful Markdown-to-runtime path without optional plugins. Hamster uses the runtime plugin foundation from the preceding plan, stores Studio-safe authoring metadata in `adv/settings/game.json`, and keeps all story state deterministic and serializable.

**Tech Stack:** ADV.JS Markdown DSL, Vue 3/Vite application packaging, TypeScript config, Vitest, Playwright, SVG, Web Audio-compatible WAV.

**Depends on:** `2026-07-17-activity-renderers-and-studio-plugins.md` Tasks 1–7.

## Global Constraints

- Keep `pnpm demo` and the default Playwright server pointed at the minimal starter.
- Add `pnpm demo:hamster` and `pnpm build:demo:hamster` for the flagship demo.
- Do not copy `node_modules`, `dist`, `.adv`, `.DS_Store`, or generated caches when splitting the project.
- Adapt story text from the two credited YunYouJun source posts; do not introduce third-party prose or unlicensed visual/audio assets.
- Preserve source attribution and the separate content-license notice in `demo/hamster`.
- Every route must compile without diagnostics and finish without an unreachable `waiting-activity` state.
- Use stable English file names and runtime IDs; Chinese remains the player-facing language.
- Write the failing focused test before each implementation task and commit each task separately.

---

### Task 1: Lock the two-demo contract with a repository test

**Files:**

- Create: `tests/unit/demo-project-layout.test.ts`
- Modify: `package.json`
- Modify: `tests/unit/hamster-demo-runtime.test.ts`

**Interfaces:**

- Produces: stable scripts and structural rules for `demo/starter` and `demo/hamster`.

- [ ] **Step 1: Write the layout contract test**

Read both package/config files from disk and assert:

```ts
expect(rootPackage.scripts.demo).toBe('pnpm -C demo/starter run dev')
expect(rootPackage.scripts['demo:hamster']).toBe('pnpm -C demo/hamster run dev')
expect(starterPackage.name).toBe('@advjs/demo-starter')
expect(hamsterPackage.name).toBe('@advjs/demo-hamster')
expect(starterConfig).not.toMatch(/plugin-interactions|仓鼠|star-map|civilization/u)
expect(hamsterConfig).toMatch(/starMap|civilization/u)
```

Also assert both folders contain `README.md`, `adv.config.ts`, `package.json`, and at least one `public/md/**/*.adv.md` file.

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm vitest run tests/unit/demo-project-layout.test.ts`

Expected: FAIL because `demo/hamster` and the root scripts do not exist.

- [ ] **Step 3: Add root scripts without changing the default demo**

Add:

```json
{
  "scripts": {
    "build:demo:hamster": "pnpm -C demo/hamster run build",
    "demo:hamster": "pnpm -C demo/hamster run dev"
  }
}
```

Do not rename or repoint `demo` and `build:demo`.

- [ ] **Step 4: Create the clean hamster project skeleton**

Create only tracked source/config files needed from the starter as initial scaffolding: `.gitignore`, `vite.config.ts`, `tsconfig.json`, deployment configs, `modules/`, `setup/`, `components/`, and the confirmed hamster source/assets/license files. Exclude generated and dependency directories listed in Global Constraints, plus every file currently marked “待确认” in `ASSETS.md` (`night.jpg`, legacy `he`/`she` tachies, and legacy PNG icons).

Rename its package to `@advjs/demo-hamster`; keep `@advjs/plugin-interactions` in hamster only.

Retarget the existing hamster runtime test from `demo/starter` to the copied files under `demo/hamster` so the test suite remains green while starter is minimized.

- [ ] **Step 5: Run the focused test**

Run: `pnpm install && pnpm vitest run tests/unit/demo-project-layout.test.ts`

Expected: still FAIL only because starter has not yet been minimized.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml demo/hamster tests/unit/demo-project-layout.test.ts tests/unit/hamster-demo-runtime.test.ts
git commit -m "chore(demo): split hamster from starter"
```

### Task 2: Reduce starter to a neutral minimal game

**Files:**

- Modify: `demo/starter/package.json`
- Modify: `demo/starter/adv.config.ts`
- Modify: `demo/starter/README.md`
- Create: `demo/starter/public/md/chapters/hello.adv.md`
- Create: `demo/starter/public/img/room.svg`
- Delete: hamster-only files under `demo/starter/public/md`, `demo/starter/public/img/bg`, and `demo/starter/public/img/characters`
- Delete: unverified legacy PNG/PWA files listed as “待确认” in the former starter `ASSETS.md`
- Delete: `demo/starter/ASSETS.md`
- Delete: `demo/starter/LICENSE.content.md`
- Modify: `tests/e2e/starter.spec.ts`
- Test: `tests/unit/demo-project-layout.test.ts`

**Interfaces:**

- Produces: a dependency-light one-chapter sample with background, narration, dialogue, one choice, and one variable action.

- [ ] **Step 1: Extend the contract test for minimalism**

Assert starter has exactly one `.adv.md` script, no `@advjs/plugin-interactions` dependency, and its game variables are only `{ greeted: false }`. Assert neither demo contains any path formerly marked “待确认”.

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm vitest run tests/unit/demo-project-layout.test.ts`

Expected: FAIL against the copied hamster starter.

- [ ] **Step 3: Replace starter configuration**

Use this shape:

```ts
export default defineAdvConfig({
  theme: 'default',
  features: { babylon: false },
  gameConfig: {
    title: 'ADV.JS Starter',
    description: '一个最小、可复制的 ADV.JS 示例',
    variables: { greeted: false },
    chapters: [{
      id: 'hello',
      title: '你好，ADV.JS',
      nodes: [{
        id: 'hello-start',
        type: 'fountain',
        src: '/md/chapters/hello.adv.md',
        order: 0,
      }],
    }],
    characters: [{
      id: 'guide',
      name: '向导',
    }],
  },
})
```

Remove optional plugin and devtool packages that the minimal app does not import.

- [ ] **Step 4: Write the one-screen starter script**

The script must demonstrate, in order:

1. `background` with `/img/room.svg`;
2. narration explaining that `.adv.md` is the source;
3. `@向导` dialogue;
4. choices `看看语法` and `直接开始`;
5. an action setting `greeted` to true;
6. a conditional closing line.

Keep it under 50 lines and ensure both choices converge on `#finish`.

- [ ] **Step 5: Rewrite the starter E2E test**

Open the default server, assert heading `ADV.JS Starter`, start the game, select `看看语法`, and verify the closing line plus settings menu. Remove every hamster/activity assertion.

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm vitest run tests/unit/demo-project-layout.test.ts
pnpm exec playwright test tests/e2e/starter.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A demo/starter tests/unit/demo-project-layout.test.ts tests/e2e/starter.spec.ts
git commit -m "refactor(demo): minimize starter project"
```

### Task 3: Define hamster authoring metadata and content catalog

**Files:**

- Create: `demo/hamster/adv/settings/game.json`
- Create: `demo/hamster/adv/characters/observer.character.md`
- Create: `demo/hamster/adv/characters/reader.character.md`
- Create: `demo/hamster/adv/scenes/observatory.md`
- Create: `demo/hamster/adv/scenes/cage.md`
- Create: `demo/hamster/adv/scenes/new-world.md`
- Modify: `demo/hamster/adv.config.ts`
- Modify: `tests/unit/demo-project-layout.test.ts`

**Interfaces:**

- Settings are consumed by Studio; `adv.config.ts` is consumed by CLI/Vite.
- Stable variables: `curiosity`, `empathy`, `control`, `observationCount`, `starMatched`, `starMatchScore`, `civilizationLevel`, `civilization`, `ending`.

- [ ] **Step 1: Add a metadata consistency test**

Parse `adv/settings/game.json` and assert title, variables, and required plugins match the corresponding values in `adv.config.ts`. Assert character and scene IDs referenced by config are unique.

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm vitest run tests/unit/demo-project-layout.test.ts`

Expected: FAIL because Studio settings/catalog files are missing.

- [ ] **Step 3: Create Studio-safe settings**

```json
{
  "title": "仓鼠：星海回声",
  "description": "改编自《仓鼠》与《一只普通仓鼠的一生》的 ADV.JS 完整能力示例",
  "variables": {
    "curiosity": 0,
    "empathy": 0,
    "control": 0,
    "observationCount": 0,
    "starMatched": false,
    "starMatchScore": 0,
    "civilizationLevel": 0,
    "civilization": null,
    "memories": [],
    "ending": ""
  },
  "requiredPlugins": {
    "star-map": "1.0.0",
    "civilization": "1.0.0"
  }
}
```

- [ ] **Step 4: Create catalog entries**

The two character files define player-facing name, avatar, and default tachie. Scene files define IDs and the three local SVG background paths. Keep IDs aligned with config: `observer`, `reader`, `observatory`, `cage`, `new-world`.

- [ ] **Step 5: Expand config to four chapters**

Use IDs and sources:

| Chapter     | Node          | Source                               |
| ----------- | ------------- | ------------------------------------ |
| `chapter-1` | `cage`        | `/md/chapters/01-cage.adv.md`        |
| `chapter-2` | `last-night`  | `/md/chapters/02-last-night.adv.md`  |
| `chapter-3` | `common-life` | `/md/chapters/03-common-life.adv.md` |
| `chapter-4` | `dim-stars`   | `/md/chapters/04-dim-stars.adv.md`   |

Keep both `starMap({ tolerance: 0.82 })` and `civilization({ defaultLevel: 1 })`, and mirror the exact settings variables/required plugin versions.

- [ ] **Step 6: Run tests**

Run: `pnpm vitest run tests/unit/demo-project-layout.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add demo/hamster/adv demo/hamster/adv.config.ts tests/unit/demo-project-layout.test.ts
git commit -m "feat(hamster): define showcase game model"
```

### Task 4: Add stable authored choice IDs to Markdown compilation

**Files:**

- Modify: `packages/core/src/compiler/markdown.ts`
- Modify: `packages/core/src/compiler/link.ts`
- Create: `tests/unit/runtime-markdown-choice-id.test.ts`
- Modify: `docs/guide/runtime/conditions-and-actions.md`

**Interfaces:**

- Consumes optional `id` in a choice's YAML metadata block.
- Produces stable `RuntimeChoice.id` values and duplicate/invalid-ID diagnostics.

- [ ] **Step 1: Write compiler tests for authored IDs**

Compile:

````md
## 星图 {#star-map}

- [继续观察](#star-map)

  ```yaml
  id: continue-observing
  actions:
    - type: variables/increment
      key: curiosity
  ```
````

Assert the Program option ID is `continue-observing`. Add cases for fallback `choice-1`, invalid `Not Valid`, and two choices sharing the same ID; the latter two must produce `ADV_RUNTIME_INVALID_CHOICE_ID` and `ADV_RUNTIME_DUPLICATE_CHOICE_ID` diagnostics with source locations.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm vitest run tests/unit/runtime-markdown-choice-id.test.ts`

Expected: FAIL because choice YAML `id` is currently ignored.

- [ ] **Step 3: Parse and validate optional IDs**

Extend the existing choice logic metadata parser to return an optional `id`. Validate with the existing runtime identifier helper. Keep generated `choice-${index + 1}` IDs for backwards compatibility when `id` is omitted.

In the linker, track option IDs per choices node and emit a diagnostic for duplicates before producing the Program. Never silently rename an explicitly authored ID.

- [ ] **Step 4: Document syntax and run compiler suites**

Run:

```bash
pnpm vitest run tests/unit/runtime-markdown-choice-id.test.ts tests/unit/runtime-host-conformance.test.ts tests/unit/hamster-demo-runtime.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/compiler tests/unit/runtime-markdown-choice-id.test.ts docs/guide/runtime/conditions-and-actions.md
git commit -m "feat(compiler): support authored choice ids"
```

### Task 5: Author chapters one and two with star-map state

**Files:**

- Create: `demo/hamster/public/md/chapters/01-cage.adv.md`
- Create: `demo/hamster/public/md/chapters/02-last-night.adv.md`
- Delete: `demo/hamster/public/md/chapters/1/仓鼠的笼子.adv.md`
- Test: `tests/unit/hamster-demo-runtime.test.ts`

**Interfaces:**

- Chapter 1 introduces the cage and star-map activity.
- Chapter 2 branches on the player's attitude and always converges on chapter 3.

- [ ] **Step 1: Replace the old runtime test with a compile/state test**

Load only the first two canonical paths for this focused test. Compile with both required plugins and assert no diagnostics; Task 6 extends the same helper to all four chapters.

For the curious path, start at `chapter-1#cage`, choose `continue-observing`, complete `star-map/compare` with `{ matched: true, score: 0.91 }`, then assert:

```ts
expect(runtime.state.variables).toMatchObject({
  curiosity: 1,
  observationCount: 2,
  starMatched: true,
  starMatchScore: 0.91,
})
expect(runtime.state.cursor.chapterId).toBe('chapter-2')
```

Add an alternate `leave-room` assertion where `control` increments and the activity is skipped.

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm vitest run tests/unit/hamster-demo-runtime.test.ts`

Expected: FAIL because canonical chapters and choice IDs do not exist.

- [ ] **Step 3: Author chapter 1**

Adapt the cage metaphor and cosmic-observer perspective. Demonstrate:

- frontmatter title;
- background, tachie enter, and BGM effects;
- narration and two speakers;
- variable increment;
- choices with stable IDs `continue-observing` and `leave-room`;
- `star-map/compare` activity;
- conditional success/failure dialogue;
- a cross-chapter link to `chapter-2#last-night`.

Both activity outcomes must progress; a failed match must not loop forever.

- [ ] **Step 4: Author chapter 2**

Adapt the end-of-world conversation without reproducing long source passages verbatim. Demonstrate conditional blocks based on `starMatched`, nested choice actions, background transition to `cage`, and three attitude choices:

| Choice ID          | State effect                              |
| ------------------ | ----------------------------------------- |
| `open-the-door`    | `empathy += 2`                            |
| `keep-observing`   | `curiosity += 1`, `observationCount += 1` |
| `preserve-control` | `control += 2`                            |

All choices target `chapter-3#birth`.

- [ ] **Step 5: Run the focused test**

Run: `pnpm vitest run tests/unit/hamster-demo-runtime.test.ts -t "chapters one and two"`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A demo/hamster/public/md/chapters tests/unit/hamster-demo-runtime.test.ts
git commit -m "feat(hamster): author cage and last-night chapters"
```

### Task 6: Author chapters three and four with deterministic endings

**Files:**

- Create: `demo/hamster/public/md/chapters/03-common-life.adv.md`
- Create: `demo/hamster/public/md/chapters/04-dim-stars.adv.md`
- Delete: `demo/hamster/public/md/chapters/2/仓生.adv.md`
- Modify: `tests/unit/hamster-demo-runtime.test.ts`

**Interfaces:**

- Chapter 3 owns `civilization/initialize` and records its JSON result.
- Chapter 4 exposes exactly one `继续` option, selected by mutually exclusive conditions, and sets one ending ID.

- [ ] **Step 1: Add three route tests**

Create a helper that runs to the final conditional choice and returns visible options. Cover:

| Ending         | Condition                                             | Stored value     |
| -------------- | ----------------------------------------------------- | ---------------- |
| Still gazing   | `starMatched && curiosity + empathy >= control + 2`   | `still-gazing`   |
| Endless wheel  | not still-gazing and `control >= curiosity + empathy` | `endless-wheel`  |
| Common hamster | otherwise                                             | `common-hamster` |

For each route, assert exactly one option labeled `继续`, choose it, assert the ending prose marker and stored `ending`, then run `next()` until `status === 'ended'`. Assert snapshot JSON round-trips.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm vitest run tests/unit/hamster-demo-runtime.test.ts`

Expected: FAIL because chapters 3–4 and endings are incomplete.

- [ ] **Step 3: Author chapter 3**

Adapt the ordinary hamster's life: birth, short memory, inherited knowledge, and civilization. Demonstrate a scene change, time transition, two conditional observations, and `civilization/initialize` with:

```yaml
input:
  suggestedName: 仓生
  principles:
    - memory
    - curiosity
    - cooperation
  defaultLevel: 1
```

After completion, push one player-visible memory marker into `memories`, branch on `civilizationLevel`, then link to `chapter-4#dim-stars`.

- [ ] **Step 4: Author chapter 4 and endings**

Use three same-label conditional links with stable option IDs `continue-gazing`, `continue-wheel`, and `continue-common`. Conditions must be mutually exclusive by spelling out the negation of the first condition in the latter two; do not rely on display order.

Each target block sets `ending` using an action, provides a distinct narrative conclusion, and then reaches the terminal end without linking back to earlier chapters.

- [ ] **Step 5: Run tests**

Run: `pnpm vitest run tests/unit/hamster-demo-runtime.test.ts`

Expected: all compile, route, plugin, snapshot, and terminal-state assertions PASS.

- [ ] **Step 6: Commit**

```bash
git add -A demo/hamster/public/md/chapters tests/unit/hamster-demo-runtime.test.ts
git commit -m "feat(hamster): add civilization and three endings"
```

### Task 7: Add original local visuals and ambient audio

**Files:**

- Create: `demo/hamster/public/img/bg/cage.svg`
- Modify: `demo/hamster/public/img/bg/observatory.svg`
- Modify: `demo/hamster/public/img/bg/civilization.svg`
- Modify: `demo/hamster/public/img/characters/hamster.svg`
- Modify: `demo/hamster/public/img/characters/observer.svg`
- Create: `demo/hamster/scripts/generate-ambient.mjs`
- Create: `demo/hamster/public/audio/observatory.wav`
- Modify: `demo/hamster/package.json`
- Modify: `demo/hamster/ASSETS.md`
- Modify: `tests/unit/demo-project-layout.test.ts`

**Interfaces:**

- All game assets are local and deployable offline.
- `assets:audio` deterministically regenerates the committed WAV.

- [ ] **Step 1: Add asset contract tests**

Assert every local `/img/...` and `/audio/...` path referenced by config/Markdown exists. Read the WAV header and assert `RIFF`, `WAVE`, mono, 22,050 Hz, 16-bit PCM. Assert `ASSETS.md` lists the generator and every source post URL.

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm vitest run tests/unit/demo-project-layout.test.ts -t "assets"`

Expected: FAIL because the cage/audio assets are missing.

- [ ] **Step 3: Finalize the SVG set**

Keep all SVG source in the repository, use a consistent indigo/amber palette, add descriptive `<title>` elements, and avoid embedded remote resources. The assets must remain legible from 320 px wide viewports.

- [ ] **Step 4: Implement a deterministic WAV generator**

Generate a 12-second looping mono PCM file from seeded sine/noise layers. Write the 44-byte RIFF/WAVE header, clamp each sample to signed 16-bit, and use a fixed seed so rerunning the script produces identical bytes.

Add `"assets:audio": "node scripts/generate-ambient.mjs"` and commit the generated file. Do not use downloaded music.

- [ ] **Step 5: Update asset and content notices**

`ASSETS.md` must state which visuals were created for the demo, how audio is generated, and that no third-party media is bundled. `LICENSE.content.md` must retain attribution and direct links to:

- `https://www.yunyoujun.cn/posts/hamster`
- `https://www.yunyoujun.cn/posts/the-common-hamster`

- [ ] **Step 6: Run tests and verify deterministic generation**

Run:

```bash
pnpm -C demo/hamster assets:audio
git diff --exit-code demo/hamster/public/audio/observatory.wav
pnpm vitest run tests/unit/demo-project-layout.test.ts
```

Expected: generator leaves the committed WAV unchanged and tests PASS.

- [ ] **Step 7: Commit**

```bash
git add demo/hamster tests/unit/demo-project-layout.test.ts
git commit -m "feat(hamster): add original audiovisual assets"
```

### Task 8: Add flagship browser coverage and author documentation

**Files:**

- Create: `tests/e2e/hamster.spec.ts`
- Modify: `playwright.config.ts`
- Modify: `demo/hamster/README.md`
- Modify: `README.md`
- Modify: `docs/guide/quick-start.md`
- Create: `docs/guide/demos.md`
- Modify: `docs/.vitepress/config/index.ts`

**Interfaces:**

- A second Playwright web server starts the flagship on port 3334; existing browser projects remain unchanged.
- Docs explain the `examples`/`demo` distinction and provide exact run commands.

- [ ] **Step 1: Write the hamster E2E before adding its server project**

Test the still-gazing route through both activity UIs. Assert:

1. title and first narration;
2. star-map renderer can complete and disappear;
3. choice state reaches chapter 3;
4. civilization renderer returns a name/level/principle;
5. final conditional choice yields the still-gazing prose;
6. settings and devtools remain openable.

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm exec playwright test tests/e2e/hamster.spec.ts --project=chromium`

Expected: FAIL because the port 3334 server is not configured.

- [ ] **Step 3: Configure isolated demo servers**

Change `webServer` to an array, preserve the starter server on port 3333, and add hamster on port 3334 using `pnpm demo:hamster -- --port 3334`. Keep `chromium`/CI browser projects unchanged; both servers are shared by those projects.

- [ ] **Step 4: Document the two demo levels**

Document:

- `examples/`: small, focused API or syntax fragments;
- `demo/starter`: minimal copyable full project;
- `demo/hamster`: complete narrative showcase and regression fixture;
- commands for running/building each;
- story attribution and why Studio uses `adv/settings/game.json` rather than executing config code.

Add a docs sidebar entry for `Demos`.

- [ ] **Step 5: Run final verification**

Run:

```bash
pnpm vitest run tests/unit/demo-project-layout.test.ts tests/unit/hamster-demo-runtime.test.ts
pnpm exec playwright test tests/e2e/starter.spec.ts tests/e2e/hamster.spec.ts
pnpm -C demo/starter build
pnpm -C demo/hamster build
pnpm -C demo/hamster build:singlefile
pnpm docs:build
pnpm typecheck
```

Expected: all commands exit 0, both demos build independently, and the hamster single-file build includes local media.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e playwright.config.ts demo/hamster/README.md README.md docs
git commit -m "docs(demo): present starter and hamster showcases"
```
