import type { Route } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

const evidence = new Map<string, { errors: string[], warnings: string[], expectedHttp401: boolean, requests: { method: string, path: string, actor: string }[] }>()
test.beforeEach(async ({ page }, info) => {
  const data = { errors: [] as string[], warnings: [] as string[], expectedHttp401: false, requests: [] as { method: string, path: string, actor: string }[] }
  evidence.set(info.testId, data)
  page.on('pageerror', error => data.errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error')
      data.errors.push(message.text())
    if (message.type() === 'warning')
      data.warnings.push(message.text())
  })
  await page.route('**/fixture-service/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    const actor = request.headers().authorization ?? ''
    data.requests.push({ method: request.method(), path, actor })
    await route.fulfill({ json: path.endsWith('/points/me') ? { availableMicroPoints: actor.includes('next-author') ? 222000 : 123000, reservedMicroPoints: 0, chargedMicroPoints: 0 } : {} })
  })
  await page.goto('/tests/fixtures/creative-team/managed-session.html')
  await expect(page).toHaveTitle('Managed session isolation fixture')
  await expect(page.getByRole('heading', { name: 'Managed session fixture', exact: true })).toBeVisible()
  await expect(page.locator('.agent-console__points dd').first()).toHaveText('123')
  await expect(page.locator('vite-error-overlay')).toHaveCount(0)
})
test.afterEach(async ({ page }, info) => {
  const data = evidence.get(info.testId)!
  await page.screenshot({ path: info.outputPath('final.png'), fullPage: true })
  const unexpectedErrors = data.errors.filter(message => !(data.expectedHttp401 && message === 'Failed to load resource: the server responded with a status of 401 (Unauthorized)'))
  await writeFile(info.outputPath('browser-console.json'), `${JSON.stringify({ ...data, unexpectedErrors }, null, 2)}\n`)
  evidence.delete(info.testId)
  expect(unexpectedErrors).toEqual([])
  expect(data.warnings).toEqual([])
})

test('keeps the new account balance visible when the previous balance returns late', async ({ page }, info) => {
  let held: Route | undefined
  await page.route('**/fixture-service/ai/v2/points/me', async (route) => {
    if (route.request().headers().authorization?.includes('next-author'))
      await route.fulfill({ json: { availableMicroPoints: 222000, reservedMicroPoints: 0, chargedMicroPoints: 0 } })
    else
      held = route
  })
  await page.getByRole('button', { name: 'Refresh balance', exact: true }).click()
  await expect.poll(() => Boolean(held)).toBe(true)
  await page.getByRole('button', { name: 'Switch account', exact: true }).click()
  await expect(page.getByTestId('actor')).toHaveText('next-author')
  await expect(page.locator('.agent-console__points dd').first()).toHaveText('222')
  await held!.fulfill({ json: { availableMicroPoints: 1000, reservedMicroPoints: 0, chargedMicroPoints: 0, activeTask: 'old-task' } })
  await expect(page.getByTestId('outcome')).toHaveText('complete')
  await expect(page.locator('.agent-console__points dd').first()).toHaveText('222')
  expect(evidence.get(info.testId)!.requests.some(request => request.path.includes('old-task'))).toBe(false)
})
test('does not send a delayed AI submission after switching account', async ({ page }, info) => {
  await page.getByRole('button', { name: 'Hold next token', exact: true }).click()
  await page.getByRole('button', { name: 'Submit AI', exact: true }).click()
  await expect(page.getByTestId('token')).toHaveText('held')
  await page.getByRole('button', { name: 'Switch account', exact: true }).click()
  await expect(page.locator('.agent-console__points dd').first()).toHaveText('222')
  await page.getByRole('button', { name: 'Release old token', exact: true }).click()
  await expect(page.getByTestId('outcome')).toHaveText('blocked')
  expect(evidence.get(info.testId)!.requests.filter(request => request.method === 'POST')).toEqual([])
  await expect(page.getByTestId('actor')).toHaveText('next-author')
})
test('does not upload a delayed voice source after returning to the same project', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Hold next token', exact: true }).click()
  await page.getByRole('button', { name: 'Upload voice source', exact: true }).click()
  await expect(page.getByTestId('token')).toHaveText('held')
  await page.getByRole('button', { name: 'Other project', exact: true }).click()
  await page.getByRole('button', { name: 'Station project', exact: true }).click()
  await page.getByRole('button', { name: 'Release old token', exact: true }).click()
  await expect(page.getByTestId('outcome')).toHaveText('blocked')
  await expect(page.getByTestId('scope')).toHaveText('author@station')
  expect(evidence.get(info.testId)!.requests.filter(request => request.method === 'POST')).toEqual([])
})
test('keeps the login when an old voice HTTP 401 arrives after a project round trip', async ({ page }, info) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let held: Route | undefined
  await page.route('**/fixture-service/v1/audio/projects/station/jobs', (route) => {
    held = route
  })
  await page.getByRole('button', { name: 'Read voice jobs', exact: true }).click()
  await expect.poll(() => Boolean(held)).toBe(true)
  await page.getByRole('button', { name: 'Other project', exact: true }).click()
  await page.getByRole('button', { name: 'Station project', exact: true }).click()
  evidence.get(info.testId)!.expectedHttp401 = true
  await held!.fulfill({ status: 401, json: {} })
  await expect(page.getByTestId('outcome')).toHaveText('blocked')
  await expect(page.getByTestId('actor')).toHaveText('author')
  await expect(page.getByTestId('scope')).toHaveText('author@station')
})

test('does not restore the previous identity after the next account has loaded', async ({ page }) => {
  await page.getByRole('button', { name: 'Hold next token', exact: true }).click()
  await page.getByRole('button', { name: 'Refresh identity', exact: true }).click()
  await expect(page.getByTestId('token')).toHaveText('held')
  await page.getByRole('button', { name: 'Switch account', exact: true }).click()
  await expect(page.getByTestId('actor')).toHaveText('next-author')
  await expect(page.locator('.agent-console__points dd').first()).toHaveText('222')
  await page.getByRole('button', { name: 'Release old token', exact: true }).click()
  await expect(page.getByTestId('outcome')).toHaveText('superseded')
  await expect(page.getByTestId('actor')).toHaveText('next-author')
  await expect(page.locator('.agent-console__points dd').first()).toHaveText('222')
})

test('does not resurrect a cleared login when the previous restore finishes', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Hold next token', exact: true }).click()
  await page.getByRole('button', { name: 'Refresh identity', exact: true }).click()
  await expect(page.getByTestId('token')).toHaveText('held')
  await page.getByRole('button', { name: 'Clear login', exact: true }).click()
  await expect(page.getByTestId('actor')).toHaveText('signed out')
  await page.getByRole('button', { name: 'Release old token', exact: true }).click()
  await expect(page.getByTestId('outcome')).toHaveText('superseded')
  await expect(page.getByTestId('actor')).toHaveText('signed out')
  await expect(page.getByTestId('scope')).toHaveText('none@none')
})

test('preserves a replacement account after the old logout returns', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Sign out', exact: true }).click()
  await expect(page.getByTestId('logout')).toHaveText('held')
  await expect(page.getByTestId('actor')).toHaveText('signed out')
  await page.getByRole('button', { name: 'Switch account', exact: true }).click()
  await expect(page.getByTestId('actor')).toHaveText('next-author')
  await expect(page.locator('.agent-console__points dd').first()).toHaveText('222')
  await page.getByRole('button', { name: 'Release old logout', exact: true }).click()
  await expect(page.getByTestId('outcome')).toHaveText('superseded')
  await expect(page.getByTestId('actor')).toHaveText('next-author')
  await expect(page.locator('.agent-console__points dd').first()).toHaveText('222')
})
