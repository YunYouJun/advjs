# Unified Runtime Foundation Implementation Plan

**Status:** Completed on 2026-07-16. Focused tests, repository typecheck/lint, and `pnpm build:advjs` passed.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the versioned pure-data RuntimeProgram contract, deterministic ADV runtime, Markdown compiler, and cross-environment conformance suite that all later browser and CLI migrations depend on.

**Architecture:** `@advjs/types` owns JSON-only runtime contracts. `@advjs/core/compiler` converts hydrated authoring input into a linked RuntimeProgram with stable diagnostics and a SHA-256 semantic hash. `@advjs/core/runtime` advances immutable RuntimeState through built-in narrative and stage nodes; browser and Node consumers receive the same state/effects through a small `createAdvRuntime()` facade.

**Tech Stack:** TypeScript 5.9, Vitest, `@advjs/types`, `@advjs/parser`, `@advjs/core`, Vue/Vite browser-bundle regression tests, pnpm workspaces.

## Global Constraints

- Use pnpm only; the repository rejects npm and Yarn installs.
- Support Node.js `^20.19.0 || >=22.12.0`.
- Keep TypeScript strict mode and `verbatimModuleSyntax` valid.
- Do not add XState or another state-machine dependency.
- Do not use `eval`, `new Function`, executable strings, classes, functions, Vue refs, Maps, Sets, DOM nodes, or platform objects in RuntimeProgram or RuntimeState.
- Every Program and State value must survive `JSON.stringify` → `JSON.parse` without custom serialization.
- Runtime state transitions must be deterministic for the same Program, State, and command.
- Node and browser code paths must not import `node:*` modules from the published runtime bundle.
- This is a breaking runtime line; do not add a compatibility adapter that preserves `$adv.$logic` or `$adv.$nav` semantics.
- Follow TDD for every behavior: add one failing test, verify the expected failure, implement the minimum behavior, verify green, then refactor.
- Use Conventional Commits with the repository's allowed types.

## Plan Series

This specification is delivered as four reviewable implementation plans:

1. **Runtime foundation** — this plan: data contracts, compiler/linker, deterministic runtime, facade, conformance tests, foundation docs.
2. **Host migration, navigation, and persistence** — migrate CLI/client/Studio playback, add stable Markdown anchors and cross-chapter targets, then replace both save systems with RuntimeSnapshot/checkpoints.
3. **Logic and plugins** — variables, restricted expression parser, built-in actions, Vite-style plugin API, node/action/activity registries, removal of `new Function`.
4. **Demo, tools, and public documentation** — star-map/civilization activities, hamster Demo, Parser Playground/Studio inspectors, CLI traces/checks, migration/API/debug docs, old runtime deletion.

Plan 2 starts only after this plan's exported contracts and conformance trace are reviewed, so later plans cannot silently redefine the foundation.

## File Structure

New files are split by responsibility:

- `packages/types/src/runtime/json.ts` — JSON-only value types.
- `packages/types/src/runtime/program.ts` — RuntimeProgram, address, chapter, node, choice, and effect contracts.
- `packages/types/src/runtime/state.ts` — RuntimeState, stage, status, and update contracts.
- `packages/types/src/runtime/index.ts` — runtime type exports.
- `packages/core/src/compiler/types.ts` — compile inputs, diagnostics, and results.
- `packages/core/src/compiler/hash.ts` — canonical JSON and browser-safe SHA-256 hashing.
- `packages/core/src/compiler/link.ts` — chapter/node indexing and address validation.
- `packages/core/src/compiler/markdown.ts` — Markdown AST to Program input conversion.
- `packages/core/src/compiler/index.ts` — compiler exports.
- `packages/core/src/runtime/state.ts` — initial state and node lookup.
- `packages/core/src/runtime/transition.ts` — pure command-to-state transition.
- `packages/core/src/runtime/create.ts` — small public runtime instance API and subscriptions.
- `packages/core/src/runtime/index.ts` — runtime exports.
- `packages/core/test/runtime/*.test.ts` — focused compiler/runtime contract tests.
- `packages/core/test/fixtures/runtime-program.ts` — one shared deterministic conformance fixture.

Existing `packages/core/src/engine/*` remains untouched until Plan 2 migrates its consumers; no new code may import it.

---

### Task 1: Define JSON-only runtime contracts

**Files:**

- Create: `packages/types/src/runtime/json.ts`
- Create: `packages/types/src/runtime/program.ts`
- Create: `packages/types/src/runtime/state.ts`
- Create: `packages/types/src/runtime/index.ts`
- Modify: `packages/types/src/index.ts`
- Test: `packages/core/test/runtime/contracts.test.ts`

**Interfaces:**

- Consumes: no new interfaces.
- Produces: `JsonValue`, `JsonObject`, `RuntimeAddress`, `RuntimeChoice`, `RuntimeChoiceRecord`, `RuntimeNode`, `RuntimeChapter`, `RuntimeProgram`, `RuntimeEffect`, `RuntimeStatus`, `RuntimeStageState`, `RuntimeState`, `RuntimeUpdate` from `@advjs/types`.

- [ ] **Step 1: Write the failing type-contract test**

Create `packages/core/test/runtime/contracts.test.ts`:

```ts
import type {
  JsonObject,
  RuntimeAddress,
  RuntimeChoiceRecord,
  RuntimeProgram,
  RuntimeState,
  RuntimeUpdate,
} from '@advjs/types'
import { RUNTIME_SCHEMA_VERSION } from '@advjs/types'
import { describe, expect, expectTypeOf, it } from 'vitest'

describe('runtime contracts', () => {
  it('exposes versioned JSON-only program and state shapes', () => {
    expect(RUNTIME_SCHEMA_VERSION).toBe(1)
    expectTypeOf<RuntimeProgram['schemaVersion']>().toEqualTypeOf<1>()
    expectTypeOf<RuntimeProgram['entry']>().toEqualTypeOf<RuntimeAddress>()
    expectTypeOf<RuntimeState['variables']>().toEqualTypeOf<JsonObject>()
    expectTypeOf<RuntimeState['choices']>().toEqualTypeOf<RuntimeChoiceRecord[]>()
    expectTypeOf<RuntimeUpdate['effects']>().toBeArray()
  })
})
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm vitest run packages/core/test/runtime/contracts.test.ts
```

Expected: FAIL because `@advjs/types` does not export the runtime value and contracts yet.

- [ ] **Step 3: Add the JSON value types**

Create `packages/types/src/runtime/json.ts`:

```ts
export type JsonPrimitive = null | boolean | number | string

export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject

export interface JsonObject {
  [key: string]: JsonValue
}
```

- [ ] **Step 4: Add the Program contracts**

Create `packages/types/src/runtime/program.ts`:

```ts
import type { JsonObject, JsonValue } from './json'

export const RUNTIME_SCHEMA_VERSION = 1 as const

export interface RuntimeAddress {
  chapterId: string
  nodeId: string
}

export interface RuntimeChoice {
  id: string
  label: string
  target?: RuntimeAddress
}

export interface RuntimeNode {
  id: string
  kind: string
  data?: JsonObject
  next?: RuntimeAddress
}

export interface RuntimeChapter {
  id: string
  title?: string
  entry: string
  order: string[]
  nodes: Record<string, RuntimeNode>
}

export interface RuntimeProgram {
  schemaVersion: typeof RUNTIME_SCHEMA_VERSION
  id: string
  hash: string
  entry: RuntimeAddress
  chapters: Record<string, RuntimeChapter>
  requiredPlugins: Record<string, string>
}

export interface RuntimeEffect {
  type: string
  payload?: JsonValue
}
```

- [ ] **Step 5: Add State contracts and exports**

Create `packages/types/src/runtime/state.ts`:

```ts
import type { JsonObject } from './json'
import type { RuntimeAddress, RuntimeEffect } from './program'

export type RuntimeStatus
  = | 'idle'
    | 'playing'
    | 'waiting-choice'
    | 'waiting-activity'
    | 'ended'
    | 'error'

export interface RuntimeTachieState {
  status: string
}

export interface RuntimeStageState {
  background: string
  bgm: string
  tachies: Record<string, RuntimeTachieState>
}

export interface RuntimeErrorData {
  code: string
  message: string
}

export interface RuntimeChoiceRecord {
  node: RuntimeAddress
  choiceId: string
}

export interface RuntimeState {
  status: RuntimeStatus
  cursor: RuntimeAddress
  variables: JsonObject
  stage: RuntimeStageState
  choices: RuntimeChoiceRecord[]
  visited: string[]
  error?: RuntimeErrorData
}

export interface RuntimeUpdate {
  state: RuntimeState
  effects: RuntimeEffect[]
}
```

Create `packages/types/src/runtime/index.ts`:

```ts
export * from './json'
export * from './program'
export * from './state'
```

Add this export to `packages/types/src/index.ts`:

```ts
export * from './runtime'
```

- [ ] **Step 6: Verify GREEN and typecheck the package**

Run:

```bash
pnpm vitest run packages/core/test/runtime/contracts.test.ts
pnpm --filter @advjs/types build
```

Expected: the contract test passes and `@advjs/types` builds with declarations.

- [ ] **Step 7: Commit the contract**

```bash
git add packages/types/src/runtime packages/types/src/index.ts packages/core/test/runtime/contracts.test.ts
git commit -m "feat(types): add runtime data contracts"
```

---

### Task 2: Build the deterministic Program linker and diagnostics

**Files:**

- Create: `packages/core/src/compiler/types.ts`
- Create: `packages/core/src/compiler/hash.ts`
- Create: `packages/core/src/compiler/link.ts`
- Create: `packages/core/src/compiler/index.ts`
- Test: `packages/core/test/runtime/link.test.ts`

**Interfaces:**

- Consumes: `JsonValue`, `RuntimeAddress`, `RuntimeNode`, `RuntimeProgram` from Task 1.
- Produces: `RuntimeProgramInput`, `RuntimeChapterInput`, `CompileDiagnostic`, `CompileResult<T>`, `hashRuntimeProgram()`, `linkRuntimeProgram()`.

- [ ] **Step 1: Write failing linker tests**

Create `packages/core/test/runtime/link.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { linkRuntimeProgram } from '../../src/compiler'

describe('linkRuntimeProgram', () => {
  it('indexes chapters and produces a stable semantic hash', async () => {
    const input = {
      id: 'demo',
      entry: { chapterId: 'chapter-1', nodeId: 'start' },
      chapters: [{
        id: 'chapter-1',
        entry: 'start',
        nodes: [
          { id: 'start', kind: 'text', data: { text: 'hello' }, next: { chapterId: 'chapter-1', nodeId: 'end' } },
          { id: 'end', kind: 'end' },
        ],
      }],
      requiredPlugins: {},
    }

    const first = await linkRuntimeProgram(input)
    const second = await linkRuntimeProgram(input)

    expect(first.diagnostics).toEqual([])
    expect(first.program?.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(second.program?.hash).toBe(first.program?.hash)
    expect(first.program?.chapters['chapter-1'].nodes.start.kind).toBe('text')
  })

  it('reports duplicate ids and unresolved addresses without emitting a program', async () => {
    const result = await linkRuntimeProgram({
      id: 'broken',
      entry: { chapterId: 'missing', nodeId: 'start' },
      chapters: [
        { id: 'chapter-1', entry: 'start', nodes: [{ id: 'start', kind: 'text' }] },
        { id: 'chapter-1', entry: 'other', nodes: [{ id: 'other', kind: 'end' }] },
      ],
      requiredPlugins: {},
    })

    expect(result.program).toBeUndefined()
    expect(result.diagnostics.map(item => item.code)).toEqual([
      'ADV_RUNTIME_DUPLICATE_CHAPTER',
      'ADV_RUNTIME_UNKNOWN_ENTRY',
    ])
  })

  it('rejects a node next address that does not exist', async () => {
    const result = await linkRuntimeProgram({
      id: 'broken-next',
      entry: { chapterId: 'chapter-1', nodeId: 'start' },
      chapters: [{
        id: 'chapter-1',
        entry: 'start',
        nodes: [{
          id: 'start',
          kind: 'text',
          next: { chapterId: 'chapter-1', nodeId: 'missing' },
        }],
      }],
    })

    expect(result.diagnostics[0]?.code).toBe('ADV_RUNTIME_UNKNOWN_TARGET')
  })
})
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
pnpm vitest run packages/core/test/runtime/link.test.ts
```

Expected: FAIL because `packages/core/src/compiler` does not exist.

- [ ] **Step 3: Define compile inputs and diagnostics**

Create `packages/core/src/compiler/types.ts`:

```ts
import type { RuntimeAddress, RuntimeNode } from '@advjs/types'

export interface CompileSourceLocation {
  file?: string
  line?: number
  column?: number
}

export interface CompileDiagnostic {
  code: string
  severity: 'error' | 'warning'
  message: string
  source?: CompileSourceLocation
}

export interface CompileResult<T> {
  program?: T
  diagnostics: CompileDiagnostic[]
}

export interface RuntimeChapterInput {
  id: string
  title?: string
  entry: string
  nodes: RuntimeNode[]
}

export interface RuntimeProgramInput {
  id: string
  entry: RuntimeAddress
  chapters: RuntimeChapterInput[]
  requiredPlugins?: Record<string, string>
}
```

- [ ] **Step 4: Implement canonical SHA-256 hashing**

Create `packages/core/src/compiler/hash.ts`:

```ts
import type { JsonValue, RuntimeProgram } from '@advjs/types'

function sortJson(value: JsonValue): JsonValue {
  if (Array.isArray(value))
    return value.map(sortJson)

  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortJson(child)]),
    )
  }

  return value
}

export async function hashRuntimeProgram(program: Omit<RuntimeProgram, 'hash'>): Promise<string> {
  const jsonValue = JSON.parse(JSON.stringify(program)) as JsonValue
  const canonical = JSON.stringify(sortJson(jsonValue))
  const bytes = new TextEncoder().encode(canonical)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}
```

- [ ] **Step 5: Implement exact indexing and address validation**

Create `packages/core/src/compiler/link.ts`:

```ts
import type { RuntimeChapter, RuntimeProgram } from '@advjs/types'
import type { CompileDiagnostic, CompileResult, RuntimeProgramInput } from './types'
import { RUNTIME_SCHEMA_VERSION } from '@advjs/types'
import { hashRuntimeProgram } from './hash'

function error(code: string, message: string): CompileDiagnostic {
  return { code, severity: 'error', message }
}

export async function linkRuntimeProgram(input: RuntimeProgramInput): Promise<CompileResult<RuntimeProgram>> {
  const diagnostics: CompileDiagnostic[] = []
  const chapters: Record<string, RuntimeChapter> = {}

  for (const chapterInput of input.chapters) {
    if (chapters[chapterInput.id]) {
      diagnostics.push(error(
        'ADV_RUNTIME_DUPLICATE_CHAPTER',
        `Duplicate chapter id: ${chapterInput.id}`,
      ))
      continue
    }

    const nodes = Object.create(null) as RuntimeChapter['nodes']
    const order: string[] = []
    for (const node of chapterInput.nodes) {
      if (nodes[node.id]) {
        diagnostics.push(error(
          'ADV_RUNTIME_DUPLICATE_NODE',
          `Duplicate node id in ${chapterInput.id}: ${node.id}`,
        ))
        continue
      }
      nodes[node.id] = node
      order.push(node.id)
    }

    chapters[chapterInput.id] = {
      id: chapterInput.id,
      title: chapterInput.title,
      entry: chapterInput.entry,
      nodes,
      order,
    }
  }

  const hasAddress = (chapterId: string, nodeId: string) => Boolean(chapters[chapterId]?.nodes[nodeId])

  if (!hasAddress(input.entry.chapterId, input.entry.nodeId)) {
    diagnostics.push(error(
      'ADV_RUNTIME_UNKNOWN_ENTRY',
      `Unknown program entry: ${input.entry.chapterId}#${input.entry.nodeId}`,
    ))
  }

  for (const chapter of Object.values(chapters)) {
    if (!chapter.nodes[chapter.entry]) {
      diagnostics.push(error(
        'ADV_RUNTIME_UNKNOWN_CHAPTER_ENTRY',
        `Unknown entry for ${chapter.id}: ${chapter.entry}`,
      ))
    }

    for (const node of Object.values(chapter.nodes)) {
      if (node.next && !hasAddress(node.next.chapterId, node.next.nodeId)) {
        diagnostics.push(error(
          'ADV_RUNTIME_UNKNOWN_TARGET',
          `Unknown target from ${chapter.id}#${node.id}: ${node.next.chapterId}#${node.next.nodeId}`,
        ))
      }
    }
  }

  if (diagnostics.some(item => item.severity === 'error'))
    return { diagnostics }

  const withoutHash: Omit<RuntimeProgram, 'hash'> = {
    schemaVersion: RUNTIME_SCHEMA_VERSION,
    id: input.id,
    entry: input.entry,
    chapters,
    requiredPlugins: input.requiredPlugins ?? {},
  }
  const hash = await hashRuntimeProgram(withoutHash)

  return {
    program: { ...withoutHash, hash },
    diagnostics,
  }
}
```

Create `packages/core/src/compiler/index.ts`:

```ts
export { hashRuntimeProgram } from './hash'
export { linkRuntimeProgram } from './link'
export type {
  CompileDiagnostic,
  CompileResult,
  CompileSourceLocation,
  RuntimeChapterInput,
  RuntimeProgramInput,
} from './types'
```

- [ ] **Step 6: Verify GREEN**

Run:

```bash
pnpm vitest run packages/core/test/runtime/link.test.ts
```

Expected: all three linker tests pass.

- [ ] **Step 7: Commit the linker**

```bash
git add packages/core/src/compiler packages/core/test/runtime/link.test.ts
git commit -m "feat(core): add runtime program linker"
```

---

### Task 3: Compile Markdown chapters into RuntimeProgram

**Files:**

- Create: `packages/core/src/compiler/markdown.ts`
- Modify: `packages/core/src/compiler/index.ts`
- Test: `packages/core/test/runtime/markdown-compiler.test.ts`

**Interfaces:**

- Consumes: `parseAst(content)` from `@advjs/parser`, `linkRuntimeProgram()` from Task 2.
- Produces: `MarkdownChapterSource`, `MarkdownProgramSource`, `compileMarkdownProgram()`.

- [ ] **Step 1: Write the failing Markdown compiler test**

Create `packages/core/test/runtime/markdown-compiler.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { compileMarkdownProgram } from '../../src/compiler'

const chapter = `---
title: Runtime Demo
---

\`\`\`yaml
type: background
url: observatory.webp
\`\`\`

@我(smile)
星图已经展开。

- 继续观察
- 返回舱室
`

describe('compileMarkdownProgram', () => {
  it('normalizes narrative, choices, and code operations', async () => {
    const result = await compileMarkdownProgram({
      id: 'demo',
      chapters: [{ id: 'chapter-1', title: '第一章', content: chapter }],
    })

    expect(result.diagnostics).toEqual([])
    const runtimeChapter = result.program?.chapters['chapter-1']
    expect(runtimeChapter?.order.map(id => runtimeChapter.nodes[id].kind)).toEqual([
      'effects',
      'dialog',
      'choices',
      'end',
    ])
    expect(runtimeChapter?.nodes['node-0'].next).toEqual({
      chapterId: 'chapter-1',
      nodeId: 'node-1',
    })
  })

  it('rejects executable script blocks instead of compiling code strings', async () => {
    const result = await compileMarkdownProgram({
      id: 'unsafe',
      chapters: [{
        id: 'chapter-1',
        content: `\`\`\`js\nwindow.alert('unsafe')\n\`\`\``,
      }],
    })

    expect(result.program).toBeUndefined()
    expect(result.diagnostics[0]?.code).toBe('ADV_RUNTIME_EXECUTABLE_SCRIPT')
  })

  it('rejects executable choice actions before they reach the runtime', async () => {
    const result = await compileMarkdownProgram({
      id: 'unsafe-choice',
      chapters: [{
        id: 'chapter-1',
        content: `- Run\n\n  \`\`\`js\n  window.alert('unsafe')\n  \`\`\``,
      }],
    })

    expect(result.program).toBeUndefined()
    expect(result.diagnostics[0]?.code).toBe('ADV_RUNTIME_CHOICE_LINK_REQUIRED')
  })
})
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm vitest run packages/core/test/runtime/markdown-compiler.test.ts
```

Expected: FAIL because `compileMarkdownProgram` is not exported.

- [ ] **Step 3: Implement AST text extraction and node normalization**

Create `packages/core/src/compiler/markdown.ts`:

```ts
import type { AdvAst, JsonValue, RuntimeNode, RuntimeProgram } from '@advjs/types'
import type { CompileDiagnostic, CompileResult, RuntimeChapterInput } from './types'
import { parseAst } from '@advjs/parser'
import { linkRuntimeProgram } from './link'

export interface MarkdownChapterSource {
  id: string
  title?: string
  content: string
  sourcePath?: string
}

export interface MarkdownProgramSource {
  id: string
  chapters: MarkdownChapterSource[]
  requiredPlugins?: Record<string, string>
}

function phrasingText(children: Array<AdvAst.PhrasingContent | AdvAst.Dialog>): string {
  return children.map((child) => {
    if ('value' in child)
      return String(child.value)
    return phrasingText(child.children)
  }).join('')
}

function json(value: unknown): JsonValue {
  return JSON.parse(JSON.stringify(value)) as JsonValue
}

function compileNode(node: AdvAst.Child, id: string, diagnostics: CompileDiagnostic[], sourcePath?: string): RuntimeNode | null {
  switch (node.type) {
    case 'dialog':
      return {
        id,
        kind: 'dialog',
        data: {
          character: node.character.name,
          status: node.character.status ?? '',
          text: phrasingText(node.children),
        },
      }
    case 'narration':
      return { id, kind: 'narration', data: { text: node.children.join('\n') } }
    case 'text':
      return { id, kind: 'text', data: { text: node.value } }
    case 'paragraph': {
      const text = phrasingText(node.children)
      return text.trim() ? { id, kind: 'text', data: { text } } : null
    }
    case 'scene':
      return {
        id,
        kind: 'scene',
        data: {
          place: node.place,
          time: node.time,
          inOrOut: node.inOrOut,
        },
      }
    case 'choices': {
      const hasExecutableChoice = node.choices.some(choice => Boolean(choice.target || choice.do?.value))
      if (hasExecutableChoice) {
        diagnostics.push({
          code: 'ADV_RUNTIME_CHOICE_LINK_REQUIRED',
          severity: 'error',
          message: 'Choice targets and actions must be linked before RuntimeProgram execution',
          source: sourcePath ? { file: sourcePath } : undefined,
        })
      }
      return {
        id,
        kind: 'choices',
        data: {
          options: node.choices.map((choice, index) => ({
            id: `choice-${index + 1}`,
            label: choice.text,
          })),
        },
      }
    }
    case 'code':
      if (typeof node.value === 'string') {
        diagnostics.push({
          code: 'ADV_RUNTIME_EXECUTABLE_SCRIPT',
          severity: 'error',
          message: 'Executable script blocks are not supported by RuntimeProgram',
          source: sourcePath ? { file: sourcePath } : undefined,
        })
        return null
      }
      return node.value?.length
        ? { id, kind: 'effects', data: { operations: json(node.value) } }
        : null
    default:
      return null
  }
}

export async function compileMarkdownProgram(source: MarkdownProgramSource): Promise<CompileResult<RuntimeProgram>> {
  const diagnostics: CompileDiagnostic[] = []
  const chapters: RuntimeChapterInput[] = []

  for (const chapterSource of source.chapters) {
    const ast = await parseAst(chapterSource.content)
    const nodes = ast.children
      .map((node, index) => compileNode(node, `node-${index}`, diagnostics, chapterSource.sourcePath))
      .filter((node): node is RuntimeNode => node !== null)

    nodes.push({ id: 'end', kind: 'end' })
    nodes.forEach((node, index) => {
      const next = nodes[index + 1]
      if (next)
        node.next = { chapterId: chapterSource.id, nodeId: next.id }
    })

    chapters.push({
      id: chapterSource.id,
      title: chapterSource.title,
      entry: nodes[0].id,
      nodes,
    })
  }

  if (diagnostics.some(item => item.severity === 'error'))
    return { diagnostics }

  const firstChapter = chapters[0]
  if (!firstChapter) {
    return {
      diagnostics: [{
        code: 'ADV_RUNTIME_NO_CHAPTERS',
        severity: 'error',
        message: 'RuntimeProgram requires at least one chapter',
      }],
    }
  }

  const linked = await linkRuntimeProgram({
    id: source.id,
    entry: { chapterId: firstChapter.id, nodeId: firstChapter.entry },
    chapters,
    requiredPlugins: source.requiredPlugins,
  })
  return {
    program: linked.program,
    diagnostics: [...diagnostics, ...linked.diagnostics],
  }
}
```

Add to `packages/core/src/compiler/index.ts`:

```ts
export { compileMarkdownProgram } from './markdown'
export type { MarkdownChapterSource, MarkdownProgramSource } from './markdown'
```

- [ ] **Step 4: Verify GREEN**

Run:

```bash
pnpm vitest run packages/core/test/runtime/markdown-compiler.test.ts packages/core/test/runtime/link.test.ts
```

Expected: all compiler tests pass.

- [ ] **Step 5: Commit the Markdown compiler**

```bash
git add packages/core/src/compiler packages/core/test/runtime/markdown-compiler.test.ts
git commit -m "feat(core): compile markdown runtime programs"
```

---

### Task 4: Implement the pure runtime transition

**Files:**

- Create: `packages/core/src/runtime/state.ts`
- Create: `packages/core/src/runtime/transition.ts`
- Test: `packages/core/test/runtime/transition.test.ts`

**Interfaces:**

- Consumes: RuntimeProgram/State/Update contracts from Task 1.
- Produces: internal `RuntimeCommand`, `createInitialRuntimeState()`, `getRuntimeNode()`, `transitionRuntime()`.

- [ ] **Step 1: Write failing transition tests**

Create `packages/core/test/runtime/transition.test.ts`:

```ts
import type { RuntimeProgram } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { createInitialRuntimeState, transitionRuntime } from '../../src/runtime/transition'

const program: RuntimeProgram = {
  schemaVersion: 1,
  id: 'transition-test',
  hash: 'test',
  entry: { chapterId: 'chapter-1', nodeId: 'background' },
  requiredPlugins: {},
  chapters: {
    'chapter-1': {
      id: 'chapter-1',
      entry: 'background',
      order: ['background', 'dialog', 'choices', 'end'],
      nodes: {
        background: {
          id: 'background',
          kind: 'effects',
          data: { operations: [{ type: 'background', url: 'stars.webp' }] },
          next: { chapterId: 'chapter-1', nodeId: 'dialog' },
        },
        dialog: {
          id: 'dialog',
          kind: 'dialog',
          data: { character: '我', text: '看见星图了。' },
          next: { chapterId: 'chapter-1', nodeId: 'choices' },
        },
        choices: {
          id: 'choices',
          kind: 'choices',
          data: { options: [{ id: 'continue', label: '继续' }] },
          next: { chapterId: 'chapter-1', nodeId: 'end' },
        },
        end: { id: 'end', kind: 'end' },
      },
    },
  },
}

describe('transitionRuntime', () => {
  it('processes silent stage nodes before pausing on content', () => {
    const initial = createInitialRuntimeState(program)
    const update = transitionRuntime(program, initial, { type: 'start' })

    expect(update.state.cursor.nodeId).toBe('dialog')
    expect(update.state.stage.background).toBe('stars.webp')
    expect(update.effects).toContainEqual({
      type: 'stage.background',
      payload: { url: 'stars.webp' },
    })
  })

  it('waits for a choice and records the selected option', () => {
    const started = transitionRuntime(program, createInitialRuntimeState(program), { type: 'start' })
    const choices = transitionRuntime(program, started.state, { type: 'next' })
    const ended = transitionRuntime(program, choices.state, { type: 'choose', choiceId: 'continue' })

    expect(choices.state.status).toBe('waiting-choice')
    expect(ended.state.choices).toContainEqual({
      node: { chapterId: 'chapter-1', nodeId: 'choices' },
      choiceId: 'continue',
    })
    expect(ended.state.status).toBe('ended')
  })

  it('stops a cycle of silent nodes with a structured error', () => {
    const loopProgram: RuntimeProgram = {
      schemaVersion: 1,
      id: 'silent-loop',
      hash: 'silent-loop',
      entry: { chapterId: 'chapter-1', nodeId: 'loop' },
      requiredPlugins: {},
      chapters: {
        'chapter-1': {
          id: 'chapter-1',
          entry: 'loop',
          order: ['loop'],
          nodes: {
            loop: {
              id: 'loop',
              kind: 'effects',
              data: { operations: [] },
              next: { chapterId: 'chapter-1', nodeId: 'loop' },
            },
          },
        },
      },
    }

    const update = transitionRuntime(
      loopProgram,
      createInitialRuntimeState(loopProgram),
      { type: 'start' },
    )

    expect(update.state.error?.code).toBe('ADV_RUNTIME_SILENT_LOOP')
  })
})
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm vitest run packages/core/test/runtime/transition.test.ts
```

Expected: FAIL because the runtime transition module does not exist.

- [ ] **Step 3: Implement initial state and node lookup**

Create `packages/core/src/runtime/state.ts`:

```ts
import type { JsonObject, RuntimeAddress, RuntimeNode, RuntimeProgram, RuntimeState } from '@advjs/types'

export function runtimeAddressKey(address: RuntimeAddress): string {
  return `${address.chapterId}#${address.nodeId}`
}

export function getRuntimeNode(program: RuntimeProgram, address: RuntimeAddress): RuntimeNode | undefined {
  return program.chapters[address.chapterId]?.nodes[address.nodeId]
}

export function createInitialRuntimeState(program: RuntimeProgram, variables: JsonObject = {}): RuntimeState {
  return {
    status: 'idle',
    cursor: structuredClone(program.entry),
    variables: structuredClone(variables),
    stage: {
      background: '',
      bgm: '',
      tachies: {},
    },
    choices: [],
    visited: [],
  }
}
```

- [ ] **Step 4: Implement deterministic command transitions**

Create `packages/core/src/runtime/transition.ts`:

```ts
import type {
  JsonObject,
  JsonValue,
  RuntimeAddress,
  RuntimeChoice,
  RuntimeEffect,
  RuntimeProgram,
  RuntimeState,
  RuntimeUpdate,
} from '@advjs/types'
import { createInitialRuntimeState, getRuntimeNode, runtimeAddressKey } from './state'

export type RuntimeCommand
  = | { type: 'start' }
    | { type: 'next' }
    | { type: 'choose', choiceId: string }
    | { type: 'go', target: RuntimeAddress }

interface Operation extends JsonObject {
  type: string
}

function moveToNext(state: RuntimeState, next?: RuntimeAddress): void {
  if (next)
    state.cursor = structuredClone(next)
  else
    state.status = 'ended'
}

function applyOperation(state: RuntimeState, operation: Operation): RuntimeEffect {
  if (operation.type === 'background') {
    const url = String(operation.url ?? operation.name ?? '')
    state.stage.background = url
    return { type: 'stage.background', payload: { url } }
  }

  if (operation.type === 'bgm') {
    const value = operation.stop ? '' : String(operation.name ?? operation.src ?? '')
    state.stage.bgm = value
    return { type: 'stage.bgm', payload: { value } }
  }

  if (operation.type === 'tachie') {
    const enter = Array.isArray(operation.enter) ? operation.enter : [operation.enter]
    for (const item of enter) {
      if (typeof item === 'string') {
        state.stage.tachies[item] = { status: '' }
      }
      else if (item && typeof item === 'object' && !Array.isArray(item)) {
        const name = String(item.name ?? '')
        if (name)
          state.stage.tachies[name] = { status: String(item.status ?? '') }
      }
    }
    const exits = Array.isArray(operation.exit) ? operation.exit : []
    for (const name of exits)
      delete state.stage.tachies[String(name)]
    return { type: 'stage.tachie', payload: structuredClone(operation) }
  }

  return { type: `stage.${operation.type}`, payload: structuredClone(operation) }
}

function enterUntilPause(program: RuntimeProgram, state: RuntimeState): RuntimeUpdate {
  const effects: RuntimeEffect[] = []
  let silentSteps = 0

  while (silentSteps <= 1000) {
    const node = getRuntimeNode(program, state.cursor)
    if (!node) {
      state.status = 'error'
      state.error = {
        code: 'ADV_RUNTIME_NODE_NOT_FOUND',
        message: `Node not found: ${runtimeAddressKey(state.cursor)}`,
      }
      return { state, effects }
    }

    const address = runtimeAddressKey(state.cursor)
    if (!state.visited.includes(address))
      state.visited.push(address)

    if (node.kind === 'effects') {
      const data = node.data as { operations?: JsonValue[] } | undefined
      for (const value of data?.operations ?? []) {
        if (value && typeof value === 'object' && !Array.isArray(value))
          effects.push(applyOperation(state, value as Operation))
      }
      moveToNext(state, node.next)
      if (state.status === 'ended')
        return { state, effects }
      silentSteps++
      continue
    }

    if (node.kind === 'choices')
      state.status = 'waiting-choice'
    else if (node.kind === 'end')
      state.status = 'ended'
    else
      state.status = 'playing'

    return { state, effects }
  }

  state.status = 'error'
  state.error = {
    code: 'ADV_RUNTIME_SILENT_LOOP',
    message: 'Runtime exceeded 1000 consecutive silent nodes',
  }
  return { state, effects }
}

function readChoices(nodeData: JsonValue | undefined): RuntimeChoice[] {
  if (!nodeData || typeof nodeData !== 'object' || Array.isArray(nodeData))
    return []
  const options = nodeData.options
  return Array.isArray(options) ? options as unknown as RuntimeChoice[] : []
}

export function transitionRuntime(program: RuntimeProgram, previous: RuntimeState, command: RuntimeCommand): RuntimeUpdate {
  const state = structuredClone(previous)

  if (command.type === 'start')
    return enterUntilPause(program, state)

  if (command.type === 'go') {
    state.cursor = structuredClone(command.target)
    return enterUntilPause(program, state)
  }

  const current = getRuntimeNode(program, state.cursor)
  if (!current)
    return enterUntilPause(program, state)

  if (command.type === 'next') {
    if (state.status === 'waiting-choice')
      throw new Error('A choice must be selected before advancing')
    moveToNext(state, current.next)
    return state.status === 'ended' ? { state, effects: [] } : enterUntilPause(program, state)
  }

  if (current.kind !== 'choices')
    throw new Error(`Cannot choose from node kind: ${current.kind}`)

  const choice = readChoices(current.data).find(item => item.id === command.choiceId)
  if (!choice)
    throw new Error(`Unknown choice: ${command.choiceId}`)

  state.choices.push({
    node: structuredClone(state.cursor),
    choiceId: choice.id,
  })
  moveToNext(state, choice.target ?? current.next)
  return state.status === 'ended' ? { state, effects: [] } : enterUntilPause(program, state)
}

export { createInitialRuntimeState } from './state'
```

- [ ] **Step 5: Verify GREEN, including silent-loop protection**

Run:

```bash
pnpm vitest run packages/core/test/runtime/transition.test.ts
```

Expected: all three transition tests pass, and the silent loop test returns without hanging.

- [ ] **Step 6: Commit the pure transition**

```bash
git add packages/core/src/runtime packages/core/test/runtime/transition.test.ts
git commit -m "feat(core): add deterministic runtime transition"
```

---

### Task 5: Expose the Pinia-style runtime facade

**Files:**

- Create: `packages/core/src/runtime/create.ts`
- Create: `packages/core/src/runtime/index.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/runtime/create.test.ts`

**Interfaces:**

- Consumes: `createInitialRuntimeState()`, `transitionRuntime()` from Task 4.
- Produces: `AdvRuntime`, `AdvRuntimeOptions`, `RuntimeSubscriber`, `createAdvRuntime()`.

- [ ] **Step 1: Write the failing facade test**

Create `packages/core/test/runtime/create.test.ts`:

```ts
import type { RuntimeEffect, RuntimeProgram, RuntimeState } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { createAdvRuntime } from '../../src/runtime'

const program: RuntimeProgram = {
  schemaVersion: 1,
  id: 'facade',
  hash: 'facade',
  entry: { chapterId: 'chapter-1', nodeId: 'first' },
  requiredPlugins: {},
  chapters: {
    'chapter-1': {
      id: 'chapter-1',
      entry: 'first',
      order: ['first', 'end'],
      nodes: {
        first: {
          id: 'first',
          kind: 'text',
          data: { text: 'hello' },
          next: { chapterId: 'chapter-1', nodeId: 'end' },
        },
        end: { id: 'end', kind: 'end' },
      },
    },
  },
}

describe('createAdvRuntime', () => {
  it('offers a small state/current/action/subscription API', async () => {
    const runtime = createAdvRuntime({ program, initialVariables: { count: 1 } })
    const updates: Array<{
      state: Readonly<RuntimeState>
      effects: readonly RuntimeEffect[]
    }> = []
    const stop = runtime.subscribe((state, effects) => updates.push({ state, effects }))

    await runtime.start()
    expect(runtime.current?.id).toBe('first')
    expect(runtime.state.variables.count).toBe(1)

    const published = await runtime.next()
    published.state.variables.count = 99
    expect(runtime.state.variables.count).toBe(1)

    expect(runtime.state.status).toBe('ended')
    expect(updates).toHaveLength(2)

    stop()
  })
})
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
pnpm vitest run packages/core/test/runtime/create.test.ts
```

Expected: FAIL because `createAdvRuntime` does not exist.

- [ ] **Step 3: Implement the runtime instance**

Create `packages/core/src/runtime/create.ts`:

```ts
import type {
  JsonObject,
  RuntimeAddress,
  RuntimeEffect,
  RuntimeNode,
  RuntimeProgram,
  RuntimeState,
  RuntimeUpdate,
} from '@advjs/types'
import type { RuntimeCommand } from './transition'
import { createInitialRuntimeState, getRuntimeNode } from './state'
import { transitionRuntime } from './transition'

export interface AdvRuntimeOptions {
  program: RuntimeProgram
  initialVariables?: JsonObject
}

export type RuntimeSubscriber = (
  state: Readonly<RuntimeState>,
  effects: readonly RuntimeEffect[],
) => void

export interface AdvRuntime {
  readonly state: Readonly<RuntimeState>
  readonly current: RuntimeNode | undefined
  start: () => Promise<RuntimeUpdate>
  next: () => Promise<RuntimeUpdate>
  choose: (choiceId: string) => Promise<RuntimeUpdate>
  go: (target: RuntimeAddress) => Promise<RuntimeUpdate>
  subscribe: (subscriber: RuntimeSubscriber) => () => void
}

export function createAdvRuntime(options: AdvRuntimeOptions): AdvRuntime {
  const program = structuredClone(options.program)
  let state = createInitialRuntimeState(program, options.initialVariables)
  const subscribers = new Set<RuntimeSubscriber>()

  const dispatch = async (command: RuntimeCommand): Promise<RuntimeUpdate> => {
    const update = transitionRuntime(program, state, command)
    state = update.state
    const published = structuredClone(update)
    for (const subscriber of subscribers) {
      subscriber(
        structuredClone(published.state),
        structuredClone(published.effects),
      )
    }
    return published
  }

  return {
    get state() {
      return structuredClone(state)
    },
    get current() {
      const node = getRuntimeNode(program, state.cursor)
      return node ? structuredClone(node) : undefined
    },
    start: () => dispatch({ type: 'start' }),
    next: () => dispatch({ type: 'next' }),
    choose: choiceId => dispatch({ type: 'choose', choiceId }),
    go: target => dispatch({ type: 'go', target }),
    subscribe(subscriber) {
      subscribers.add(subscriber)
      return () => subscribers.delete(subscriber)
    },
  }
}
```

Create `packages/core/src/runtime/index.ts`:

```ts
export { createAdvRuntime } from './create'
export type { AdvRuntime, AdvRuntimeOptions, RuntimeSubscriber } from './create'
export { createInitialRuntimeState, getRuntimeNode, runtimeAddressKey } from './state'
```

Add to `packages/core/src/index.ts`:

```ts
export * from './compiler'
export * from './runtime'
```

- [ ] **Step 4: Verify GREEN and browser-safe exports**

Run:

```bash
pnpm vitest run packages/core/test/runtime/create.test.ts packages/core/test/runtime/transition.test.ts
pnpm --filter @advjs/core build
```

Expected: facade and transition tests pass; `@advjs/core` builds without export collisions.

- [ ] **Step 5: Commit the facade**

```bash
git add packages/core/src/runtime packages/core/src/index.ts packages/core/test/runtime/create.test.ts
git commit -m "feat(core): expose unified runtime api"
```

---

### Task 6: Add the cross-environment-ready conformance baseline

**Files:**

- Create: `packages/core/test/fixtures/runtime-program.ts`
- Create: `packages/core/test/runtime/conformance.test.ts`
- Modify: `packages/core/test/browser-bundle.test.ts`

**Interfaces:**

- Consumes: `createAdvRuntime()` from Task 5.
- Produces: `runtimeConformanceProgram` fixture and a canonical JSON trace reused by the next plan's actual Browser and CLI adapters.

- [ ] **Step 1: Create the shared conformance fixture**

Create `packages/core/test/fixtures/runtime-program.ts`:

```ts
import type { RuntimeProgram } from '@advjs/types'

export const runtimeConformanceProgram: RuntimeProgram = {
  schemaVersion: 1,
  id: 'conformance',
  hash: 'conformance-v1',
  entry: { chapterId: 'chapter-1', nodeId: 'stage' },
  requiredPlugins: {},
  chapters: {
    'chapter-1': {
      id: 'chapter-1',
      entry: 'stage',
      order: ['stage', 'line', 'choice', 'end'],
      nodes: {
        stage: {
          id: 'stage',
          kind: 'effects',
          data: {
            operations: [
              { type: 'background', url: 'night.webp' },
              { type: 'bgm', name: 'calm-night' },
            ],
          },
          next: { chapterId: 'chapter-1', nodeId: 'line' },
        },
        line: {
          id: 'line',
          kind: 'dialog',
          data: { character: '我', text: '星星正在移动。' },
          next: { chapterId: 'chapter-1', nodeId: 'choice' },
        },
        choice: {
          id: 'choice',
          kind: 'choices',
          data: { options: [{ id: 'observe', label: '继续观察' }] },
          next: { chapterId: 'chapter-1', nodeId: 'end' },
        },
        end: { id: 'end', kind: 'end' },
      },
    },
  },
}
```

- [ ] **Step 2: Write the conformance test using two independent runtime instances**

Create `packages/core/test/runtime/conformance.test.ts`:

```ts
import type { RuntimeUpdate } from '@advjs/types'
import { describe, expect, it } from 'vitest'
import { createAdvRuntime } from '../../src/runtime'
import { runtimeConformanceProgram } from '../fixtures/runtime-program'

async function traceRuntime(): Promise<RuntimeUpdate[]> {
  const runtime = createAdvRuntime({ program: runtimeConformanceProgram })
  return [
    await runtime.start(),
    await runtime.next(),
    await runtime.choose('observe'),
  ]
}

describe('runtime conformance baseline', () => {
  it('produces identical JSON traces for independent runtime instances', async () => {
    const firstTrace = JSON.parse(JSON.stringify(await traceRuntime()))
    const secondTrace = JSON.parse(JSON.stringify(await traceRuntime()))

    expect(firstTrace).toEqual(secondTrace)
    expect(firstTrace.at(-1).state.status).toBe('ended')
  })
})
```

- [ ] **Step 3: Run the conformance test**

Run:

```bash
pnpm vitest run packages/core/test/runtime/conformance.test.ts
```

Expected: PASS with identical plain-JSON traces.

- [ ] **Step 4: Point the browser bundle regression at the public runtime**

In `packages/core/test/browser-bundle.test.ts`, replace the current `entry` and assertions with:

```ts
const buildOptions = {
  lib: {
    entry: path.resolve(import.meta.dirname, '../src/runtime/index.ts'),
    formats: ['es'],
    name: 'AdvJsCoreBrowserTest',
  },
}

// after collecting `code`
expect(code).toContain('createAdvRuntime')
expect(code).not.toContain('__vite-browser-external')
expect(code).not.toContain('node:fs')
expect(code).not.toContain('node:path')
```

- [ ] **Step 5: Run both conformance checks**

Run:

```bash
pnpm vitest run packages/core/test/runtime/conformance.test.ts packages/core/test/browser-bundle.test.ts
```

Expected: both tests pass; Vite emits no Node external shim.

- [ ] **Step 6: Commit the conformance baseline**

```bash
git add packages/core/test/fixtures/runtime-program.ts packages/core/test/runtime/conformance.test.ts packages/core/test/browser-bundle.test.ts
git commit -m "test(core): add runtime conformance baseline"
```

---

### Task 7: Document and verify the foundation release gate

**Files:**

- Modify: `packages/core/README.md`
- Modify: `docs/superpowers/specs/2026-07-16-unified-runtime-design.md`
- Test: all files under `packages/core/test/runtime/`

**Interfaces:**

- Consumes: all public contracts and functions from Tasks 1–6.
- Produces: documented foundation API and a fresh verification record before Plan 2 begins.

- [ ] **Step 1: Add the new API to the core README**

Replace the current headless playback example in `packages/core/README.md` with:

````md
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
````

- [ ] **Step 2: Run the focused runtime suite**

Run:

```bash
pnpm vitest run packages/core/test/runtime packages/core/test/browser-bundle.test.ts packages/core/test/package.test.ts
```

Expected: all runtime, bundle, and package tests pass with zero failures.

- [ ] **Step 3: Run repository type and lint checks**

Run:

```bash
pnpm typecheck
pnpm lint
```

Expected: both commands exit 0. If lint changes formatting, inspect and include only files belonging to this plan.

- [ ] **Step 4: Build the published package chain**

Run:

```bash
pnpm build:advjs
```

Expected: `@advjs/types`, `@advjs/parser`, `@advjs/core`, and `advjs` build in dependency order with exit code 0.

- [ ] **Step 5: Mark the design's foundation phase as implemented**

After Steps 2–4 pass, change the status line in `docs/superpowers/specs/2026-07-16-unified-runtime-design.md` from:

```md
状态：已确认；待实现
```

to:

```md
状态：已确认；运行时基础阶段已实现
```

- [ ] **Step 6: Commit documentation and the verified phase marker**

```bash
git add packages/core/README.md docs/superpowers/specs/2026-07-16-unified-runtime-design.md
git commit -m "docs(runtime): document unified runtime foundation"
```

- [ ] **Step 7: Record the Plan 2 contract handoff**

Before writing Plan 2, review these exact exported contracts and do not rename them without a new design review:

```text
compileMarkdownProgram(source) -> Promise<CompileResult<RuntimeProgram>>
linkRuntimeProgram(input) -> Promise<CompileResult<RuntimeProgram>>
createAdvRuntime({ program, initialVariables? }) -> AdvRuntime
AdvRuntime.start/next/choose/go
AdvRuntime.subscribe((state, effects) => void)
RuntimeProgram.schemaVersion = 1
RuntimeState and RuntimeUpdate are JSON-only
```

Expected: the next plan can migrate `AdvPlayEngine` and `@advjs/client` without introducing a second transition implementation.
