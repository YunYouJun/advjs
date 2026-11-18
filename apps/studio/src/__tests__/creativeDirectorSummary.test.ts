import type { CreativeTeamRun } from '@advjs/agent'
import { computeAgentProjectRevision, createCreativeTeamRun, parseCreativePartnerOutput, prepareCreativeDirectorSummaryEvidence, runCreativePlaytest } from '@advjs/agent'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import project from '../../../../packages/agent/test/fixtures/creative-team/v2/project.json'
import CreativeDirectorSummaryOutput from '../components/creative-team/CreativeDirectorSummaryOutput.vue'
import CreativeTeamRunPanel from '../components/creative-team/CreativeTeamRunPanel.vue'
import { creativeTeamMessages } from '../i18n/locales/creativeTeam'

function options(locale = 'zh-CN') {
  return {
    global: {
      plugins: [createI18n({ legacy: false, locale, messages: Object.fromEntries(Object.entries(creativeTeamMessages).map(([locale, messages]) => [locale, { creativeTeam: messages }])) })],
      stubs: { RouterLink: { template: '<a><slot /></a>' } },
    },
  }
}
async function fixture() {
  const revision = await computeAgentProjectRevision(project.files)
  const facts = { revision, files: project.files }
  const report = await runCreativePlaytest({ project: { id: 'station', ...facts }, scenarios: [{ id: 'stay', choices: [0], expectedEnding: 'stay#ending-stay' }, { id: 'leave', choices: [1], expectedEnding: 'leave#ending-leave' }] })
  const run: CreativeTeamRun = createCreativeTeamRun({ id: 'run1', accountId: 'author', now: 0, plan: { protocolVersion: 1, projectId: 'station', projectRevision: revision, goal: '汇总已有作品', limits: { maxTasks: 4, maxToolCalls: 8, maxReworkRounds: 1, maxMicroPoints: 10000 }, tasks: [
    { id: 'plan', partner: 'director', capability: 'plan-production', dependsOn: [], sourcePaths: Object.keys(project.files), instruction: '已有计划', expectedOutput: '简报' },
    { id: 'delivery', partner: 'director', capability: 'summarize-production', dependsOn: ['plan'], sourcePaths: Object.keys(project.files), instruction: '作者明确请求后的交付建议', expectedOutput: '受审建议' },
  ] } })
  run.status = 'awaiting_review'
  run.tasks = [{ taskId: 'plan', status: 'completed', attempt: 1, artifactIds: ['brief'], usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2, providerCostMicroCny: 1, chargedMicroPoints: 2000 } }, run.tasks[1]!]
  run.artifacts = [{ id: 'brief', fingerprint: 'brief-v1', taskId: 'plan', runId: run.id, projectId: 'station', partner: 'director', kind: 'production-brief', summary: '已选定的原计划', source: { projectId: 'station', revision, files: facts.files, upstream: [] }, status: 'selected', changes: [], reviewCapabilities: [] }]
  run.chargedMicroPoints = 2000
  run.toolCalls = 1
  run.playtests = [{ id: 'actual-report', projectId: 'station', baselineRevision: revision, snapshotRevision: revision, scope: 'saved', artifacts: [], runnerVersion: 'creative-headless-v1', verification: 'author-host', passed: 2, failed: 0, blocked: 0, cancelled: 0, createdAt: 1 }]
  const evidence = prepareCreativeDirectorSummaryEvidence(run, 'delivery', facts, { 'actual-report': report }, revision)
  const output = parseCreativePartnerOutput('delivery-summary', { kind: 'delivery-summary', summary: '导演建议', overview: '建议核对实际作品。<img src="untrusted" onerror="alert(1)">', deliverables: [{ artifactId: 'brief', fingerprint: 'brief-v1', assessment: '原计划已选定，仍需作者判断范围。' }], risks: ['画面和声音品质未核验'], nextSteps: ['作者独立决定是否收尾'], recommendation: 'review-current-scope' }, { projectId: 'station', projectRevision: revision, files: facts.files, limits: run.plan.limits, characterIds: ['lin', 'qiao'], directorSummary: evidence })
  if (output.kind !== 'delivery-summary')
    throw new Error('Expected a director summary fixture')
  return { run, output }
}

describe('director summary author review', () => {
  it('requires an available explicit author action instead of triggering a summary on render', async () => {
    const { run } = await fixture()
    const wrapper = mount(CreativeTeamRunPanel, { ...options(), props: { run, busy: false, enabled: true, authorEditsAvailable: true, directorSummaryAvailable: true } })
    expect(wrapper.emitted('decide')).toBeUndefined()
    await wrapper.findAll('button').find(button => button.text() === '生成导演交付建议')!.trigger('click')
    expect(wrapper.emitted('decide')![0]![0]).toMatchObject({ type: 'request-rework', taskId: 'delivery', reason: expect.stringContaining('剩余预算') })
    expect(run.chargedMicroPoints).toBe(2000)
    await wrapper.setProps({ directorSummaryAvailable: false })
    expect(wrapper.findAll('button').some(button => button.text() === '生成导演交付建议')).toBe(false)
    expect(wrapper.text()).toContain('能力尚未开放')
  })

  it('renders actual costs and both core outcomes separately from escaped model advice', async () => {
    const { output } = await fixture()
    const wrapper = mount(CreativeDirectorSummaryOutput, { ...options(), props: { output } })
    expect(wrapper.text()).toContain('汇总前已结算 2 点')
    expect(wrapper.text()).toContain('当前这次汇总自身费用另由 Runtime 结算')
    expect(wrapper.text()).toContain('与本次快照版本一致')
    expect(wrapper.text()).toContain('通过 2 · 失败 0')
    expect(wrapper.text()).toContain('stay#ending-stay')
    expect(wrapper.text()).toContain('leave#ending-leave')
    expect(wrapper.text()).toContain('选定此建议不会结束制作组')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('<img src="untrusted"')
    expect(wrapper.text()).toContain('不是服务端重放认证')
  })

  it('marks another source snapshot and unavailable historical report explicitly', async () => {
    const { output } = await fixture()
    const changed = structuredClone(output)
    changed.evidence.snapshotRevision = 'another-reviewed-snapshot'
    changed.evidence.reports = [{ id: 'actual-report', available: false, diagnostics: [], diagnosticsOmitted: 0, executions: [] }]
    const wrapper = mount(CreativeDirectorSummaryOutput, { ...options('en'), props: { output: changed } })
    expect(wrapper.text()).toContain('Different snapshot; does not prove this version passed')
    expect(wrapper.text()).toContain('Only the historical summary is available')
    expect(wrapper.text()).toContain('Selecting this advice neither finishes the team')
    expect(wrapper.text()).not.toContain('creativeTeam.')
  })
})
