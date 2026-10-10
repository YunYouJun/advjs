import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test as base } from '@playwright/test'

// Chromium 153 crashes when an incognito IndexedDB reads FileSystemHandles:
// https://issues.chromium.org/issues/562119515
// Use an isolated on-disk profile for real handle persistence and recovery.
// No workspace data or browser profile is shared between tests or retries.
export const test = base.extend({
  context: async ({ playwright, browserName, launchOptions, headless, channel, contextOptions, viewport, locale, userAgent, deviceScaleFactor, isMobile, hasTouch }, use) => {
    const profile = await mkdtemp(join(tmpdir(), 'advjs-browser-workspace-'))
    try {
      const context = await playwright[browserName].launchPersistentContext(profile, {
        ...launchOptions,
        ...contextOptions,
        headless,
        channel,
        viewport,
        locale,
        userAgent,
        deviceScaleFactor,
        isMobile,
        hasTouch,
      })
      try {
        await use(context)
      }
      finally {
        // Playwright records configured traces and failure screenshots on close.
        await context.close()
      }
    }
    finally {
      await rm(profile, { recursive: true, force: true })
    }
  },
  page: async ({ context }, use) => {
    await use(context.pages()[0] ?? await context.newPage())
  },
})
