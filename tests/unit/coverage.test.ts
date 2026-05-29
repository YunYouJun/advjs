import { describe, expect, it } from 'vitest'
import { aggregateCoverage, analyzeBranches, analyzeCoverage, formatCoverageText, formatProjectCoverageText } from '../../packages/advjs/node/commands/branches'

function build(ast: any): any {
  return ast
}

describe('analyzeCoverage', () => {
  it('reports full reachability for a simple linear script', () => {
    const ast = build({
      type: 'adv-root',
      children: [
        { type: 'scene', place: '学校', time: '白天', inOrOut: '内景' },
        { type: 'dialog', character: { type: 'character', name: 'A' }, children: [] },
        { type: 'scene', place: '天台', time: '傍晚', inOrOut: '外景' },
        { type: 'dialog', character: { type: 'character', name: 'A' }, children: [] },
      ],
      scene: { 学校: 0, 天台: 2 },
      functions: {},
    })

    const report = analyzeCoverage(analyzeBranches(ast))
    expect(report.totalScenes).toBe(2)
    expect(report.reachableScenes).toBe(2)
    expect(report.orphanScenes).toEqual([])
    expect(report.choicePoints).toBe(0)
    expect(report.deadOptions).toBe(0)
    // one linear path
    expect(report.distinctPaths).toBe(1)
  })

  it('counts distinct paths through a choice fork', () => {
    const ast = build({
      type: 'adv-root',
      children: [
        { type: 'scene', place: '开始', time: '', inOrOut: '' },
        {
          type: 'choices',
          choices: [
            { type: 'choice', text: '去 A', target: 'A线' },
            { type: 'choice', text: '去 B', target: 'B线' },
          ],
        },
        { type: 'scene', place: 'A线', time: '', inOrOut: '' },
        { type: 'dialog', character: { type: 'character', name: 'X' }, children: [] },
        { type: 'scene', place: 'B线', time: '', inOrOut: '' },
        { type: 'dialog', character: { type: 'character', name: 'X' }, children: [] },
      ],
      scene: { 开始: 0, A线: 2, B线: 4 },
      functions: {},
    })

    const report = analyzeCoverage(analyzeBranches(ast))
    expect(report.choicePoints).toBe(1)
    expect(report.totalOptions).toBe(2)
    // start → choice → optA → A线 → (B线) → end, plus optB path
    expect(report.distinctPaths).toBeGreaterThanOrEqual(2)
    expect(report.orphanScenes).toEqual([])
  })

  it('keeps sequential scenes reachable via linear fall-through', () => {
    // Two scenes in source order with no choices between them: 主线 falls
    // through to 后续 → both reachable. Also asserts the core invariant.
    const ast = build({
      type: 'adv-root',
      children: [
        { type: 'scene', place: '主线', time: '', inOrOut: '' },
        { type: 'dialog', character: { type: 'character', name: 'X' }, children: [] },
        { type: 'scene', place: '后续', time: '', inOrOut: '' },
        { type: 'dialog', character: { type: 'character', name: 'X' }, children: [] },
      ],
      scene: { 主线: 0, 后续: 2 },
      functions: {},
    })

    const report = analyzeCoverage(analyzeBranches(ast))
    expect(report.orphanScenes).toEqual([])
    expect(report.reachableScenes).toBe(2)
    // invariant: reachable + orphan == total
    expect(report.reachableScenes + report.orphanScenes.length).toBe(report.totalScenes)
  })

  it('detects an orphan scene stranded behind an unbranched choices node', () => {
    // Graph model: scene → next *anchor* in source order. A choices node is an
    // anchor, so 主线 links to the choices (not past it). 死岛 sits after the
    // choices; unless an option targets it, nothing links to it → orphan.
    const ast = build({
      type: 'adv-root',
      children: [
        { type: 'scene', place: '主线', time: '', inOrOut: '' }, // idx 0
        {
          type: 'choices', // idx 1 — anchor between 主线 and 死岛
          choices: [
            { type: 'choice', text: '结局 A', target: '结局A' },
            { type: 'choice', text: '结局 B', target: '结局A' },
          ],
        },
        { type: 'scene', place: '死岛', time: '', inOrOut: '' }, // idx 2 — no inbound edge
        { type: 'dialog', character: { type: 'character', name: 'X' }, children: [] },
        { type: 'scene', place: '结局A', time: '', inOrOut: '' }, // idx 4 — both options target this
        { type: 'dialog', character: { type: 'character', name: 'X' }, children: [] },
      ],
      scene: { 主线: 0, 死岛: 2, 结局A: 4 },
      functions: {},
    })

    const report = analyzeCoverage(analyzeBranches(ast))
    expect(report.orphanScenes).toContain('死岛')
    expect(report.reachableScenes).toBeLessThan(report.totalScenes)
  })

  it('counts dead options', () => {
    const ast = build({
      type: 'adv-root',
      children: [
        {
          type: 'choices',
          choices: [{ type: 'choice', text: '走入虚空', target: 'nowhere' }],
        },
      ],
      scene: {},
      functions: {},
    })

    const report = analyzeCoverage(analyzeBranches(ast))
    expect(report.deadOptions).toBe(1)
  })

  it('handles cyclic go targets without infinite loop', () => {
    const ast = build({
      type: 'adv-root',
      children: [
        { type: 'scene', place: 'A', time: '', inOrOut: '' },
        {
          type: 'choices',
          choices: [
            { type: 'choice', text: '回到 A', target: 'A' },
            { type: 'choice', text: '前进', target: 'B' },
          ],
        },
        { type: 'scene', place: 'B', time: '', inOrOut: '' },
        { type: 'dialog', character: { type: 'character', name: 'X' }, children: [] },
      ],
      scene: { A: 0, B: 2 },
      functions: {},
    })

    // Must terminate (cycle pruned) and produce a finite count
    const report = analyzeCoverage(analyzeBranches(ast))
    expect(Number.isFinite(report.distinctPaths)).toBe(true)
    expect(report.distinctPaths).toBeGreaterThan(0)
  })

  it('formatCoverageText emits a readable summary', () => {
    const ast = build({
      type: 'adv-root',
      children: [{ type: 'scene', place: 'A', time: '', inOrOut: '' }],
      scene: { A: 0 },
      functions: {},
    })
    const out = formatCoverageText(analyzeCoverage(analyzeBranches(ast)))
    expect(out).toContain('Branch Coverage')
    expect(out).toContain('Scenes reachable')
    expect(out).toContain('Distinct paths')
  })
})

describe('aggregateCoverage', () => {
  function reportFor(ast: any) {
    return analyzeCoverage(analyzeBranches(build(ast)))
  }

  const linear = {
    type: 'adv-root',
    children: [
      { type: 'scene', place: 'A', time: '', inOrOut: '' },
      { type: 'dialog', character: { type: 'character', name: 'X' }, children: [] },
    ],
    scene: { A: 0 },
    functions: {},
  }

  const withDeadOption = {
    type: 'adv-root',
    children: [
      { type: 'choices', choices: [{ type: 'choice', text: '虚空', target: 'nowhere' }] },
    ],
    scene: {},
    functions: {},
  }

  it('sums per-chapter metrics into project totals', () => {
    const project = aggregateCoverage([
      { name: 'ch01.adv.md', report: reportFor(linear) },
      { name: 'ch02.adv.md', report: reportFor(withDeadOption) },
    ])
    expect(project.totals.chapters).toBe(2)
    expect(project.totals.scenes).toBe(1) // only ch01 has a scene
    expect(project.totals.deadOptions).toBe(1) // from ch02
    expect(project.totals.chaptersWithIssues).toBe(1)
  })

  it('reports zero issues for an all-clean project', () => {
    const project = aggregateCoverage([
      { name: 'ch01.adv.md', report: reportFor(linear) },
    ])
    expect(project.totals.chaptersWithIssues).toBe(0)
    const out = formatProjectCoverageText(project)
    expect(out).toContain('Project Branch Coverage')
    expect(out).toContain('| **Total** |')
    expect(out).toContain('clean')
  })

  it('lists chapters with issues in the text report', () => {
    const project = aggregateCoverage([
      { name: 'ch01.adv.md', report: reportFor(linear) },
      { name: 'ch02.adv.md', report: reportFor(withDeadOption) },
    ])
    const out = formatProjectCoverageText(project)
    expect(out).toContain('ch02.adv.md')
    expect(out).toContain('dead')
  })

  it('handles an empty project', () => {
    const out = formatProjectCoverageText(aggregateCoverage([]))
    expect(out).toContain('No chapters found.')
  })
})
