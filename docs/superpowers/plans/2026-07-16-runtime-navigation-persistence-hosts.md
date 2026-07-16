# Runtime Navigation, Persistence, and Host Unification Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Apply `superpowers:test-driven-development` for every behavior change.

**Goal:** Make Markdown links compile into exact runtime addresses, add complete JSON snapshots/checkpoints/back, and migrate CLI plus browser-facing host state to the same `createAdvRuntime()` semantics.

**Architecture:** The parser preserves author-declared IDs, link targets, and source positions. The compiler owns all string-target resolution and emits only canonical `RuntimeAddress` values. The core runtime owns checkpoints and snapshots; storage and rendering remain host adapters. Browser and CLI adapters only translate runtime state/effects and user input, never advance story logic independently.

**Tech Stack:** TypeScript, mdast/unified, Vue 3, Pinia, Vitest, unstorage, pnpm monorepo.

**Global constraints:**

- Work directly on the user-approved `dev` branch and use Conventional Commits.
- Preserve `apps/studio/RELEASE.md`, `editor/vrm/src/route-map.d.ts`, and `packages/parser/playground/src/route-map.d.ts` as unrelated user changes.
- Do not add a compatibility execution path for the legacy engine.
- Keep Program and Snapshot JSON-only; no functions, `Map`, refs, AST objects, or host resources.
- Every compiler error uses a stable code and, when available, source file/line/column.
- Run the focused test in RED before implementation and GREEN afterward.

---

## Task 1: Preserve Markdown stable anchors, choice links, and source positions

**Files:**

- Modify: `packages/types/src/ast/index.ts`
- Modify: `packages/parser/src/Serialize.ts`
- Modify: `packages/parser/src/core.ts`
- Modify: `packages/parser/src/syntax/index.ts`
- Modify: `packages/parser/src/syntax/parse.ts`
- Test: `packages/parser/test/runtime-syntax.test.ts`

**Contract:**

```ts
interface Node {
  type: string
  id?: string
  position?: MdAst.Position
}

interface Heading extends Node {
  type: 'heading'
  depth: number
  value: string
}
```

The parser recognizes `【天文台，夜，内景】 {#star-map}` and `## 比对结果 {#compare}`. The anchor is removed from display text and stored as `id`. A choice list item whose first paragraph is one Markdown link stores its visible text in `choice.text` and URL in `choice.target`; plain text remains a sequential choice. Top-level and choice nodes retain mdast `position`.

**Steps:**

1. Add tests for scene/heading anchors, link targets (`#local`, `chapter-2`, `chapter-2#node`), plain choices, and source positions.
2. Run `pnpm vitest run packages/parser/test/runtime-syntax.test.ts` and confirm missing heading/target/id assertions fail.
3. Add the optional metadata to AST nodes and include `Heading` in `Item`.
4. Add a small `parseStableAnchor()` helper that only accepts `{#` + `[A-Za-z0-9][A-Za-z0-9._-]*` + `}` at the end of text.
5. Serialize headings and list links without flattening their URL; attach mdast positions in one place in `Serialize.parse()`.
6. Strip a valid trailing anchor before existing text/scene parsing, then attach the ID.
7. Run the focused parser test and all parser tests.
8. Commit: `feat(parser): preserve runtime links and stable anchors`.

---

## Task 2: Resolve all author targets during compile/link

**Files:**

- Modify: `packages/types/src/runtime/program.ts`
- Modify: `packages/core/src/compiler/types.ts`
- Modify: `packages/core/src/compiler/markdown.ts`
- Modify: `packages/core/src/compiler/link.ts`
- Add: `packages/core/src/compiler/address.ts`
- Modify: `packages/core/src/compiler/index.ts`
- Test: `packages/core/test/runtime/markdown-compiler.test.ts`
- Test: `packages/core/test/runtime/link.test.ts`

**Contract:** compiler-only node inputs may carry unresolved string targets and source metadata, but public `RuntimeProgram` nodes contain only resolved `RuntimeAddress` values. ID allocation uses explicit IDs verbatim; anonymous nodes receive deterministic `node-N` IDs and are not advertised as stable author links.

```ts
type RuntimeTargetInput = RuntimeAddress | string

function parseRuntimeTarget(raw: string, currentChapterId: string):
  | { chapterId: string, nodeId?: string }
  | CompileDiagnostic
```

Resolution rules are exact: `#node` means current chapter; `chapter` means target chapter entry; `chapter#node` means exact address. Empty fragments, multiple `#`, invalid identifiers, duplicate stable IDs, missing chapter, and missing node are errors. Choice targets are checked alongside `next` addresses.

**Steps:**

1. Extend compiler tests with same/cross chapter targets, target chapter entry, stable IDs, duplicate IDs, invalid syntax, and source-aware unknown-target diagnostics.
2. Run focused compiler tests and observe current `ADV_RUNTIME_CHOICE_LINK_REQUIRED` failures.
3. Introduce compiler input types for unresolved choices/nodes without weakening the public `RuntimeProgram` types.
4. Compile headings as silent anchor nodes and scenes with their stable IDs; keep exact source metadata in the compiler input only.
5. Implement `parseRuntimeTarget()` and resolve every next/choice target in the linker after all chapters and entries are known.
6. Validate choice targets in `linkRuntimeProgram()` and return no Program on any error.
7. Export the parser only if needed by tooling; otherwise keep it compiler-internal.
8. Run compiler, core runtime, and parser tests.
9. Commit: `feat(core): link markdown choice targets`.

---

## Task 3: Add complete JSON snapshots, checkpoints, restore, and back

**Files:**

- Modify: `packages/types/src/runtime/state.ts`
- Modify: `packages/types/src/runtime/index.ts`
- Modify: `packages/core/src/runtime/create.ts`
- Add: `packages/core/src/runtime/snapshot.ts`
- Modify: `packages/core/src/runtime/index.ts`
- Test: `packages/core/test/runtime/snapshot.test.ts`
- Test: `packages/core/test/runtime/create.test.ts`

**Contract:**

```ts
interface RuntimeCheckpoint {
  id: string
  state: RuntimeState
  createdAt: number
}

interface RuntimeSnapshot {
  schemaVersion: 1
  program: { id: string, hash: string }
  state: RuntimeState
  checkpoints: RuntimeCheckpoint[]
  createdAt: number
}

interface AdvRuntime {
  // existing API
  go(target: RuntimeAddress | string): Promise<RuntimeUpdate>
  back(): RuntimeUpdate
  snapshot(): RuntimeSnapshot
  restore(snapshot: RuntimeSnapshot): RuntimeUpdate
}
```

Checkpoint creation is deterministic with respect to state: before leaving a visible narrative node, before a choice is applied, and before a pending activity (added later). Consecutive equal states collapse. A configurable `maxCheckpoints` defaults to 100. Timestamps/IDs are metadata and use an injectable `now()` option for tests. `restore()` rejects schema mismatch, program ID mismatch, program hash mismatch, malformed non-JSON data, and unknown cursor addresses before mutating state.

**Steps:**

1. Add failing tests for JSON round-trip, full stage/variables/history restoration, choice and cross-chapter rollback, cap/deduplication, immutable returned data, and every compatibility rejection.
2. Run `pnpm vitest run packages/core/test/runtime/snapshot.test.ts packages/core/test/runtime/create.test.ts` and verify RED.
3. Add snapshot types and pure validation/creation helpers in `snapshot.ts`.
4. Extend runtime dispatch to checkpoint at the contract boundaries and add `snapshot`, `restore`, and `back` without putting persistence inside core.
5. Accept string addresses in `go()` using the same exact address grammar; never use title/filename fuzzy matching.
6. Notify subscribers with `{ type: 'runtime.restore' }` and `{ type: 'runtime.back' }` effects after successful state replacement.
7. Run snapshot, transition, conformance, browser-bundle, and type tests.
8. Commit: `feat(core): add runtime snapshots and rollback`.

---

## Task 4: Define storage adapters shared by browser and Node

**Files:**

- Add: `packages/core/src/storage/types.ts`
- Add: `packages/core/src/storage/memory.ts`
- Add: `packages/core/src/storage/index.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/runtime/storage.test.ts`

**Contract:**

```ts
interface RuntimeSaveRecord {
  id: string
  snapshot: RuntimeSnapshot
  metadata?: JsonObject
  updatedAt: number
}

interface RuntimeStorage {
  list(): Promise<RuntimeSaveRecord[]>
  get(id: string): Promise<RuntimeSaveRecord | undefined>
  set(record: RuntimeSaveRecord): Promise<void>
  remove(id: string): Promise<void>
}
```

The core package supplies a clone-safe memory adapter and record validators. Browser local storage and Node filesystem adapters live in their host packages. Slot metadata is separate from snapshot execution state.

**Steps:**

1. Add a contract suite covering sorted listing, cloning, overwrite, delete, JSON round-trip, and invalid snapshot rejection.
2. Run focused test and observe missing API failure.
3. Implement the types, validation reuse, and memory adapter.
4. Export from core and verify browser bundling contains no Node import.
5. Run focused tests and `pnpm vitest run packages/core/test/browser-bundle.test.ts`.
6. Commit: `feat(core): add runtime storage contract`.

---

## Task 5: Migrate `adv play` to the unified runtime

**Files:**

- Add: `packages/advjs/node/runtime/storage.ts`
- Add: `packages/advjs/node/runtime/player.ts`
- Modify: `packages/advjs/node/cli/play.ts`
- Modify: `packages/advjs/node/cli/index.ts`
- Test: `tests/unit/runtime-cli-player.test.ts`
- Test: `tests/unit/runtime-node-storage.test.ts`
- Remove after migration: `packages/core/src/engine/runtime.ts`
- Remove after migration: `packages/core/src/engine/session.ts`
- Remove after migration: `packages/core/src/engine/types.ts`
- Update: `packages/core/src/engine/index.ts`
- Update/remove legacy tests: `packages/core/test/engine/runtime.test.ts`, `packages/core/test/engine/session.test.ts`, `tests/unit/play-back.test.ts`, `tests/unit/engine-save-slot.test.ts`, `tests/unit/engine-rollback.test.ts`

**Contract:** `adv play` loads all project chapters, calls `compileMarkdownProgram()`, refuses compiler errors, constructs `createAdvRuntime()`, and formats runtime state/current nodes. CLI commands call only `next/choose/go/back/snapshot/restore`; Node storage is an atomic JSON-file implementation of `RuntimeStorage`. `--trace` prints address, status, emitted effects, and variable changes as JSON lines.

**Steps:**

1. Add failing player-adapter tests that execute the same fixture command sequence used by core conformance and assert its snapshot/effects.
2. Add failing filesystem storage contract tests with a temporary directory.
3. Implement `RuntimeCliPlayer` as an input/output adapter with no cursor mutation.
4. Implement filesystem records using temp-file + rename and validate records on read.
5. Replace `play.ts` engine/session calls with compiler/runtime/player/storage calls, retaining existing prompts and command names where their semantics remain valid.
6. Add exact compiler diagnostics and optional trace output.
7. Delete legacy core execution/session code only after `rg 'AdvPlayEngine|SessionManager|PlaySession'` shows no production consumers.
8. Run focused CLI tests, core tests, typecheck, and a non-interactive `adv play` smoke fixture.
9. Commit: `refactor(cli): use unified adventure runtime`.

---

## Task 6: Add a Vue host adapter and migrate client navigation state

**Files:**

- Add: `packages/client/composables/useAdvRuntime.ts`
- Add: `packages/client/runtime/storage.ts`
- Add: `packages/client/runtime/effects.ts`
- Modify: `packages/client/stores/useAdvStore.ts`
- Modify: `packages/client/types/context.ts`
- Modify: `packages/client/setup/context.ts`
- Modify: `packages/client/pages/game.vue`
- Modify: `packages/client/components/adv/AdvChoice.vue`
- Modify: dependent ADV components under `packages/client/components/adv/`
- Modify: `packages/client/stores/useGameStore.ts`
- Modify: `themes/theme-default/components/save/SavedCard.vue`
- Test: `tests/unit/client-runtime-host.test.ts`
- Test: `tests/unit/client-runtime-storage.test.ts`

**Contract:** one composable owns the runtime instance and mirrors immutable `RuntimeState` into a `shallowRef`. Components derive dialogue/choices/stage from `runtime.current` and `runtime.state`. Choice buttons call `runtime.choose(choice.id)` only. The browser storage adapter persists `RuntimeSaveRecord`; save thumbnails/labels remain metadata. Effect handlers update audio/Pixi presentation but never story cursor/variables.

**Steps:**

1. Add failing host tests proving reactive state follows runtime updates and browser storage obeys the shared contract.
2. Implement host/effect/storage adapters.
3. Change context construction and `game.vue` startup to compile chapters once and install the runtime host.
4. Migrate choice, dialogue, narration, background, BGM, tachie, save/load, and back consumers to runtime state/effects.
5. Remove fuzzy chapter matching and direct old store cursor changes.
6. Remove `$logic`/`$nav` from `AdvContext` when `rg '\$logic|\$nav|curFlowNode|curNode' packages/client themes` has no runtime consumers.
7. Run focused Vue tests, unit tests, typecheck, and starter Playwright smoke.
8. Commit: `refactor(client): use unified adventure runtime`.

---

## Task 7: Migrate Studio play preview and expose a runtime inspector model

**Files:**

- Add: `apps/studio/src/composables/useRuntimeInspector.ts`
- Modify: `apps/studio/src/components/GamePlayer.vue`
- Modify: `apps/studio/src/views/PlayPage.vue`
- Modify: Studio save database types used by `PlayPage.vue`
- Test: `apps/studio/src/composables/useRuntimeInspector.test.ts`

**Contract:** Studio preview uses the same client host/runtime. The inspector model contains current canonical address, status, variables, stage, choices, visited nodes, checkpoint count, and pending activity (once available). Studio save rows store `RuntimeSnapshot` plus UI metadata. No Studio code matches chapter title or filename to jump.

**Steps:**

1. Add failing inspector projection tests using a real runtime snapshot.
2. Implement the pure inspector projection/composable.
3. Replace legacy `GamePlayer` navigation and snapshot exposure with the runtime host API.
4. Replace `PlayPage` fuzzy chapter/save/rollback paths with `go`, `snapshot`, `restore`, and `back`.
5. Add a compact inspector panel to existing debug UI without redesigning Studio.
6. Run Studio tests/typecheck/build while preserving the unrelated `RELEASE.md` change.
7. Commit: `refactor(studio): preview unified runtime state`.

---

## Task 8: Cross-host conformance, documentation, and phase verification

**Files:**

- Add: `tests/fixtures/runtime/navigation.adv.md`
- Modify: `packages/core/test/runtime/conformance.test.ts`
- Add: `tests/unit/runtime-host-conformance.test.ts`
- Add: `docs/guide/runtime/navigation-and-saves.md`
- Modify: relevant VitePress sidebar/config and `docs/README.md` or guide index
- Modify: `docs/superpowers/specs/2026-07-16-unified-runtime-design.md`

**Steps:**

1. Build a two-chapter fixture with local jump, cross-chapter jump, stage effects, choice checkpoint, save/restore, and back.
2. Run it through core, CLI player, and browser memory host adapters and compare normalized snapshots/effects.
3. Document target syntax, stable IDs, snapshot compatibility, storage adapter contract, exact diagnostics, and migration breakage.
4. Mark design sections 2–4 complete only when all production hosts use the same runtime.
5. Run `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build:advjs`, relevant Studio/client builds, and starter E2E smoke.
6. Confirm `rg 'new Function|eval\(' packages/client packages/core packages/advjs apps/studio` has no story-execution result (logic removal may complete in the next plan if declarative actions are not yet installed).
7. Commit: `test(runtime): verify cross-host navigation and saves` and `docs(runtime): document navigation and persistence` if documentation is independently reviewable.

---

## Plan self-review

- **Spec coverage:** exact Markdown targets, stable IDs, source diagnostics, JSON snapshots, checkpoints/back, storage separation, browser/CLI/Studio host unification, and cross-host conformance are all assigned to concrete tasks.
- **Dependency order:** parser metadata precedes compiler linking; resolved Programs precede snapshots; snapshot/storage contracts precede host migrations; conformance follows all hosts.
- **Type consistency:** public Programs never contain raw target strings; raw strings exist only in compiler inputs. Snapshots reference Program identity/hash and contain only runtime state/checkpoints. Slot metadata is outside the snapshot.
- **No placeholders:** each task names tests, files, public interfaces, failure cases, verification, and commit boundary.
- **Known sequencing caveat:** complete removal of `new Function` depends on the following logic/actions plan. During this plan it must become unreachable from migrated hosts; the source file is deleted in the next phase once declarative actions land.
