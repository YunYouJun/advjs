import type { StoryLocale, StoryProblem } from '../../../packages/ai/src'
import type { StreamChatOptions } from '../../../packages/ai/src/chat'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { endlessTram } from '../../../docs/.vitepress/theme/components/home/ai/modes/endless-tram'
import { AiApiError, choiceLines, createStorySession, escapeLinkText, linkChoices, prepareSegment, UNWRITTEN_TARGET } from '../../../packages/ai/src'
import { compileProject } from '../../../packages/core/src/project/compile'
import { createAdvRuntime } from '../../../packages/core/src/runtime/headless'

const seedRoot = join(import.meta.dirname, '../../../docs/.vitepress/theme/components/home/ai/seeds/endless-tram')

function readSeed(locale: StoryLocale) {
  const root = join(seedRoot, locale)
  const files: Record<string, string> = {}
  for (const entry of readdirSync(root, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile())
      continue
    const path = relative(root, join(entry.parentPath, entry.name))
    if (path !== 'fallback.adv.md')
      files[path] = readFileSync(join(root, path), 'utf8')
  }
  return { files, fallback: readFileSync(join(root, 'fallback.adv.md'), 'utf8') }
}

/** A transport that replays canned replies, a few characters at a time, and records requests. */
function scripted(...replies: (string | Error)[]) {
  const requests: StreamChatOptions[] = []
  async function* stream(options: StreamChatOptions) {
    requests.push(options)
    const reply = replies.shift()
    if (reply === undefined)
      throw new Error('No scripted reply left')
    if (reply instanceof Error)
      throw reply
    for (let i = 0; i < reply.length; i += 7)
      yield reply.slice(i, i + 7)
  }
  return { stream, requests }
}

function session(locale: StoryLocale, stream: ReturnType<typeof scripted>['stream']) {
  const seed = readSeed(locale)
  return createStorySession({
    mode: endlessTram,
    locale,
    projectId: 'endless-tram-test',
    seedFiles: seed.files,
    fallback: seed.fallback,
    chat: { baseURL: 'https://example.test/v1', apiKey: 'test-key', model: 'test-model' },
    compile: compileProject,
    stream,
  })
}

const departChoice = { kind: 'choice', chapterId: 'tram', choiceId: 'choice-1', label: '坐到下一站看看' } as const

const rainStop = `---
plotSummary: 雨站的长椅上坐着一个等了很多年的人。
---

## 雨站

> 车门打开。只有这一站在下雨。

@小云
这里的人，都在等一班不会来的车。

- 陪长椅上的人等一会儿

  \`\`\`yaml
  actions:
    - type: variables/push-unique
      key: memories
      value: 雨站的长椅
  \`\`\`

- 把伞留给他，回到车上
`

const lampStop = `---
plotSummary: 一盏路灯下，有人在找一把钥匙。
---

## 路灯

> 站台上只有一盏路灯，灯下的人在找钥匙。

- 帮他一起找
- 回到车上
`

describe('endless tram seeds', () => {
  for (const locale of ['zh', 'en'] as const) {
    it(`compiles the ${locale} seed with its unwritten chapter`, async () => {
      const { stream } = scripted()
      const { program } = await session(locale, stream).start()
      expect(program.entry).toEqual({ chapterId: 'tram', nodeId: 'start' })
      expect(program.chapters.unwritten.nodes.unwritten.kind).toBe('anchor')
    })

    it(`uses the ${locale} fallback when the model fails twice`, async () => {
      const broken = '## 坏\n\n普通段落\n'
      const { stream } = scripted(broken, broken)
      const run = session(locale, stream)
      await run.start()
      const segment = await run.generate(departChoice, { stop: 0, memories: [] })
      expect(segment.fallback).toBe(true)
      expect(segment.attempts).toBe(2)
      expect(segment.problems.map(problem => problem.code)).toContain('segment/node-kind')
      expect(segment.source).toContain('{#s1}')
      const accepted = await run.accept(segment, departChoice)
      expect(accepted.program.chapters.s1).toBeDefined()
    })
  }
})

describe('story session', () => {
  it('writes, accepts and plays a segment, linking the answered choice', async () => {
    const { stream, requests } = scripted(rainStop)
    const run = session('zh', stream)
    await run.start()
    const texts: string[] = []
    const segment = await run.generate(departChoice, { stop: 0, memories: [] }, { onText: text => texts.push(text) })

    expect(segment).toMatchObject({ index: 1, chapterId: 's1', path: 'adv/chapters/s1/01.adv.md', title: '雨站', attempts: 1, fallback: false })
    expect(segment.variables).toEqual({ stop: 1, memories: [] })
    expect(texts.at(-1)).toBe(rainStop)

    const system = requests[0].messages[0].content
    expect(system).toContain('Simplified Chinese')
    expect(system).toContain('Only these characters may speak: 小云')
    expect(system).toContain('memories (actions: variables/push-unique; each value at most 12 characters)')
    expect(requests[0].messages[1].content).toContain('<player-action>坐到下一站看看</player-action>')

    const accepted = await run.accept(segment, departChoice)
    expect(accepted.entry).toEqual({ chapterId: 's1', nodeId: 's1' })
    const depart = run.files['adv/chapters/tram/01-depart.adv.md']
    expect(depart).toContain('- [坐到下一站看看](s1#s1)')
    expect(depart).toContain(`- [问小云：这趟车开往哪里？](${UNWRITTEN_TARGET})`)

    const runtime = createAdvRuntime({ program: accepted.program, initialVariables: accepted.variables })
    await runtime.go(accepted.entry)
    while (runtime.current?.kind !== 'choices')
      await runtime.next()
    await runtime.choose('choice-1')
    expect(runtime.state.status).toBe('ended')
    expect(runtime.state.cursor.chapterId).toBe('s1')
    expect(runtime.state.variables).toEqual({ stop: 1, memories: ['雨站的长椅'] })
  })

  it('asks for one repair with line-numbered problems', async () => {
    const wrong = `---
plotSummary: 错的一站。
---

## 错站

@阿婆
你好。

- [去别处](#nowhere)
- 留下
`
    const { stream, requests } = scripted(wrong, rainStop)
    const run = session('zh', stream)
    await run.start()
    const repairs: StoryProblem[][] = []
    const segment = await run.generate(departChoice, { stop: 0, memories: [] }, { onRepair: problems => repairs.push(problems) })
    expect(segment.attempts).toBe(2)
    expect(segment.fallback).toBe(false)
    expect(repairs[0].map(problem => problem.code)).toEqual(expect.arrayContaining(['ADV_PROJECT_UNKNOWN_CHARACTER']))
    const repair = requests[1].messages
    expect(repair.at(-2)).toMatchObject({ role: 'assistant' })
    expect(repair.at(-2)!.content).toContain('## 错站 {#s1}')
    expect(repair.at(-1)!.content).toContain('Unknown character reference: 阿婆')
  })

  it('unwraps fenced replies, drops chatter and the model\'s own anchors', async () => {
    const { stream } = scripted(`好的，这是下一站：\n\n\`\`\`markdown\n${rainStop.replace('## 雨站', '## 雨站 {#rain}')}\`\`\`\n`)
    const run = session('zh', stream)
    await run.start()
    const segment = await run.generate(departChoice, { stop: 0, memories: [] })
    expect(segment.attempts).toBe(1)
    expect(segment.source.startsWith('---\nplotSummary: "雨站的长椅上坐着一个等了很多年的人。"\n---')).toBe(true)
    expect(segment.source).toContain('## 雨站 {#s1}')
    expect(segment.source).not.toContain('{#rain}')
  })

  it('chains segments and keeps the run a valid project', async () => {
    const { stream, requests } = scripted(rainStop, lampStop, rainStop.replace('## 雨站', '## 海边').replace('雨站的长椅上', '海边的长椅上'))
    const run = session('zh', stream)
    await run.start()
    let action = departChoice as { kind: 'choice', chapterId: string, choiceId: string, label: string }
    let variables = { stop: 0, memories: [] as string[] }
    for (let i = 0; i < 3; i++) {
      const segment = await run.generate(action, variables)
      const accepted = await run.accept(segment, action)
      variables = accepted.variables as typeof variables
      action = { kind: 'choice', chapterId: segment.chapterId, choiceId: 'choice-2', label: 'next' }
    }
    expect(run.segments.map(segment => segment.chapterId)).toEqual(['s1', 's2', 's3'])
    expect(run.files['adv/chapters/s1/01.adv.md']).toContain('- [把伞留给他，回到车上](s2#s2)')
    expect(run.files['adv/chapters/s2/01.adv.md']).toContain('- [回到车上](s3#s3)')
    expect(requests[2].messages[1].content).toContain('1. 雨站: 雨站的长椅上坐着一个等了很多年的人。')
    expect(requests[2].messages[1].content).toContain('<file path="adv/chapters/s2/01.adv.md">')

    const { diagnostics } = await compileProject({ id: 'export', files: { ...run.files } })
    expect(diagnostics.filter(diagnostic => diagnostic.severity === 'error')).toEqual([])
  })

  it('throws transport errors instead of falling back', async () => {
    const { stream } = scripted(new AiApiError('The API key was rejected.', 'auth', 401))
    const run = session('en', stream)
    await run.start()
    await expect(run.generate({ ...departChoice, label: 'Ride on to the next stop' }, { stop: 0, memories: [] })).rejects.toMatchObject({ type: 'auth' })
    expect(run.segments).toEqual([])
  })

  it('keeps only the newest memories and sets the stop', async () => {
    const { stream, requests } = scripted(rainStop)
    const run = session('zh', stream)
    await run.start()
    const memories = Array.from({ length: 10 }, (_, i) => `记忆${i}`)
    const segment = await run.generate(departChoice, { stop: 0, memories })
    expect(segment.variables).toEqual({ stop: 1, memories: memories.slice(-8) })
    expect(requests[0].messages[1].content).toContain('"stop":1')
  })
})

describe('segment validation', () => {
  async function problemsFor(reply: string, locale: StoryLocale = 'zh') {
    const { stream } = scripted(reply, reply)
    const run = session(locale, stream)
    await run.start()
    return (await run.generate(departChoice, { stop: 0, memories: [] })).problems.map(problem => problem.code)
  }

  const shell = (body: string, title = '雨站') => `---\nplotSummary: 一站。\n---\n\n## ${title}\n\n${body}\n`

  it('rejects plain paragraphs, conditions and misplaced choices', async () => {
    expect(await problemsFor(shell('普通段落\n\n- 甲\n- 乙'))).toContain('segment/node-kind')
    expect(await problemsFor(shell('- 甲\n\n  ```yaml\n  when: stop > 0\n  ```\n\n- 乙'))).toContain('segment/choice-when')
    expect(await problemsFor(shell('- 甲\n- 乙\n\n> 之后还有字。'))).toContain('segment/choices-position')
  })

  it('checks the choice count and that choices exist', async () => {
    expect(await problemsFor(shell('> 只有一个选择。\n\n- 甲'))).toContain('segment/choices-count')
    expect(await problemsFor(shell('> 没有选择。'))).toContain('segment/choices-missing')
  })

  it('only lets the model touch allowed variables, within bounds', async () => {
    const actions = (yaml: string) => shell(`\`\`\`yaml\ntype: actions\nactions:\n${yaml}\n\`\`\`\n\n- 甲\n- 乙`)
    expect(await problemsFor(actions('  - type: variables/set\n    key: stop\n    value: 9'))).toContain('segment/action-type')
    expect(await problemsFor(actions('  - type: variables/set\n    key: gold\n    value: 9'))).toContain('segment/action-key')
    expect(await problemsFor(actions('  - type: variables/push-unique\n    key: memories\n    value: 一个非常非常非常长的记忆片段'))).toContain('segment/action-value')
  })

  it('applies the length limits of the run\'s language', async () => {
    expect(await problemsFor(shell('> 甲\n\n- 甲\n- 乙', '一个超过十二个字的非常长的站名'))).toContain('segment/title-length')
    expect(await problemsFor(shell(`> ${'字'.repeat(301)}\n\n- 甲\n- 乙`))).toContain('segment/text-length')
    expect(await problemsFor(`---\nplotSummary: A stop.\n---\n\n## Rain\n\n> ${'word '.repeat(150)}\n\n- Stay\n- Go`, 'en')).not.toContain('segment/text-length')
  })
})

describe('segment source helpers', () => {
  it('finds the closing choice block and skips fenced yaml', () => {
    const source = prepareSegment(rainStop, 's1').source
    const lines = source.split('\n')
    expect(choiceLines(source).map(index => lines[index])).toEqual(['- 陪长椅上的人等一会儿', '- 把伞留给他，回到车上'])
  })

  it('escapes labels so they read back the same', async () => {
    expect(escapeLinkText('看 [旧] 报纸 (第 3 版)*')).toBe('看 \\[旧\\] 报纸 \\(第 3 版\\)\\*')
    const source = linkChoices('## 站 {#s1}\n\n> 字\n\n- 甲\n- 乙\n', ['看 [旧] 报纸', '乙'], ['s2#s2', undefined])
    expect(source).toContain('- [看 \\[旧\\] 报纸](s2#s2)\n- 乙')
  })
})
