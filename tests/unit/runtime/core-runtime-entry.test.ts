import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { createAdvRuntime } from '../../../packages/core/src/runtime/headless'

describe('headless core runtime entry', () => {
  it('executes a compiled program without a client or compiler', async () => {
    const runtime = createAdvRuntime({
      program: {
        schemaVersion: 1,
        id: 'embed-smoke',
        hash: 'a'.repeat(64),
        entry: { chapterId: 'intro', nodeId: 'hello' },
        requiredPlugins: {},
        chapters: {
          intro: { id: 'intro', entry: 'hello', order: ['hello'], nodes: { hello: { id: 'hello', kind: 'dialog', data: { text: 'Hello host' } } } },
        },
      },
      maxCheckpoints: 0,
    })
    await runtime.start()
    expect(runtime.current?.data?.text).toBe('Hello host')
    const saved = runtime.snapshot()
    runtime.restore(saved)
    await runtime.next()
    expect(runtime.state.status).toBe('ended')
  })

  it('publishes a runtime dependency closure without the parser, asset or storage modules', () => {
    const visited = new Set<string>()
    const external = new Set<string>()
    function walk(url: URL) {
      const path = fileURLToPath(url)
      if (visited.has(path))
        return
      visited.add(path)
      const source = readFileSync(path, 'utf8')
      for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        if (match[1].startsWith('.'))
          walk(new URL(match[1], url))
        else external.add(match[1])
      }
    }
    walk(pathToFileURL(resolve('packages/core/dist/runtime.mjs')))
    expect([...external]).toEqual(['@advjs/types'])
    expect(visited.size).toBeGreaterThan(1)
    const manifest = JSON.parse(readFileSync(pathToFileURL(resolve('packages/core/package.json')), 'utf8'))
    expect(manifest.exports['./runtime'].default).toBe('./dist/runtime.mjs')
    expect(manifest.exports['./compiler'].default).toBe('./dist/compiler.mjs')
  })
})
