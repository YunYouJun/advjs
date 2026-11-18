import { describe, expect, it } from 'vitest'
import { createCreativeBootstrapPlan, parseCreativeTeamAvailability, parseCreativeTeamFeatureGate, parseCreativeTeamPublicDecision, parseCreativeTeamStartRequest } from '../src'
import project from './fixtures/creative-team/v2/project.json'

const request = { protocolVersion: 1, project: { id: project.id, revision: 'r1', files: project.files }, goal: '两位人物、两个结局的雨夜车站', partner: 'director', locale: 'zh-CN', limits: { maxTasks: 8, maxToolCalls: 20, maxReworkRounds: 2, maxMicroPoints: 1000 } }

describe('creative team public wire boundary', () => {
  it('starts with exactly the requested partner and keeps provider settings outside the request', () => {
    const start = parseCreativeTeamStartRequest(request)
    expect(createCreativeBootstrapPlan(start).tasks).toHaveLength(1)
    expect(createCreativeBootstrapPlan(parseCreativeTeamStartRequest({ ...request, partner: 'writer' })).tasks[0].capability).toBe('write-chapters')
    expect(() => parseCreativeTeamStartRequest({ ...request, model: 'browser-override' })).toThrow(/Unknown/)
    expect(() => parseCreativeTeamStartRequest({ ...request, project: { ...request.project, files: { 'adv.config.ts': 'executeHost()' } } })).toThrow(/source/)
  })

  it('only accepts author decisions and derives their identity from the request header', () => {
    expect(parseCreativeTeamPublicDecision({ type: 'approve-plan' }, 'decision1')).toEqual({ type: 'approve-plan', decisionId: 'decision1' })
    expect(() => parseCreativeTeamPublicDecision({ type: 'settle-task', chargedMicroPoints: 0 }, 'forged')).toThrow()
    expect(() => parseCreativeTeamPublicDecision({ type: 'reserve-next', taskId: 'writer' }, 'forged')).toThrow()
    expect(() => parseCreativeTeamPublicDecision({ type: 'cancel', accountId: 'another', reason: 'stop' }, 'forged')).toThrow()
  })

  it('fails closed on malformed deployment flags and unavailable media claims', () => {
    expect(parseCreativeTeamFeatureGate(undefined)).toBe(false)
    expect(parseCreativeTeamFeatureGate('false')).toBe(false)
    expect(parseCreativeTeamFeatureGate('true')).toBe(true)
    expect(() => parseCreativeTeamFeatureGate('1')).toThrow()
    expect(() => parseCreativeTeamAvailability({ protocolVersion: 1, enabled: true, capabilities: ['direct-art'], serviceVersion: 'test', maxConcurrentTasks: 6, media: { image: 'verified-managed', voice: 'manual-import' } })).toThrow()
  })
})
