import { test } from '@playwright/test'

test.describe('ADVJS Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3333/')
  })

  test('Load ADV Project', async () => {

  })
})
