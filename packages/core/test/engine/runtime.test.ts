import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { AdvPlayEngine } from '../../src/engine/runtime'

const testScript = `---
title: Test Story
---

@云游君
你好世界！

@云游君(smile)
这是第二句对话。

（旁白文字）

- 选项一
- 选项二

@云游君
故事结束了。
`

function createEngine() {
  // Use a unique temp directory for each test to avoid conflicts
  const sessionDir = path.join(tmpdir(), `advjs-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  return new AdvPlayEngine(sessionDir)
}

describe('advPlayEngine', () => {
  it('should load a script and return first displayable node', async () => {
    const engine = createEngine()
    const result = await engine.loadScript(testScript, 'test.adv.md')

    expect(result).not.toBeNull()
    expect(result!.type).toBeDefined()
  })

  it('should advance through nodes with next()', async () => {
    const engine = createEngine()
    await engine.loadScript(testScript, 'test.adv.md')

    const results = []
    let current = await engine.next()
    let safety = 0
    while (current && current.type !== 'end' && safety < 20) {
      results.push(current)
      if (current.type === 'choices') {
        current = await engine.choose(1)
      }
      else {
        current = await engine.next()
      }
      safety++
    }

    expect(results.length).toBeGreaterThan(0)
    expect(engine.isEnd() || current?.type === 'end').toBe(true)
  })

  it('should handle choices correctly', async () => {
    const engine = createEngine()
    await engine.loadScript(testScript, 'test.adv.md')

    // Advance until we hit choices
    let current = await engine.next()
    let safety = 0
    while (current && current.type !== 'choices' && current.type !== 'end' && safety < 20) {
      current = await engine.next()
      safety++
    }

    if (current?.type === 'choices') {
      // Try choosing
      const afterChoice = await engine.choose(1)
      expect(afterChoice).not.toBeNull()
    }
  })

  it('should report status correctly', async () => {
    const engine = createEngine()
    await engine.loadScript(testScript, 'test.adv.md', 'test-session')

    const status = engine.getStatus()
    expect(status.sessionId).toBe('test-session')
    expect(status.status).toBeDefined()
    expect(status.totalNodes).toBeGreaterThan(0)
  })

  it('should detect end of story', async () => {
    const engine = createEngine()
    await engine.loadScript(testScript, 'test.adv.md')

    // Fast-forward to end
    let safety = 0
    let current = await engine.next()
    while (current && current.type !== 'end' && safety < 50) {
      if (current.type === 'choices') {
        current = await engine.choose(1)
      }
      else {
        current = await engine.next()
      }
      safety++
    }

    expect(engine.isEnd()).toBe(true)
  })

  it('should reset session', async () => {
    const engine = createEngine()
    await engine.loadScript(testScript, 'test.adv.md', 'reset-test')
    await engine.next()

    await engine.reset()
    expect(engine.isEnd()).toBe(true) // no session = end
  })

  it('should return null when no session loaded', async () => {
    const engine = createEngine()
    const result = await engine.next()
    expect(result).toBeNull()
  })
})

describe('advPlayEngine with real .adv.md file', () => {
  const demoPath = path.resolve(import.meta.dirname, '../../../../skills/adv-story/examples/demo.adv.md')

  it('should play through the demo story', async () => {
    let content: string
    try {
      content = await readFile(demoPath, 'utf-8')
    }
    catch {
      // Skip if demo file doesn't exist
      return
    }

    const engine = createEngine()
    const first = await engine.loadScript(content, demoPath)
    expect(first).not.toBeNull()

    // Advance through the entire story
    let safety = 0
    let current = first
    const nodes = [current]
    while (current && current!.type !== 'end' && safety < 100) {
      if (current!.type === 'choices') {
        current = await engine.choose(1)
      }
      else {
        current = await engine.next()
      }
      if (current)
        nodes.push(current)
      safety++
    }

    // Should have visited multiple nodes
    expect(nodes.length).toBeGreaterThan(3)
    // Should end
    expect(nodes.at(-1)!.type).toBe('end')
  })
})
