// @vitest-environment node

import type { RuntimeSnapshot } from '@advjs/types'
import { createRuntimeDebugReport } from '@advjs/client/runtime'
import { describe, expect, it } from 'vitest'
import { createRuntimeReportPayload } from '../utils/runtimeReport'

const snapshot: RuntimeSnapshot = {
  schemaVersion: 1,
  program: { id: 'studio-project', hash: 'fixture-v1' },
  state: {
    status: 'playing',
    cursor: { chapterId: 'chapter-1', nodeId: 'line-1' },
    variables: { route: 'observe' },
    stage: { background: 'night.svg', bgm: '', tachies: {} },
    choices: [],
    visited: ['chapter-1#line-1'],
  },
  checkpoints: [],
  createdAt: 2,
}

describe('runtime report export', () => {
  it('uses one pretty-printed JSON payload for clipboard and download', async () => {
    const report = createRuntimeDebugReport({
      snapshot,
      trace: [],
      diagnostics: [{ code: 'STUDIO_FIXTURE', severity: 'warning' }],
    })
    const payload = createRuntimeReportPayload(report)

    expect(payload.filename).toBe('advjs-runtime-report.json')
    expect(payload.mimeType).toBe('application/json')
    expect(payload.text).toContain('\n  "engine": "advjs"')
    expect(await payload.blob.text()).toBe(payload.text)
    expect(JSON.parse(payload.text)).toEqual(report)
  })

  it('does not add chapter prose or filesystem handles to the report', () => {
    const report = createRuntimeDebugReport({ snapshot, trace: [] })
    const payload = createRuntimeReportPayload(report)

    expect(payload.text).not.toContain('KNOWN SECRET CHAPTER PROSE')
    expect(payload.text).not.toContain('FileSystemDirectoryHandle')
    expect(payload.text).not.toContain('directoryHandle')
  })
})
