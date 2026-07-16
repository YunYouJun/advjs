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
