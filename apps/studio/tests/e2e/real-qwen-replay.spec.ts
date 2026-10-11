import type { RealQwenMetadata } from '../fixtures/real-qwen/journey'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import { verifyExport } from '../fixtures/real-qwen/journey'

test.skip(process.env.ADVJS_REAL_QWEN !== '1', 'Replays only the opt-in genuine Chromium exports; never generates')
test('plays the same immutable genuine design and Base exports without another model call', async ({ page, request }, info) => {
  const metadata: RealQwenMetadata = await request.get('/fixture/metadata').then(response => response.json())
  const status = await request.get('/fixture/status').then(response => response.json())
  expect(status.calls).toHaveLength(4)
  expect(status.exports).toHaveLength(2)
  await verifyExport(page, info, metadata, 'design', status.exports[0], status.calls[1].candidates[0])
  await verifyExport(page, info, metadata, 'base', status.exports[1], status.calls[3].candidates[0])
  expect((await request.get('/fixture/status').then(response => response.json())).calls).toHaveLength(4)
})
