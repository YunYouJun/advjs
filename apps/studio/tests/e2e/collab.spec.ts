import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

type CollabScenario = 'convergence' | 'reconnect' | 'permission-denied'

interface CollabScenarioResult {
  ownerText: string
  peerText: string
  rejectedWrites: number
  writeErrors: number
}

async function runCollabScenario(page: Page, scenario: CollabScenario) {
  await page.goto('/')
  return page.evaluate(async (requestedScenario) => {
    const { runCollabScenario } = await import('/tests/e2e/fixtures/collab-harness.ts')
    return runCollabScenario(requestedScenario)
  }, scenario) as Promise<CollabScenarioResult>
}

test.describe('Collaboration', () => {
  test('collab settings explains when no room is active', async ({ page }) => {
    await page.goto('/tabs/workspace/collab')

    await expect(page.getByRole('banner').filter({ hasText: /协作设置|Collaboration Settings/ })).toBeVisible()
    await expect(page.getByText(/当前未加入协作房间|Not in a collaboration room/)).toBeVisible()
  })

  test('two clients converge after editing the same document', async ({ page }) => {
    const result = await runCollabScenario(page, 'convergence')

    expect(result.ownerText).toBe('owner-editor')
    expect(result.peerText).toBe(result.ownerText)
    expect(result.rejectedWrites).toBe(0)
  })

  test('a disconnected client catches up and can publish after reconnecting', async ({ page }) => {
    const result = await runCollabScenario(page, 'reconnect')

    expect(result.ownerText).toBe('before-offline-after-reconnect')
    expect(result.peerText).toBe(result.ownerText)
    expect(result.rejectedWrites).toBe(0)
  })

  test('a viewer write is rejected and never reaches the editor', async ({ page }) => {
    const result = await runCollabScenario(page, 'permission-denied')

    expect(result.ownerText).toBe('published')
    expect(result.peerText).toBe('published-forbidden')
    expect(result.rejectedWrites).toBe(1)
    expect(result.writeErrors).toBe(1)
  })
})
