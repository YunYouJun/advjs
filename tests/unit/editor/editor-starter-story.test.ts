// @vitest-environment node

import type { AdvRuntime } from '@advjs/core'
import type { RuntimeChoice, RuntimeEffect } from '@advjs/types'
import { createAdvRuntime } from '@advjs/core'
import { describe, expect, it } from 'vitest'
import { compileEditorProject } from '../../../editor/core/app/adapters/browser/project'
import starter from '../../../editor/core/app/templates/starter'
import { buildProjectFlow } from '../../../editor/core/app/utils/project-flow'

async function compileStarter() {
  const files = Object.fromEntries(starter.files.filter(file => !file.encoding).map(file => [file.name, file.content]))
  const model = await compileEditorProject({ id: 'starter-story-test', files })
  expect(model.compilation.diagnostics.filter(item => item.severity === 'error')).toEqual([])
  expect(model.compilation.project.program).toBeDefined()
  return model
}

function visibleChoices(runtime: AdvRuntime): RuntimeChoice[] {
  expect(runtime.current?.kind).toBe('choices')
  return runtime.current!.data!.options as unknown as RuntimeChoice[]
}

async function advanceToDecision(runtime: AdvRuntime, rendered: string[]) {
  for (let step = 0; step < 80; step++) {
    expect(runtime.state.error).toBeUndefined()
    const text = runtime.current?.data?.text
    if (typeof text === 'string')
      rendered.push(text)
    if (runtime.state.status === 'waiting-choice' || runtime.state.status === 'ended')
      return
    expect(runtime.state.status).toBe('playing')
    await runtime.next()
  }
  throw new Error(`Starter did not pause after 80 steps at ${JSON.stringify(runtime.state.cursor)}`)
}

async function playStarter() {
  const model = await compileStarter()
  const runtime = createAdvRuntime({
    program: model.compilation.project.program!,
    initialVariables: model.compilation.project.game.variables,
  })
  const effects: RuntimeEffect[] = []
  const rendered: string[] = []
  runtime.subscribe((_state, updates) => effects.push(...updates))
  await runtime.start()
  await advanceToDecision(runtime, rendered)
  async function choose(label: string) {
    const option = visibleChoices(runtime).find(option => option.label === label)
    expect(option, `Expected visible Starter choice: ${label}`).toBeDefined()
    await runtime.choose(option!.id)
    await advanceToDecision(runtime, rendered)
  }
  return { runtime, effects, rendered, choose }
}

describe('starter multi-chapter story', () => {
  it('compiles a real project with a complete large graph and precise authored source locations', async () => {
    const model = await compileStarter()
    const graph = await buildProjectFlow(model)
    expect(graph.status).toBe('ready')
    expect(graph.diagnostics).toEqual([])
    expect(graph.counts.chapters).toBe(3)
    expect(graph.nodes.length).toBeGreaterThan(50)
    expect(graph.counts.choices).toBeGreaterThan(10)
    expect(graph.counts.unreachable).toBe(0)
    expect(graph.counts.unknown).toBe(0)
    expect(model.compilation.project.program!.entry).toEqual({ chapterId: 'hello', nodeId: 'start' })
    expect(new Set(graph.nodes.map(node => node.id)).size).toBe(graph.nodes.length)
    const nodeIds = new Set(graph.nodes.map(node => node.id))
    expect(graph.edges.every(edge => nodeIds.has(edge.source) && nodeIds.has(edge.target))).toBe(true)
    expect(graph.nodes.filter(node => node.runtimeKind === 'end')).toHaveLength(2)
    const runtimeKinds = [...new Set(graph.nodes.flatMap(node => node.runtimeKind ? [node.runtimeKind] : []))]
    expect(runtimeKinds).toEqual(expect.arrayContaining(['scene', 'effects', 'dialog', 'narration', 'choices', 'actions', 'end']))

    for (const [chapterId, anchors] of Object.entries({
      hello: ['start', 'syntax', 'finish', 'desk'],
      letter: ['window', 'postcard', 'faint-writing', 'revisit', 'understand'],
      ending: ['entrusted', 'waiting'],
    })) {
      const path = `adv/chapters/${chapterId}.adv.md`
      const lines = model.files[path].split('\n')
      for (const anchor of anchors) {
        const node = graph.nodes.find(node => node.address?.chapterId === chapterId && node.address.nodeId === anchor && node.kind === 'story')
        const line = lines.findIndex(line => line.includes(`{#${anchor}}`)) + 1
        expect(line).toBeGreaterThan(0)
        expect(node?.source).toMatchObject({ path, line })
      }
    }
    for (const node of graph.nodes.filter(node => node.kind === 'choice')) {
      expect(node.source).toBeDefined()
      const source = node.source!
      expect(model.files[source.path].split('\n')[source.line - 1]).toContain(`[${node.label}](`)
    }
    expect(graph.nodes.every(node => node.source && node.source.line > 0 && node.source.line <= model.files[node.source.path].split('\n').length)).toBe(true)
  })

  it('preserves stable graph identities across project recompilation while exposing conditional and loop routes', async () => {
    const model = await compileStarter()
    const graph = await buildProjectFlow(model)
    const recompiled = await compileEditorProject({
      id: 'starter-story-test',
      files: Object.fromEntries(Object.entries(model.files).reverse()),
    })
    const refreshed = await buildProjectFlow(recompiled)
    expect(refreshed.nodes.map(node => node.id).sort()).toEqual(graph.nodes.map(node => node.id).sort())
    expect(refreshed.edges.map(edge => edge.id).sort()).toEqual(graph.edges.map(edge => edge.id).sort())
    const conditional = graph.nodes.find(node => node.kind === 'choice' && node.label === '沿着邮戳理解这封信')!
    expect(conditional).toMatchObject({ conditional: true, reachability: 'reachable' })
    expect(model.compilation.project.game.variables?.clueFound).toBe(false)
    const reread = graph.nodes.find(node => node.kind === 'choice' && node.label === '再读一次来信')!
    const window = graph.nodes.find(node => node.kind === 'story' && node.address?.chapterId === 'letter' && node.address.nodeId === 'window')!
    expect(graph.edges).toContainEqual(expect.objectContaining({ source: reread.id, target: window.id, kind: 'jump' }))
    expect(graph.edges.some(edge => edge.crossChapter)).toBe(true)
  })

  it('plays the tutorial and clue route through chapter transitions to the send-light ending', async () => {
    const { runtime, effects, rendered, choose } = await playStarter()
    await choose('看看语法')
    await choose('继续')
    expect(runtime.state.variables.greeted).toBe(true)
    await choose('寻找房间里的线索')
    await choose('带着笔记去读信')
    expect(runtime.state.cursor.chapterId).toBe('letter')
    await choose('检查信封上的邮戳')
    await choose('记住日期，重新整理思路')
    expect(runtime.state.variables).toMatchObject({ clueFound: true, readCount: 1 })
    expect(visibleChoices(runtime).map(option => option.label)).toContain('沿着邮戳理解这封信')
    await choose('沿着邮戳理解这封信')
    await choose('把光寄回明天')
    expect(runtime.state.status).toBe('ended')
    expect(runtime.state.cursor.chapterId).toBe('ending')
    expect(runtime.current?.data?.text).toBe('结局一：把光寄回明天')
    expect(runtime.state.variables).toMatchObject({ greeted: true, clueFound: true, readCount: 1, ending: 'send-light' })
    expect(runtime.state.visited).toContain('ending#entrusted')
    expect(runtime.state.visited).not.toContain('ending#waiting')
    expect(rendered.join('\n')).toContain('标题可以作为稳定锚点')
    expect(rendered.join('\n')).toContain('最小项目已经跑通')
    expect(effects.some(effect => effect.type === 'stage.background')).toBe(true)
    expect(runtime.state.stage.background).toBe('/img/room.svg')
  })

  it('hides the clue-gated choice and reaches the keep-letter ending without visiting the other ending', async () => {
    const { runtime, choose } = await playStarter()
    await choose('直接开始')
    await choose('打开窗边的来信')
    await choose('先读信纸上的淡字')
    await choose('放下信纸，重新整理思路')
    expect(runtime.state.variables).toMatchObject({ clueFound: false, readCount: 1 })
    expect(visibleChoices(runtime).map(option => option.label)).not.toContain('沿着邮戳理解这封信')
    await choose('先把来信收好')
    expect(runtime.state.status).toBe('ended')
    expect(runtime.current?.data?.text).toBe('结局二：留一封未拆的信')
    expect(runtime.state.variables).toMatchObject({ greeted: true, clueFound: false, readCount: 1, ending: 'keep-letter' })
    expect(runtime.state.visited).toContain('ending#waiting')
    expect(runtime.state.visited).not.toContain('ending#entrusted')
  })

  it('restores the repeat decision on back and lets both authored loops exit to an ending', async () => {
    const { runtime, choose } = await playStarter()
    await choose('直接开始')
    await choose('打开窗边的来信')
    await choose('先读信纸上的淡字')
    await choose('放下信纸，重新整理思路')
    const beforeRepeat = structuredClone(runtime.state)
    const reread = visibleChoices(runtime).find(option => option.label === '再读一次来信')!
    await runtime.choose(reread.id)
    runtime.back()
    expect(runtime.state).toEqual(beforeRepeat)
    expect(visibleChoices(runtime).map(option => option.label)).toContain('再读一次来信')
    await choose('再读一次来信')
    await choose('检查信封上的邮戳')
    await choose('记住日期，重新整理思路')
    expect(runtime.state.variables).toMatchObject({ clueFound: true, readCount: 2 })
    await choose('沿着邮戳理解这封信')
    await choose('还想再确认一下')
    expect(visibleChoices(runtime).map(option => option.label)).toContain('先把来信收好')
    await choose('先把来信收好')
    expect(runtime.state.status).toBe('ended')
    expect(runtime.state.variables).toMatchObject({ readCount: 2, ending: 'keep-letter' })
    expect(runtime.current?.data?.text).toBe('结局二：留一封未拆的信')
  })
})
