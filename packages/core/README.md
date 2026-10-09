# @advjs/core

Core runtime APIs for ADV.JS, including the unified story runtime and session management.

## Unified runtime

Compile authoring content into a versioned, JSON-only program, then execute it through the same runtime in browsers and Node.js:

```ts
import { compileMarkdownProgram, createAdvRuntime } from '@advjs/core'

const source = '@我\n星图已经展开。'

const compiled = await compileMarkdownProgram({
  id: 'story',
  chapters: [{
    id: 'chapter-1',
    content: source,
  }],
})

if (!compiled.program)
  throw new Error(compiled.diagnostics.map(item => item.message).join('\n'))

const runtime = createAdvRuntime({ program: compiled.program })
runtime.subscribe((state, effects) => {
  console.log(state.cursor, effects)
})

await runtime.start()
await runtime.next()
```

`RuntimeProgram`, `RuntimeState`, and emitted effects contain JSON values only. UI rendering, audio, storage, and file access belong to host adapters rather than the state transition.

All modules imported by the published runtime are declared in this package's `dependencies`, so consumers do not need to install implementation dependencies separately.

## Embed the runtime in an existing game

Use `@advjs/core/compiler` in build tools to compile `.adv.md` into JSON. Import
`@advjs/core/runtime` in the player to execute that JSON without loading the
Markdown parser, storage drivers, UI or asset loaders:

Given a compiled `RuntimeProgram` named `program` and the host plugin `gameBridge`:

```ts
import { createAdvRuntime } from '@advjs/core/runtime'

const runtime = createAdvRuntime({ program, plugins: [gameBridge], maxCheckpoints: 0 })
await runtime.start()
```

The host owns rendering, input capture, persistence and game rules. Use activities
to request game operations, then return JSON through `completeActivity()`. Keep
external effects idempotent when restoring activities. The root entry and
`createAdvMarkdownRuntime()` remain available for hosts that compile at runtime.

These subpaths are available in the current workspace; verify the exports in a
published artifact before pinning its version. The lightweight runtime import
does not change the package's installation dependency list. There is no separate
`@advjs/lite` package.

See [Web game embedding](../../docs/guide/runtime/embedding.md) for local setup,
lazy SDK packaging, multi-chapter compilation, independent conversation loading,
a host adapter and save/input boundaries, and
[AI integration](../../docs/ai/web-game-integration.md) for an Agent handoff
contract and a provider-independent NPC activity example. Copyable source lives
in `docs/examples/web-game/` at the repository root.
