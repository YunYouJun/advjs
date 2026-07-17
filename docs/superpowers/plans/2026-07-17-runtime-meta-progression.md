# Runtime Meta Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist an explicit whitelist of JSON game variables across new runtime sessions so games can unlock post-completion routes without making the deterministic Runtime depend on browser storage.

**Architecture:** `AdvGameConfig.progression` declares a stable game ID, schema version, and top-level variable keys. A client-only progression controller restores those values into `initialVariables` before Runtime installation and captures them after state updates; Core remains a pure function of Program plus initial state. Studio disables browser progression by default so authoring playtests remain reproducible.

**Tech Stack:** TypeScript, Vue client setup, Web Storage, Vitest, ADV.JS Runtime variables.

## Global Constraints

- Runtime Core must not import browser storage or mutate persistence directly.
- Persist only top-level keys explicitly listed in `gameConfig.progression.keys`.
- Store JSON-compatible values under `advjs:progression:{encoded-id}:v{version}`.
- Default progression version to `1`; reject empty IDs, non-positive versions, empty keys, and duplicate keys.
- Invalid/malformed stored records must not prevent a new game from starting.
- Studio playtests pass `progressionStorage: false` and never consume a player's browser unlocks.
- `demo/hamster` persists only `canonicalCompleted` and `unlockedEndings` in progression version `1`.

---

### Task 1: Define and test the progression controller

**Files:**

- Create: `tests/unit/client-runtime-progression.test.ts`
- Create: `packages/client/runtime/progression.ts`
- Modify: `packages/client/runtime/index.ts`

**Interfaces:**

- `createBrowserRuntimeProgression(config, { storage?, prefix? }) => RuntimeProgressionController`
- `RuntimeProgressionController.restore(initialVariables) => JsonObject`
- `RuntimeProgressionController.capture(variables) => void`
- `RuntimeProgressionController.clear() => void`

- [x] **Step 1: Write failing restore/capture tests**

Use a real in-memory implementation of the Web Storage interface. Assert capture stores only whitelisted keys, restore merges them over fresh defaults without changing unrelated defaults, and returned objects are clones.

- [x] **Step 2: Write failing isolation/error tests**

Assert game IDs and versions use distinct storage keys; malformed JSON and wrong-schema records return defaults; clear removes only the controller's record; invalid configuration throws a `TypeError`.

- [x] **Step 3: Run tests and verify RED**

Run: `pnpm vitest run tests/unit/client-runtime-progression.test.ts`

Expected: FAIL because `runtime/progression.ts` does not exist.

- [x] **Step 4: Implement the minimal controller**

Validate the config once, encode the key, parse a versioned `{ schemaVersion: 1, variables }` record, copy only declared keys, serialize captures synchronously, and expose clear.

- [x] **Step 5: Run tests and verify GREEN**

Run: `pnpm vitest run tests/unit/client-runtime-progression.test.ts`

Expected: PASS.

### Task 2: Integrate progression at the browser host boundary

**Files:**

- Modify: `packages/types/src/config/game.ts`
- Modify: `packages/client/types/context.ts`
- Modify: `packages/client/setup/context.ts`
- Modify: `apps/studio/src/components/GamePlayer.vue`
- Modify: `tests/unit/client-activity-renderers.test.ts`

**Interfaces:**

- Adds `AdvGameProgressionConfig { id: string; version?: number; keys: string[] }`.
- Adds optional `AdvGameConfig.progression`.
- Adds optional `AdvContext.progression` for inspection/clear operations.
- Adds `progressionStorage?: Storage | false` to `setupAdvContext`.

- [x] **Step 1: Add a failing context exposure test**

Create a complete minimal game config with progression, inject in-memory storage, initialize the context with a one-node fetched chapter, and assert restored variables reach the Runtime and a state change is captured. Stub only Pixi initialization if the existing test environment requires it.

- [x] **Step 2: Run the integration test and verify RED**

Run: `pnpm vitest run tests/unit/client-runtime-progression.test.ts tests/unit/client-activity-renderers.test.ts`

Expected: FAIL because setup does not construct or expose progression.

- [x] **Step 3: Merge progression during initialization**

Create the controller only when config exists and storage is enabled. Restore before `runtime.install`; capture in the existing `onState` callback after installation. Preserve normal initial variables when progression is absent, disabled, unavailable during SSR, or malformed.

- [x] **Step 4: Disable it in Studio**

Pass `progressionStorage: false` from `GamePlayer.vue`, preserving deterministic project variables for every Studio run.

- [x] **Step 5: Run client and host regression tests**

```bash
pnpm vitest run \
  tests/unit/client-runtime-progression.test.ts \
  tests/unit/client-activity-renderers.test.ts \
  tests/unit/runtime-host-conformance.test.ts
```

Expected: PASS.

### Task 3: Configure the hamster unlock contract

**Files:**

- Modify: `demo/hamster/adv/settings/game.json`
- Modify: `tests/unit/demo-project-layout.test.ts`
- Modify: `tests/unit/hamster-adaptation-contract.test.ts`

**Interfaces:**

- Adds initial variables `canonicalCompleted: false`, `storyMode: "canonical"`, and `unlockedEndings: []`.
- Persists `canonicalCompleted` and `unlockedEndings` under game ID `hamster`, version `1`.

- [x] **Step 1: Add failing configuration assertions**

Assert the exact progression object and variable defaults in both settings and TypeScript config projection.

- [x] **Step 2: Run tests and verify RED**

Run: `pnpm vitest run tests/unit/demo-project-layout.test.ts tests/unit/hamster-adaptation-contract.test.ts`

Expected: FAIL because the progression contract is absent.

- [x] **Step 3: Add the configuration**

Update only Studio-safe JSON settings; `adv.config.ts` already spreads that object into the game config.

- [x] **Step 4: Run tests and verify GREEN**

Run: `pnpm vitest run tests/unit/demo-project-layout.test.ts tests/unit/hamster-adaptation-contract.test.ts`

Expected: PASS.

### Task 4: Document host-owned meta progression

**Files:**

- Create: `docs/guide/runtime/meta-progression.md`
- Modify: `docs/.vitepress/config/index.ts`
- Modify: `docs/guide/runtime/debugging-and-migration.md`

**Interfaces:**

- Produces: author guidance on configuration, lifecycle, reset behavior, privacy, deterministic Runtime boundaries, Studio behavior, and the hamster example.

- [x] **Step 1: Document configuration and semantics**

Show the exact `progression` config, explain top-level whitelist behavior, storage key/versioning, merge precedence, clear API, and why route-local variables such as `storyMode` are not persisted.

- [x] **Step 2: Add navigation and migration notes**

Add “跨周目进度” under the unified Runtime sidebar and warn that adding/removing persisted keys or changing their shape requires a progression version bump or explicit migration.

- [x] **Step 3: Run verification**

```bash
pnpm exec eslint packages/types/src/config/game.ts packages/client/runtime/progression.ts packages/client/runtime/index.ts packages/client/types/context.ts packages/client/setup/context.ts apps/studio/src/components/GamePlayer.vue tests/unit/client-runtime-progression.test.ts
pnpm vitest run tests/unit/client-runtime-progression.test.ts tests/unit/demo-project-layout.test.ts tests/unit/hamster-adaptation-contract.test.ts
pnpm -C docs build
```

Expected: all checks pass.

- [ ] **Step 4: Commit**

```bash
git add packages apps/studio demo/hamster docs tests/unit
git commit -m "feat(runtime): persist whitelisted meta progression"
```
