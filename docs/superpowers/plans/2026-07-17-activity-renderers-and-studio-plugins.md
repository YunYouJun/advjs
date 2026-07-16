# Activity Renderers and Studio Plugin Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make runtime activity UI plugin-owned and make classic `public/md` projects with official runtime plugins playable in Studio.

**Architecture:** Runtime plugins remain deterministic Core objects. Their serializable `client.activities` metadata tells the Vite virtual module which Vue renderers to import, while `@advjs/client` owns a namespaced renderer registry and generic activity shell. Studio installs an explicit allowlist of bundled official plugins and reads optional `adv/settings/game.json`; it never evaluates arbitrary project JavaScript.

**Tech Stack:** TypeScript, Vue 3 SFC, Vite virtual modules, Vitest, unbuild, pnpm workspaces.

## Global Constraints

- Node.js remains `^20.19.0 || >=22.12.0`; use pnpm only.
- RuntimeProgram and RuntimeSnapshot remain pure JSON and never contain Vue components or loader functions.
- Studio must not evaluate local `adv.config.ts` or arbitrary third-party plugin modules.
- Production missing-renderer behavior must preserve `waiting-activity`; it must not invent a result.
- New Vue files use `<script setup lang="ts">`, explicit props/emits, and props-down/events-up.
- Follow Conventional Commits and run the focused RED test before each implementation.

---

### Task 1: Add serializable activity-renderer descriptors to plugin metadata

**Files:**

- Modify: `packages/types/src/config/plugin.ts`
- Modify: `packages/advjs/node/virtual/runtime-plugins.ts`
- Test: `tests/unit/runtime-plugin-virtual.test.ts`

**Interfaces:**

- Consumes: existing `AdvRuntimePluginClientReference.module/export/options`.
- Produces: `AdvRuntimeActivityRendererReference` and virtual plugins with `activityRenderers: Record<string, Component>`.

- [ ] **Step 1: Extend the virtual-module test with a static renderer import**

```ts
const client = {
  module: '@advjs/plugin-interactions',
  export: 'starMap',
  options: { tolerance: 0.82 },
  activities: {
    compare: {
      module: '@advjs/plugin-interactions/client/StarMapActivity.vue',
      export: 'default',
    },
  },
}
```

Assert that generated code contains the component import and:

```ts
Object.assign(__advRuntimePlugin0({ tolerance: 0.82 }), { activityRenderers: { 'star-map/compare': __advActivityRenderer0 } })
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm vitest run tests/unit/runtime-plugin-virtual.test.ts`

Expected: FAIL because `client.activities` is ignored.

- [ ] **Step 3: Add the descriptor type**

```ts
export interface AdvRuntimeActivityRendererReference {
  module: string
  export?: string
}

export interface AdvRuntimePluginClientReference {
  module: string
  export?: string
  options?: JsonObject
  activities?: Record<string, AdvRuntimeActivityRendererReference>
}
```

- [ ] **Step 4: Generate static renderer imports and namespaced keys**

In `templateRuntimePlugins.getContent`, validate activity short names with `/^[a-z][a-z0-9-]*$/u`, import every renderer with a stable `__advActivityRendererN` name, and emit `Object.assign(factory(options), { activityRenderers })`. Resolve relative renderer modules through the existing `moduleId()` helper.

Use `JSON.stringify(`${plugin.name}/${activityName}`)` for keys and reject invalid renderer export identifiers with `Invalid runtime activity renderer export: <name>`.

- [ ] **Step 5: Run focused tests**

Run: `pnpm vitest run tests/unit/runtime-plugin-virtual.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/types/src/config/plugin.ts packages/advjs/node/virtual/runtime-plugins.ts tests/unit/runtime-plugin-virtual.test.ts
git commit -m "feat(plugin): load activity renderers"
```

### Task 2: Create the client activity-renderer registry

**Files:**

- Create: `packages/client/types/activity.ts`
- Create: `packages/client/runtime/activity-renderers.ts`
- Modify: `packages/client/types/index.ts`
- Modify: `packages/client/runtime/index.ts`
- Test: `tests/unit/client-activity-renderers.test.ts`

**Interfaces:**

- Consumes: `AdvRuntimePlugin` and Vue `Component`.
- Produces: `AdvClientRuntimePlugin`, `ActivityRendererRegistry`, `createActivityRendererRegistry()`.

- [ ] **Step 1: Write registry tests**

```ts
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { createActivityRendererRegistry } from '../../packages/client/runtime/activity-renderers'

const renderer = defineComponent({ name: 'TestRenderer', template: '<div />' })

describe('activity renderer registry', () => {
  it('resolves a namespaced renderer', () => {
    const registry = createActivityRendererRegistry([{
      name: 'test',
      version: '1.0.0',
      activityRenderers: { 'test/open': renderer },
    }])
    expect(registry.resolve('test/open')).toBe(renderer)
  })

  it('rejects duplicate renderers', () => {
    const plugin = { name: 'test', version: '1.0.0', activityRenderers: { 'test/open': renderer } }
    expect(() => createActivityRendererRegistry([plugin, { ...plugin, name: 'other' }]))
      .toThrow('ADV_ACTIVITY_RENDERER_CONFLICT')
  })
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm vitest run tests/unit/client-activity-renderers.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Define the public client types**

```ts
import type { AdvRuntimePlugin } from '@advjs/core'
import type { JsonValue, RuntimePendingActivity } from '@advjs/types'
import type { Component } from 'vue'

export interface AdvActivityRendererProps {
  activity: RuntimePendingActivity
}

export interface AdvActivityRendererEmits {
  complete: [result: JsonValue]
  back: []
}

export interface AdvClientRuntimePlugin extends AdvRuntimePlugin {
  activityRenderers?: Record<string, Component>
}
```

- [ ] **Step 4: Implement a read-only registry**

```ts
export interface ActivityRendererRegistry {
  resolve: (type: string) => Component | undefined
  list: () => string[]
}

export function createActivityRendererRegistry(
  plugins: readonly AdvClientRuntimePlugin[] = [],
): ActivityRendererRegistry {
  const renderers = new Map<string, Component>()
  for (const plugin of plugins) {
    for (const [type, renderer] of Object.entries(plugin.activityRenderers ?? {})) {
      if (!type.startsWith(`${plugin.name}/`))
        throw new Error(`ADV_ACTIVITY_RENDERER_INVALID_NAME: ${type}`)
      if (renderers.has(type))
        throw new Error(`ADV_ACTIVITY_RENDERER_CONFLICT: ${type}`)
      renderers.set(type, renderer)
    }
  }
  return {
    resolve: type => renderers.get(type),
    list: () => [...renderers.keys()].sort(),
  }
}
```

- [ ] **Step 5: Export types and implementation, then run tests**

Run: `pnpm vitest run tests/unit/client-activity-renderers.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/client/types packages/client/runtime tests/unit/client-activity-renderers.test.ts
git commit -m "feat(client): register activity renderers"
```

### Task 3: Inject the registry into AdvContext

**Files:**

- Modify: `packages/client/types/context.ts`
- Modify: `packages/client/setup/context.ts`
- Modify: `packages/client/compiler/index.ts`
- Test: `tests/unit/client-activity-renderers.test.ts`

**Interfaces:**

- Consumes: `AdvClientRuntimePlugin[]` and `createActivityRendererRegistry()`.
- Produces: `$adv.activityRenderers` and typed `setupAdvContext({ runtimePlugins })`.

- [ ] **Step 1: Add a context assertion to the focused test**

Create a minimal config with a plugin containing `activityRenderers`, call `setupAdvContext`, and assert:

```ts
expect(context.activityRenderers.resolve('test/open')).toBe(renderer)
```

- [ ] **Step 2: Run the test and verify RED**

Run: `pnpm vitest run tests/unit/client-activity-renderers.test.ts`

Expected: FAIL because `activityRenderers` is absent from `AdvContext`.

- [ ] **Step 3: Preserve client plugin fields when filtering**

Change the local filter return type from `AdvRuntimePlugin[]` to `AdvClientRuntimePlugin[]`; do not clone or strip extra fields. Add to `AdvContext`:

```ts
activityRenderers: ActivityRendererRegistry
```

Construct the registry once beside the Runtime host and attach it to `advContext`.

- [ ] **Step 4: Run host and registry tests**

Run: `pnpm vitest run tests/unit/client-activity-renderers.test.ts tests/unit/client-runtime-host.test.ts tests/unit/runtime-plugin-virtual.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/client/types/context.ts packages/client/setup/context.ts packages/client/compiler/index.ts tests/unit/client-activity-renderers.test.ts
git commit -m "refactor(client): expose activity renderer registry"
```

### Task 4: Replace hard-coded activity branches with a generic shell

**Files:**

- Create: `packages/client/components/adv/activity/GenericActivityDebug.vue`
- Create: `packages/client/components/adv/activity/UnsupportedActivity.vue`
- Modify: `packages/client/components/adv/AdvActivity.vue`
- Test: `tests/unit/component.test.ts`

**Interfaces:**

- Consumes: `$adv.store.state.pendingActivity`, `$adv.activityRenderers`, `$adv.runtime.completeActivity()`, `$adv.runtime.back()`.
- Produces: generic dynamic renderer behavior with dev/prod fallbacks.

- [ ] **Step 1: Add component tests**

Mount `AdvActivity` with an injected context and assert that a registered fake renderer receives the pending activity and that emitting `complete` calls `runtime.completeActivity({ ok: true })`. Add a second test that an unknown type renders `UnsupportedActivity` when `__DEV__` is false.

- [ ] **Step 2: Run the component test and verify RED**

Run: `pnpm vitest run tests/unit/component.test.ts -t "activity renderer"`

Expected: FAIL because `AdvActivity` still contains plugin-specific branches.

- [ ] **Step 3: Implement the generic shell**

Use:

```ts
const pending = computed(() => $adv.store.state.pendingActivity)
const renderer = computed(() => pending.value
  ? $adv.activityRenderers.resolve(pending.value.type)
  : undefined)

async function complete(result: JsonValue) {
  error.value = ''
  try {
    await $adv.runtime.completeActivity(result)
  }
  catch (cause) {
    error.value = cause instanceof Error ? cause.message : String(cause)
  }
}
```

Render `<component :is="renderer" :activity="pending" @complete="complete" @back="$adv.runtime.back()" />`. Keep overlay/loading/error ownership in `AdvActivity.vue`. The generic debug component parses JSON and emits `complete`; the unsupported component emits only `back`.

- [ ] **Step 4: Remove all `star-map/compare` and `civilization/initialize` conditionals from Client**

Run: `rg -n "star-map/compare|civilization/initialize" packages/client`

Expected: no matches.

- [ ] **Step 5: Run component and client tests**

Run: `pnpm vitest run tests/unit/component.test.ts tests/unit/client-activity-renderers.test.ts tests/unit/client-runtime-host.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/client/components/adv packages/client/runtime packages/client/types tests/unit/component.test.ts
git commit -m "refactor(client): render plugin activities generically"
```

### Task 5: Ship renderer SFCs from plugin-interactions

**Files:**

- Create: `plugins/plugin-interactions/client/StarMapActivity.vue`
- Create: `plugins/plugin-interactions/client/CivilizationActivity.vue`
- Create: `plugins/plugin-interactions/client/style.css`
- Modify: `plugins/plugin-interactions/src/star-map.ts`
- Modify: `plugins/plugin-interactions/src/civilization.ts`
- Modify: `plugins/plugin-interactions/package.json`
- Test: `plugins/plugin-interactions/test/activity-components.test.ts`

**Interfaces:**

- Consumes: `AdvRuntimePluginClientReference.activities`.
- Produces: raw Vite-consumable SFC subpaths and JSON activity results.

- [ ] **Step 1: Write Vue component tests**

For `StarMapActivity`, set the range to `0.91`, click “确认匹配”, and assert `emitted('complete')[0][0]` equals `{ matched: true, score: 0.91 }`. For `CivilizationActivity`, enter `仓生`, level `2`, principle `memory`, and assert the emitted object exactly matches those values.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm vitest run plugins/plugin-interactions/test/activity-components.test.ts`

Expected: FAIL because the SFC files do not exist.

- [ ] **Step 3: Create focused SFCs**

Each component defines:

```ts
const props = defineProps<AdvActivityRendererProps>()
const emit = defineEmits<AdvActivityRendererEmits>()
```

The star-map form initializes its score from `activity.input.tolerance` when numeric, clamps output to `0..1`, and emits `{ matched, score }`. The civilization form uses `suggestedName`, the first `principles` entry, and `defaultLevel`, and emits `{ name, level, principle }`.

- [ ] **Step 4: Declare renderer metadata from plugin factories**

Add to each existing `client` object:

```ts
const activities = {
  compare: {
    module: '@advjs/plugin-interactions/client/StarMapActivity.vue',
    export: 'default',
  },
}
```

and the corresponding `initialize` descriptor.

- [ ] **Step 5: Publish raw client files without bundling Vue into Core**

Merge the following package metadata while preserving the existing scripts,
Core/type dependencies, and the existing `unbuild`/`vitest` development
dependencies:

```json
{
  "exports": {
    ".": "./dist/index.mjs",
    "./client/*": "./client/*"
  },
  "files": ["dist", "client"],
  "peerDependencies": { "vue": "^3.5.0" },
  "devDependencies": {
    "@advjs/client": "workspace:*",
    "@vue/test-utils": "catalog:test",
    "jsdom": "catalog:",
    "unbuild": "catalog:build",
    "vitest": "catalog:test",
    "vue": "catalog:frontend"
  }
}
```

Keep unbuild entries limited to `src/index`; Vite compiles the raw SFC subpaths.

- [ ] **Step 6: Run plugin tests and build**

Run: `pnpm vitest run plugins/plugin-interactions/test && pnpm --filter @advjs/plugin-interactions build`

Expected: PASS; `dist/index.mjs` builds and client SFCs remain source files.

- [ ] **Step 7: Commit**

```bash
git add plugins/plugin-interactions pnpm-lock.yaml
git commit -m "feat(interactions): provide activity renderers"
```

### Task 6: Load classic chapters and game settings in Studio

**Files:**

- Create: `apps/studio/src/utils/projectRuntimeFiles.ts`
- Create: `apps/studio/src/__tests__/projectRuntimeFiles.test.ts`
- Modify: `apps/studio/src/composables/useProjectContent.ts`
- Modify: `apps/studio/src/composables/useStudioAdvConfig.ts`
- Modify: `apps/studio/src/views/PlayPage.vue`

**Interfaces:**

- Produces: `discoverRuntimeChapterFiles(fs)` and `loadStudioGameSettings(fs)`.
- Settings path: `adv/settings/game.json`.

- [ ] **Step 1: Write MemoryFs tests for both layouts and settings**

```ts
await fs.writeFile('public/md/chapters/1/intro.adv.md', '@观测者\n你好')
await fs.writeFile('adv/settings/game.json', JSON.stringify({
  title: '仓鼠：星海回声',
  variables: { curiosity: 0 },
  requiredPlugins: { 'star-map': '1.0.0' },
}))

expect(await discoverRuntimeChapterFiles(fs)).toEqual([
  'public/md/chapters/1/intro.adv.md',
])
expect(await loadStudioGameSettings(fs)).toMatchObject({
  title: '仓鼠：星海回声',
  variables: { curiosity: 0 },
})
```

Also assert that `adv/chapters` wins when both layouts exist.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm --filter @advjs/studio test:unit -- src/__tests__/projectRuntimeFiles.test.ts`

Expected: FAIL because helpers do not exist.

- [ ] **Step 3: Implement deterministic discovery**

Try roots in order: `adv/chapters`, root `adv`, `public/md/chapters`, root `public/md`. Deduplicate and lexicographically sort `.adv.md` paths. Stop after the first root group containing scripts so a project never loads mirrored copies.

Parse settings as `Partial<Pick<AdvGameConfig, 'title' | 'description' | 'variables' | 'requiredPlugins'>>`; reject arrays/non-object roots with `ADV_STUDIO_INVALID_GAME_SETTINGS` and return `{}` only for file-not-found.

- [ ] **Step 4: Reuse helpers from composables**

Replace the duplicated chapter scans in `useProjectContent.loadFromFs` and `PlayPage.loadChapters`. In `useStudioAdvConfig.buildGameConfig`, merge settings title/description/variables/requiredPlugins into generated characters/scenes/chapters without allowing settings to overwrite the generated content arrays.

- [ ] **Step 5: Run tests**

Run: `pnpm --filter @advjs/studio test:unit -- src/__tests__/projectRuntimeFiles.test.ts src/__tests__/projectValidation.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/studio/src/utils/projectRuntimeFiles.ts apps/studio/src/__tests__/projectRuntimeFiles.test.ts apps/studio/src/composables/useProjectContent.ts apps/studio/src/composables/useStudioAdvConfig.ts apps/studio/src/views/PlayPage.vue
git commit -m "feat(studio): load classic runtime projects"
```

### Task 7: Install trusted official runtime plugins in Studio

**Files:**

- Create: `apps/studio/src/utils/studioRuntimePlugins.ts`
- Create: `apps/studio/src/__tests__/studioRuntimePlugins.test.ts`
- Modify: `apps/studio/src/components/GamePlayer.vue`
- Modify: `apps/studio/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**

- Produces: `createStudioRuntimePlugins(): AdvClientRuntimePlugin[]`.
- Supports only bundled `star-map@1.0.0` and `civilization@1.0.0` in this milestone.

- [ ] **Step 1: Write resolver tests**

Assert the returned list contains both plugin names, both activity handlers, and renderer keys `star-map/compare` and `civilization/initialize`. Assert the list contains no dynamic import derived from project content.

- [ ] **Step 2: Run tests and verify RED**

Run: `pnpm --filter @advjs/studio test:unit -- src/__tests__/studioRuntimePlugins.test.ts`

Expected: FAIL because the trusted registry does not exist.

- [ ] **Step 3: Implement an explicit registry**

Add `@advjs/plugin-interactions: workspace:*` to Studio dependencies before
importing it:

```ts
import type { AdvClientRuntimePlugin } from '@advjs/client'
import { civilization, starMap } from '@advjs/plugin-interactions'
import CivilizationActivity from '@advjs/plugin-interactions/client/CivilizationActivity.vue'
import StarMapActivity from '@advjs/plugin-interactions/client/StarMapActivity.vue'

export function createStudioRuntimePlugins(): AdvClientRuntimePlugin[] {
  return [
    Object.assign(starMap(), {
      activityRenderers: { 'star-map/compare': StarMapActivity },
    }),
    Object.assign(civilization(), {
      activityRenderers: { 'civilization/initialize': CivilizationActivity },
    }),
  ]
}
```

- [ ] **Step 4: Pass plugins into Studio GamePlayer**

Create the list once in `GamePlayer.vue` and pass it to `setupAdvContext({ runtimePlugins })`. Do not populate `AdvConfig.plugins` with executable values; it remains authoring/config data.

- [ ] **Step 5: Run focused tests, Studio typecheck, and build**

Run: `pnpm --filter @advjs/studio test:unit -- src/__tests__/studioRuntimePlugins.test.ts && pnpm --filter @advjs/studio build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/studio plugins/plugin-interactions/package.json pnpm-lock.yaml
git commit -m "feat(studio): support official runtime plugins"
```

### Task 8: Document and verify the foundation

**Files:**

- Modify: `docs/guide/runtime/plugins-and-activities.md`
- Modify: `docs/guide/studio/architecture.md`
- Test: existing focused suites.

**Interfaces:**

- Documents production fallback, raw SFC packaging, trusted Studio allowlist, and `adv/settings/game.json`.

- [ ] **Step 1: Add exact authoring examples**

Document the renderer metadata emitted by `starMap()` and this Studio settings file:

```json
{
  "title": "仓鼠：星海回声",
  "variables": { "curiosity": 0, "starMatched": false },
  "requiredPlugins": { "star-map": "1.0.0", "civilization": "1.0.0" }
}
```

State that Studio only executes bundled allowlisted plugins; CLI/Vite projects continue loading plugins from their own trusted config.

- [ ] **Step 2: Run final verification**

Run:

```bash
pnpm vitest run tests/unit/runtime-plugin-virtual.test.ts tests/unit/client-activity-renderers.test.ts tests/unit/component.test.ts plugins/plugin-interactions/test
pnpm --filter @advjs/studio test:unit -- src/__tests__/projectRuntimeFiles.test.ts src/__tests__/studioRuntimePlugins.test.ts
pnpm --filter @advjs/plugin-interactions build
pnpm --filter @advjs/studio build
pnpm typecheck
```

Expected: all commands exit 0.

- [ ] **Step 3: Commit**

```bash
git add docs/guide/runtime/plugins-and-activities.md docs/guide/studio/architecture.md
git commit -m "docs(runtime): explain activity renderers"
```
