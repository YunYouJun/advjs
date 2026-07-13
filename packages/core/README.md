# @advjs/core

Core runtime APIs for ADV.JS, including the headless story player and session management.

## Headless playback

```ts
import { AdvPlayEngine } from '@advjs/core'

const engine = new AdvPlayEngine()
const output = await engine.loadScript(source, 'story.adv.md')

if (output?.type === 'dialog')
  console.log(output.text)
```

Use `next()` and `choose()` to advance the script, `getStatus()` to inspect the current stage, and the session APIs to export or restore progress.

All modules imported by the published runtime are declared in this package's `dependencies`, so consumers do not need to install implementation dependencies separately.
