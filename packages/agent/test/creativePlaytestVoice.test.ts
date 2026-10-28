import type { CreativePlaytestVoiceCoverage, CreativePlaytestVoiceRow } from '../src'
import { describe, expect, it } from 'vitest'
import { computeAgentProjectRevision, createCreativePlaytestVoiceCoverage, creativePlaytestFindings, parseCreativePlaytestRepairReference, parseCreativePlaytestReport, parseCreativePlaytestVoiceCoverage, runCreativePlaytest } from '../src'
import captured from './fixtures/creative-playtest-voice-author-host.json'
import frozen from './fixtures/creative-team/v2/project.json'

const row: CreativePlaytestVoiceRow = { address: 'station#arrival.dialog', lineId: 'line-fixture', speakerId: 'lin', source: { path: 'adv/chapters/station.adv.md', line: 3 }, status: 'missing', takes: 0, profileMissing: true }
async function fixture() {
  const files = structuredClone(frozen.files)
  const revision = await computeAgentProjectRevision(files)
  const coverage = createCreativePlaytestVoiceCoverage({ snapshotRevision: revision, locale: 'zh-CN', complete: true, rows: [row] })
  return { project: { id: 'station', files, revision }, coverage, scenarios: [{ id: 'stay', choices: [0], expectedEnding: 'stay#ending-stay' }] }
}

describe('versioned author-host voice evidence in actual core reports', () => {
  it('replays the real captured host source while retaining byte observations as historical author-host evidence', async () => {
    const historical = parseCreativePlaytestReport(captured.report)
    const current = await runCreativePlaytest({ project: captured.project, scenarios: historical.executions.map(item => item.scenario) })
    expect(current.snapshotRevision).toBe(historical.snapshotRevision)
    expect(current.program).toEqual(historical.program)
    expect(current.executions.map(item => [item.status, item.actualEnding])).toEqual(historical.executions.map(item => [item.status, item.actualEnding]))
    expect(historical.voiceCoverage?.rows.map(item => item.status)).toEqual(['missing', 'missing', 'ready'])
    expect(historical.voiceCoverage?.rows.find(item => item.status === 'ready')?.selected?.sha256).toBe('538922a9bbfe31ecd95ab1f8457041d01bdcb0ae8e007fa0253a25bea1177c3e')
    expect(current.voiceCoverage).toBeUndefined()
    expect(current.unverified).toContain('audio-playback')
  })

  it('uses the actual executed snapshot and keeps missing audio separate from a passing core path', async () => {
    const f = await fixture()
    const seen: unknown[] = []
    const report = await runCreativePlaytest(f, { inspectVoiceCoverage: async (source) => {
      seen.push(source)
      return f.coverage
    } })
    expect(seen).toEqual([{ projectId: 'station', files: f.project.files, revision: f.project.revision }])
    expect(report.executions[0]!.status).toBe('passed')
    expect(report.voiceCoverage).toEqual(f.coverage)
    expect(report.unverified).toContain('audio-playback')
    expect(creativePlaytestFindings(report)).toContainEqual(expect.objectContaining({ id: 'voice:0', kind: 'voice', code: 'ADV_CREATIVE_VOICE_MISSING', source: row.source }))
    expect(parseCreativePlaytestReport(JSON.parse(JSON.stringify(report)))).toEqual(report)
    expect(parseCreativePlaytestRepairReference({ reportId: 'report1', snapshotRevision: report.snapshotRevision, findingId: 'voice:0' }).findingId).toBe('voice:0')
  })

  it('does not invent host evidence when no inspector ran, and refuses another snapshot or a made-up certification', async () => {
    const f = await fixture()
    const report = await runCreativePlaytest(f)
    expect(report.voiceCoverage).toBeUndefined()
    expect(creativePlaytestFindings(report).some(item => item.kind === 'voice')).toBe(false)
    await expect(runCreativePlaytest(f, { inspectVoiceCoverage: async () => ({ ...f.coverage, snapshotRevision: `sha256:${'0'.repeat(64)}` }) })).rejects.toThrow('snapshot')
    for (const patch of [{ verification: 'server-certified' }, { passed: true }, { rows: [{ ...row, status: 'ready' }] }, { rows: [row, row] }, { rows: [{ ...row, source: { path: '../host.ts' } }] }])
      expect(() => parseCreativePlaytestVoiceCoverage({ ...f.coverage, ...patch })).toThrow()
    expect(() => parseCreativePlaytestReport({ ...report, voiceCoverage: { ...f.coverage, playbackVerified: true } })).toThrow()
  })

  it('retains exact selected identities while leaving byte matching and incomplete inspections outside repair success', async () => {
    const f = await fixture()
    const selected = { takeId: 'take-fixture', assetId: 'voice/fixture', sha256: 'a'.repeat(64) }
    const rows: CreativePlaytestVoiceRow[] = [
      { ...row, address: 'station#ready', status: 'ready', takes: 1, selected },
      { ...row, address: 'station#stale', status: 'stale', takes: 1, selected },
      { ...row, address: 'station#corrupt', status: 'unavailable', takes: 1, selected },
      { ...row, address: 'station#unselected', status: 'unselected', takes: 1 },
      { ...row, address: 'station#unresolved', lineId: undefined, status: 'unresolved' },
    ]
    const coverage: CreativePlaytestVoiceCoverage = { ...f.coverage, complete: false, rows }
    const report = await runCreativePlaytest(f, { inspectVoiceCoverage: async () => coverage })
    expect(report.voiceCoverage?.rows[0]!.selected).toEqual(selected)
    expect(creativePlaytestFindings(report).filter(item => item.kind === 'voice').map(item => item.code)).toEqual(['ADV_CREATIVE_VOICE_STALE', 'ADV_CREATIVE_VOICE_UNAVAILABLE', 'ADV_CREATIVE_VOICE_UNSELECTED', 'ADV_CREATIVE_VOICE_UNRESOLVED'])
    expect(report.executions[0]!.status).toBe('passed')
  })

  it('prioritizes actual issues and explicitly bounds retained evidence without counting omitted rows as passed', async () => {
    const f = await fixture()
    const rows: CreativePlaytestVoiceRow[] = Array.from({ length: 500 }, (_, index) => ({ ...row, address: `station#row-${index}`, status: index === 499 ? 'missing' : 'ready', takes: index === 499 ? 0 : 1, ...(index === 499 ? {} : { selected: { takeId: `take-${index}`, assetId: `voice/${index}`, sha256: 'b'.repeat(64) } }) }))
    const evidence = createCreativePlaytestVoiceCoverage({ ...f.coverage, rows })
    expect(evidence.rows[0]!.address).toBe('station#row-499')
    expect(evidence.rows.length).toBeLessThanOrEqual(128)
    expect(evidence.rows.length + evidence.rowsOmitted).toBe(500)
    expect(new TextEncoder().encode(JSON.stringify(evidence)).length).toBeLessThanOrEqual(16384)
  })
})
