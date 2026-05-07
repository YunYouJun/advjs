/**
 * Pure unit test for classifySyncCandidates — the conflict-detection core
 * of useCloudSync.performSync. Covers the 4 decisions × baseline-set vs
 * baseline-missing matrix.
 */
import { describe, expect, it } from 'vitest'
import { classifySyncCandidates } from '../utils/cloudSync'

const T0 = 1_700_000_000_000 // arbitrary baseline ms
const T_BEFORE = T0 - 60_000
const T_AFTER = T0 + 60_000

function maps(local: Record<string, number>, cloud: Record<string, number>) {
  return {
    localPaths: new Map(Object.entries(local)),
    cloudPaths: new Map(Object.entries(cloud)),
  }
}

describe('classifySyncCandidates · baseline set', () => {
  it('files only on local → upload', () => {
    const out = classifySyncCandidates({
      ...maps({ 'a.md': T_AFTER }, {}),
      baselineMs: T0,
    })
    expect(out).toEqual([{ path: 'a.md', decision: 'upload', localMtime: T_AFTER }])
  })

  it('files only on cloud → download', () => {
    const out = classifySyncCandidates({
      ...maps({}, { 'b.md': T_AFTER }),
      baselineMs: T0,
    })
    expect(out).toEqual([{ path: 'b.md', decision: 'download', cloudMtime: T_AFTER }])
  })

  it('only local changed since baseline → upload', () => {
    const out = classifySyncCandidates({
      ...maps({ 'c.md': T_AFTER }, { 'c.md': T_BEFORE }),
      baselineMs: T0,
    })
    expect(out[0]).toMatchObject({ path: 'c.md', decision: 'upload' })
  })

  it('only cloud changed since baseline → download', () => {
    const out = classifySyncCandidates({
      ...maps({ 'd.md': T_BEFORE }, { 'd.md': T_AFTER }),
      baselineMs: T0,
    })
    expect(out[0]).toMatchObject({ path: 'd.md', decision: 'download' })
  })

  it('both sides changed since baseline → conflict', () => {
    const out = classifySyncCandidates({
      ...maps({ 'e.md': T_AFTER + 1000 }, { 'e.md': T_AFTER + 2000 }),
      baselineMs: T0,
    })
    expect(out[0]).toMatchObject({ path: 'e.md', decision: 'conflict' })
    expect(out[0].localMtime).toBe(T_AFTER + 1000)
    expect(out[0].cloudMtime).toBe(T_AFTER + 2000)
  })

  it('neither side changed since baseline → noop', () => {
    const out = classifySyncCandidates({
      ...maps({ 'f.md': T_BEFORE }, { 'f.md': T_BEFORE }),
      baselineMs: T0,
    })
    expect(out[0]).toMatchObject({ path: 'f.md', decision: 'noop' })
  })

  it('mixed batch produces deterministic decisions per file', () => {
    const out = classifySyncCandidates({
      ...maps(
        { 'up.md': T_AFTER, 'noop.md': T_BEFORE, 'conflict.md': T_AFTER },
        { 'noop.md': T_BEFORE, 'conflict.md': T_AFTER + 100, 'down.md': T_AFTER },
      ),
      baselineMs: T0,
    })
    const byPath = Object.fromEntries(out.map(c => [c.path, c.decision]))
    expect(byPath).toEqual({
      'up.md': 'upload',
      'noop.md': 'noop',
      'conflict.md': 'conflict',
      'down.md': 'download',
    })
  })
})

describe('classifySyncCandidates · baseline missing (first-time sync)', () => {
  it('falls back to newer-wins (local newer → upload)', () => {
    const out = classifySyncCandidates({
      ...maps({ 'a.md': T_AFTER }, { 'a.md': T_BEFORE }),
      baselineMs: undefined,
    })
    expect(out[0]).toMatchObject({ path: 'a.md', decision: 'upload' })
  })

  it('falls back to newer-wins (cloud newer → download)', () => {
    const out = classifySyncCandidates({
      ...maps({ 'a.md': T_BEFORE }, { 'a.md': T_AFTER }),
      baselineMs: undefined,
    })
    expect(out[0]).toMatchObject({ path: 'a.md', decision: 'download' })
  })

  it('equal mtimes → noop, never conflict (no baseline available)', () => {
    const out = classifySyncCandidates({
      ...maps({ 'a.md': T_AFTER }, { 'a.md': T_AFTER }),
      baselineMs: undefined,
    })
    expect(out[0]).toMatchObject({ path: 'a.md', decision: 'noop' })
  })
})
