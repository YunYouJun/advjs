# Runtime Observability and Studio Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace raw JSON debug dumps with a shared runtime trace/inspector, add exportable bug reports, and give Studio authors live Program and Diagnostics views with source navigation.

**Architecture:** `@advjs/types` defines a JSON-only trace contract; Core emits bounded trace entries for every public runtime command. `@advjs/client` owns reusable projection and Vue inspector components consumed by both the game devtools and Studio. Studio compiles the complete in-memory project with the unsaved file overlaid, renders RuntimeProgram structure and diagnostics, and maps diagnostic source locations back to the editor.

**Tech Stack:** TypeScript, Vue 3, ADV.JS Core compiler/runtime, Vitest, Vue Test Utils, Ionic Vue, browser Blob download.

**Depends on:** `2026-07-17-activity-renderers-and-studio-plugins.md` and Task 3 of `2026-07-17-starter-and-hamster-showcase.md`.

## Global Constraints

- Runtime trace entries must be JSON-serializable and contain no Vue values or source Markdown.
- Trace uses a monotonic sequence, not wall-clock time, so tests and exported reports are deterministic.
- Existing `RuntimeSubscriber(state, effects)` behavior stays backward compatible.
- Default trace capacity is 200 entries and can be disabled with `maxTraceEntries: 0`.
- Bug reports include program ID/hash, snapshot, diagnostics, and trace; they do not include prose/source files. Because variables can contain author-defined data, export UI must warn the user to review the JSON before sharing it.
- Studio diagnostics always compile the whole project, not only the open file, because links and plugin requirements are cross-file.
- An unsaved editor buffer overrides only its matching project chapter during compilation.
- Follow Vue props-down/events-up, keyboard accessibility, and Conventional Commits.

---

### Task 1: Define the shared JSON trace and variable-diff contract

**Files:**

- Create: `packages/types/src/runtime/trace.ts`
- Modify: `packages/types/src/runtime/index.ts`
- Create: `packages/core/src/runtime/trace.ts`
- Modify: `packages/core/src/runtime/index.ts`
- Test: `tests/unit/runtime-trace.test.ts`

**Interfaces:**

- Produces: `RuntimeCommandName`, `RuntimeTraceInput`, `RuntimeVariableChange`, `RuntimeTraceEntry`, `diffRuntimeVariables()`.

- [ ] **Step 1: Write variable-diff tests**

Cover scalar creation, deletion, nested object change, array replacement, sorted path order, and no-op equality:

```ts
expect(diffRuntimeVariables(
  { score: 1, profile: { mood: 'calm' } },
  { score: 2, profile: { mood: 'curious' }, unlocked: true },
)).toEqual([
  { path: 'profile.mood', before: 'calm', after: 'curious' },
  { path: 'score', before: 1, after: 2 },
  { path: 'unlocked', after: true },
])
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm vitest run tests/unit/runtime-trace.test.ts`

Expected: FAIL because trace types/helper do not exist.

- [ ] **Step 3: Add JSON-only public types**

```ts
export type RuntimeCommandName
  = | 'start' | 'next' | 'choose' | 'go'
    | 'back' | 'restore' | 'complete-activity'

export interface RuntimeTraceInput {
  choiceId?: string
  target?: RuntimeAddress
  activityType?: string
}

export interface RuntimeVariableChange {
  path: string
  before?: JsonValue
  after?: JsonValue
}

export interface RuntimeTraceEntry {
  sequence: number
  command: RuntimeCommandName
  input?: RuntimeTraceInput
  from: RuntimeAddress
  to: RuntimeAddress
  status: RuntimeStatus
  effects: RuntimeEffect[]
  variableChanges: RuntimeVariableChange[]
}
```

Do not add arbitrary timestamps or full command payloads.

- [ ] **Step 4: Implement deterministic recursive diffing**

Recurse only through plain JSON objects; treat arrays and type changes as one path replacement. Escape literal dots/backslashes in object keys before joining paths, clone before/after values, and lexicographically sort the result.

- [ ] **Step 5: Export and run tests**

Run: `pnpm vitest run tests/unit/runtime-trace.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/types/src/runtime packages/core/src/runtime tests/unit/runtime-trace.test.ts
git commit -m "feat(runtime): define command trace contract"
```

### Task 2: Emit bounded traces from every Core runtime command

**Files:**

- Modify: `packages/core/src/runtime/create.ts`
- Modify: `packages/core/src/runtime/transition.ts`
- Modify: `packages/core/src/runtime/index.ts`
- Modify: `tests/unit/runtime-trace.test.ts`
- Test: `tests/unit/runtime-host-conformance.test.ts`

**Interfaces:**

- Extends `AdvRuntimeOptions` with `maxTraceEntries?: number`.
- Extends `AdvRuntime` with `trace(): RuntimeTraceEntry[]` and `subscribeTrace(subscriber)`.

- [ ] **Step 1: Add public-runtime trace tests**

Run `start`, `next`, `choose`, `go`, `completeActivity`, `back`, and `restore` in focused fixtures. Assert command/input/from/to/status/effects/variableChanges and sequence. Add capacity tests for `2` and `0`, unsubscribe behavior, and mutation safety of returned values.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm vitest run tests/unit/runtime-trace.test.ts`

Expected: FAIL because `trace()` and `subscribeTrace()` do not exist.

- [ ] **Step 3: Export `RuntimeCommand` and centralize command metadata**

Export `RuntimeCommand` from the runtime index. Add an internal projector that maps:

```text
{ type: 'choose', choiceId } -> { command: 'choose', input: { choiceId } }
{ type: 'go', target } -> { command: 'go', input: { target } }
{ type: 'complete-activity' } -> {
  command: 'complete-activity',
  input: { activityType: previous.pendingActivity?.type },
}
```

Do not store the full activity result in trace.

- [ ] **Step 4: Record trace beside state publication**

Before each command, clone the prior state. After transition/restore/back, create one entry with `diffRuntimeVariables(previous.variables, state.variables)`, append it to a bounded buffer, and publish cloned entries to trace subscribers. `back` and `restore` must go through the same recorder even though they do not call `transitionRuntime`.

- [ ] **Step 5: Preserve old subscribers and verify all runtime tests**

Run:

```bash
pnpm vitest run tests/unit/runtime-trace.test.ts tests/unit/runtime-host-conformance.test.ts tests/unit/runtime-node-storage.test.ts tests/unit/client-runtime-host.test.ts
```

Expected: PASS with existing subscriber counts unchanged.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/runtime tests/unit/runtime-trace.test.ts
git commit -m "feat(runtime): record bounded command traces"
```

### Task 3: Reuse Core trace in CLI and share inspector projection

**Files:**

- Modify: `packages/advjs/node/runtime/player.ts`
- Modify: `packages/advjs/node/runtime/index.ts`
- Modify: `packages/client/composables/useAdvRuntime.ts`
- Create: `packages/client/runtime/inspector.ts`
- Modify: `packages/client/runtime/index.ts`
- Modify: `apps/studio/src/composables/useRuntimeInspector.ts`
- Modify: `apps/studio/src/composables/useRuntimeInspector.test.ts`
- Test: `tests/unit/runtime-cli-player.test.ts`
- Test: `tests/unit/client-runtime-inspector.test.ts`

**Interfaces:**

- Produces: `RuntimeInspectorModel`, `projectRuntimeInspector()`, `createRuntimeDebugReport()`.
- `RuntimeCliTrace` becomes a deprecated alias for shared `RuntimeTraceEntry`.

- [ ] **Step 1: Write shared projection/report tests**

Assert the projected inspector exposes address, status, current node kind/ID, variables, stage, choices, visited, pending activity, checkpoints, and trace. Assert the report JSON contains:

```ts
const report = {
  schemaVersion: 1,
  engine: 'advjs',
  program: { id: 'fixture', hash: '...' },
  snapshot: expect.any(Object),
  trace: expect.any(Array),
  diagnostics: [],
}
```

Assert serialized output does not contain a known dialogue sentence from the current node.
Assert report metadata includes a notice that snapshot variables and trace diffs may contain author-defined data.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm vitest run tests/unit/client-runtime-inspector.test.ts tests/unit/runtime-cli-player.test.ts`

Expected: FAIL because shared projection/report functions do not exist and CLI still creates its own trace shape.

- [ ] **Step 3: Move projection ownership to Client**

Implement the pure functions under `packages/client/runtime/inspector.ts`. Project current node only as `{ id, kind }`; never clone its `data`. Accept diagnostics as an optional JSON array when creating a report.

Replace Studio's projection implementation with a re-export/thin Vue `computed()` wrapper so current Studio callers remain source-compatible.

- [ ] **Step 4: Expose trace through the replaceable Client host**

Add `maxTraceEntries` to host install options and add `trace()` / `subscribeTrace()` to `AdvRuntimeHost`. Host trace subscribers must remain registered when `install()` replaces the underlying Core runtime, then detach on `dispose()`. Cover reinstall, capacity, and unsubscribe behavior in `tests/unit/client-runtime-host.test.ts`.

- [ ] **Step 5: Adapt CLI to Core trace**

Keep `RuntimeCliPlayerOptions.trace` source compatible, but implement it by subscribing to `runtime.subscribeTrace`. Export:

```ts
/** @deprecated Use RuntimeTraceEntry from @advjs/types. */
export type RuntimeCliTrace = RuntimeTraceEntry
```

Update CLI tests from command `activity` to `complete-activity` and from full variable snapshots to `variableChanges`.

- [ ] **Step 6: Run focused tests**

Run:

```bash
pnpm vitest run tests/unit/client-runtime-inspector.test.ts tests/unit/client-runtime-host.test.ts tests/unit/runtime-cli-player.test.ts
pnpm --filter @advjs/studio test:unit -- src/composables/useRuntimeInspector.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/advjs/node/runtime packages/client/composables/useAdvRuntime.ts packages/client/runtime apps/studio/src/composables tests/unit
git commit -m "refactor(devtools): share runtime inspector model"
```

### Task 4: Build reusable inspector Vue components

**Files:**

- Create: `packages/client/components/devtools/RuntimeJsonTree.vue`
- Create: `packages/client/components/devtools/RuntimeTraceList.vue`
- Create: `packages/client/components/devtools/RuntimeInspectorPanel.vue`
- Modify: `packages/client/components/devtools/AdvDevTools.vue`
- Test: `tests/unit/runtime-inspector-components.test.ts`

**Interfaces:**

- `RuntimeInspectorPanel` consumes `model: RuntimeInspectorModel` and emits `export`.
- Tabs: Overview, Variables, Stage, Trace.

- [ ] **Step 1: Write component tests**

Mount with a model containing nested variables, a stage change, and three trace commands. Assert:

- Overview shows current address/status/kind and checkpoint count;
- Variables tree expands nested object keys;
- Trace filtering by `choose` shows only matching entries;
- selecting a trace entry shows from/to/effects and highlighted variable diffs;
- Export emits exactly once;
- all tabs/buttons have accessible roles and labels.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm vitest run tests/unit/runtime-inspector-components.test.ts`

Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement the JSON tree and trace list**

Use recursive rows for objects/arrays, native buttons for expand/collapse, and stable path keys. Trace list renders sequence, command, status, `from → to`, effect count, and diff count; a command filter uses the exact shared command union.

- [ ] **Step 4: Implement the tabbed inspector panel**

Keep it presentation-only. The parent owns snapshot/trace refresh and downloading. Avoid rendering the entire model through `<pre>`; use the JSON tree only inside detail values.

- [ ] **Step 5: Replace game devtools raw JSON**

Build the model from `$adv.runtime.snapshot()`, `$adv.runtime.trace()`, and `$adv.store.current`. Keep the draggable launcher and overlay; render `RuntimeInspectorPanel` in the aside and download `createRuntimeDebugReport()` when Export is emitted.

- [ ] **Step 6: Run tests and Client typecheck**

Run:

```bash
pnpm vitest run tests/unit/runtime-inspector-components.test.ts tests/unit/component.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/client/components/devtools tests/unit/runtime-inspector-components.test.ts
git commit -m "feat(devtools): add interactive runtime inspector"
```

### Task 5: Integrate inspector and safe report export in Studio playback

**Files:**

- Create: `apps/studio/src/components/RuntimeInspectorDrawer.vue`
- Create: `apps/studio/src/utils/runtimeReport.ts`
- Create: `apps/studio/src/__tests__/runtimeReport.test.ts`
- Modify: `apps/studio/src/components/GamePlayer.vue`
- Modify: `apps/studio/src/i18n/locales/en.json`
- Modify: `apps/studio/src/i18n/locales/zh-CN.json`

**Interfaces:**

- Studio drawer wraps the shared Client panel and adds copy/download controls.
- Downloads `advjs-runtime-report.json` with no project source content.

- [ ] **Step 1: Write report utility tests**

Assert a Blob/download payload has `application/json`, a stable two-space JSON format, and no known chapter prose or filesystem handle values. Assert clipboard text and download text are identical.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm --filter @advjs/studio test:unit -- src/__tests__/runtimeReport.test.ts`

Expected: FAIL because report utility does not exist.

- [ ] **Step 3: Implement the drawer and utility**

The drawer receives `snapshot`, `current`, `trace`, and compile diagnostics as props. It projects the shared model, emits `close`, and delegates copy/download payload creation to `runtimeReport.ts`. Show the variable-data review notice beside copy/download controls. Use localized labels for open, close, copy, download, copied, and empty trace.

- [ ] **Step 4: Replace GamePlayer's `<details><pre>` block**

Add a compact Runtime button over the game, open the drawer, and refresh its computed model when the runtime subscriber fires. Pass trusted Studio runtime plugins from the foundation plan so activity commands also appear in trace.

- [ ] **Step 5: Run Studio tests/build**

Run:

```bash
pnpm --filter @advjs/studio test:unit -- src/__tests__/runtimeReport.test.ts src/composables/useRuntimeInspector.test.ts
pnpm --filter @advjs/studio build
```

Expected: PASS and no raw `runtime-inspector pre` block remains in `GamePlayer.vue`.

- [ ] **Step 6: Commit**

```bash
git add apps/studio/src/components apps/studio/src/utils/runtimeReport.ts apps/studio/src/__tests__/runtimeReport.test.ts apps/studio/src/i18n/locales
git commit -m "feat(studio): add runtime inspector drawer"
```

### Task 6: Add live Program and Diagnostics views to the chapter editor

**Files:**

- Create: `apps/studio/src/utils/runtimeAuthoring.ts`
- Create: `apps/studio/src/__tests__/runtimeAuthoring.test.ts`
- Create: `apps/studio/src/components/RuntimeAuthoringPanel.vue`
- Modify: `apps/studio/src/components/AdvPreviewPanel.vue`
- Modify: `apps/studio/src/views/EditorPage.vue`
- Modify: `apps/studio/src/components/FilePreview.vue`
- Modify: `apps/studio/src/utils/projectValidation.ts`
- Modify: `apps/studio/src/__tests__/projectValidation.test.ts`
- Modify: `apps/studio/src/i18n/locales/en.json`
- Modify: `apps/studio/src/i18n/locales/zh-CN.json`

**Interfaces:**

- Produces: `compileRuntimeAuthoringProject(chapters, settings, override)`.
- `override`: `{ file: string, content: string }` for the unsaved buffer.
- Program rows expose chapter, node ID, kind, next target, source file/line.
- Diagnostics emit `select-source(file, line, column)`.

- [ ] **Step 1: Write whole-project authoring tests**

Use two chapters with a cross-file link and assert the returned program/rows. Overlay an unsaved broken target in chapter 1 and assert an `ADV_RUNTIME_UNKNOWN_TARGET` diagnostic contains its source file/line. Add cases for missing required plugin and an unsaved file not present in the loaded list.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm --filter @advjs/studio test:unit -- src/__tests__/runtimeAuthoring.test.ts`

Expected: FAIL because authoring compiler does not exist.

- [ ] **Step 3: Implement a pure authoring compiler adapter**

Reuse the deterministic chapter ID helper introduced in the foundation plan. Pass every chapter to `compileMarkdownProgram` with `sourcePath: chapter.file`, overlay the matching buffer, and pass `settings.requiredPlugins`. Validate the compiled Program against `createStudioRuntimePlugins()` so unavailable requirements become plugin diagnostics. Flatten a successful program into display rows without changing RuntimeProgram.

Catch parser exceptions and normalize them into `CompileDiagnostic`-compatible entries so the panel never rejects its render promise.

- [ ] **Step 4: Include runtime diagnostics in project health**

Extend `ValidationIssue.category` with `runtime`, add optional line/column/code, and merge Core compile diagnostics into `validateProject`. Do not auto-fix runtime errors. Update existing validation tests for cross-file target errors and missing plugin requirements.

- [ ] **Step 5: Build the authoring panel**

Provide `Preview`, `Program`, and `Diagnostics` tabs:

- Preview reuses `AdvPreviewPanel`;
- Program groups rows by chapter and highlights the currently edited source file;
- Diagnostics groups errors/warnings, displays code plus source location, and emits source selection on click;
- Compilation is debounced 300 ms and stale async results are discarded with a monotonically increasing token.

- [ ] **Step 6: Integrate the responsive split editor**

For `.adv.md` files, change `EditorPage` to render textarea and authoring panel side-by-side at desktop widths and as an Editor/Preview toggle below 768 px. Use the existing dormant split CSS classes after correcting them to match the actual DOM.

When a diagnostic points at the current file, focus the textarea and set the selection to that line/column. When it points at another file, route to `/editor?file=...` and preserve the diagnostic line/column in query parameters.

- [ ] **Step 7: Add Monaco source navigation for modal reuse**

Add optional `revealLine`/`revealColumn` props to `FilePreview`; watch them and call `editor.revealPositionInCenter()` plus `editor.setPosition()`. Keep these props inert in diff mode. This allows `RuntimeAuthoringPanel` to be reused later in `ContentEditorModal` without another editor API change.

- [ ] **Step 8: Run tests/build**

Run:

```bash
pnpm --filter @advjs/studio test:unit -- src/__tests__/runtimeAuthoring.test.ts src/__tests__/projectValidation.test.ts
pnpm --filter @advjs/studio build
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/studio/src/utils apps/studio/src/components apps/studio/src/views/EditorPage.vue apps/studio/src/__tests__ apps/studio/src/i18n/locales
git commit -m "feat(studio): compile scripts while editing"
```

### Task 7: Document debugging workflow and verify end to end

**Files:**

- Modify: `docs/guide/runtime/debugging-and-migration.md`
- Modify: `docs/guide/studio/architecture.md`
- Modify: `docs/.vitepress/config/index.ts`
- Create: `apps/studio/tests/e2e/runtime-debugging.spec.ts`

**Interfaces:**

- Documents trace semantics, report privacy boundary, Studio authoring tabs, and plugin diagnostics.

- [ ] **Step 1: Write the Studio E2E scenario**

Create a fresh MemoryFs project through the existing Quick Start flow, edit a chapter link to an invalid anchor, assert Diagnostics shows `ADV_RUNTIME_UNKNOWN_TARGET`, click the issue and assert editor focus/line, restore valid text, play the chapter, advance once, open Runtime, and assert the `next` entry plus its address transition appears. Plugin activity rendering remains covered by the hamster browser test and Studio trusted-plugin unit test.

- [ ] **Step 2: Run the scenario and verify RED**

Run: `pnpm --filter @advjs/studio test:e2e -- runtime-debugging.spec.ts`

Expected: FAIL because the Program/Diagnostics and Runtime controls do not exist.

- [ ] **Step 3: Document exact workflows**

Explain:

- how to read Program addresses and source links;
- difference between parser, linker, plugin, and runtime diagnostics;
- how trace sequences relate to `start/next/choose/go/back/restore/complete-activity`;
- what the report includes/excludes;
- why Studio only runs allowlisted plugins;
- how to reproduce a hamster route with the exported report.

- [ ] **Step 4: Run final verification**

Run:

```bash
pnpm vitest run tests/unit/runtime-trace.test.ts tests/unit/client-runtime-inspector.test.ts tests/unit/runtime-inspector-components.test.ts tests/unit/runtime-cli-player.test.ts
pnpm --filter @advjs/studio test:unit -- src/__tests__/runtimeAuthoring.test.ts src/__tests__/runtimeReport.test.ts src/__tests__/projectValidation.test.ts src/composables/useRuntimeInspector.test.ts
pnpm --filter @advjs/studio test:e2e -- runtime-debugging.spec.ts
pnpm exec playwright test tests/e2e/hamster.spec.ts --project=chromium
pnpm typecheck
pnpm build:advjs
pnpm --filter @advjs/studio build
pnpm docs:build
```

Expected: all commands exit 0 and exported reports contain no source Markdown.

- [ ] **Step 5: Commit**

```bash
git add docs apps/studio/tests/e2e/runtime-debugging.spec.ts
git commit -m "docs(devtools): explain runtime debugging workflow"
```
