import type { ElectronApplication, Page } from '@playwright/test'
import { expect } from '@playwright/test'

/** The player WebContentsView is distinct from its optional window's blank page. */
export async function waitForGamePreview(app: ElectronApplication, editor: Page) {
  await expect.poll(async () => {
    const task = await editor.evaluate(() => window.advDesktop!.taskStatus())
    return task?.state === 'failed' ? `failed: ${task.error}` : task?.state
  }, { timeout: 120000 }).toBe('succeeded')
  const output = (await editor.evaluate(() => window.advDesktop!.taskStatus()))!.output!
  await expect.poll(() => app.context().pages().some(page => page.url().startsWith(output))).toBe(true)
  return app.context().pages().find(page => page.url().startsWith(output))!
}
