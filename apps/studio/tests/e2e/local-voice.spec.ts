import type { Page } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { startLocalVoiceFixture } from '../fixtures/local-voice/server'

async function loggedIn(page: Page) {
  return page.evaluate(() => {
    const root = document.getElementById('app') as HTMLElement & { __vue_app__?: { config: { globalProperties: { $pinia?: { _s: Map<string, { isLoggedIn: boolean }> } } } } }
    return root.__vue_app__?.config.globalProperties.$pinia?._s.get('auth')?.isLoggedIn
  })
}

/** Return only a boolean, never serialized credential-bearing storage records. */
async function persistedCredential(page: Page, accessToken: string) {
  return page.evaluate(async (credential) => {
    if ([localStorage, sessionStorage].some(storage => Object.values(storage).some(value => typeof value === 'string' && value.includes(credential))))
      return true
    for (const info of await indexedDB.databases()) {
      if (!info.name)
        continue
      const request = indexedDB.open(info.name)
      const database = await new Promise<IDBDatabase>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      try {
        for (const name of database.objectStoreNames) {
          const all = database.transaction(name).objectStore(name).getAll()
          const records = await new Promise<unknown[]>((resolve, reject) => {
            all.onsuccess = () => resolve(all.result)
            all.onerror = () => reject(all.error)
          })
          if (JSON.stringify(records).includes(credential))
            return true
        }
      }
      finally {
        database.close()
      }
    }
    return false
  }, accessToken)
}

test('the production Studio app pairs locally without cloud login, revokes and reconnects', async ({ page, baseURL }, info) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/tabs/workspace')
  await page.getByText('立即体验', { exact: true }).first().click()
  // Quickstart switches all project stores before its final world navigation.
  // Wait for that transaction, then use the real project overview's audio card.
  await expect(page).toHaveURL(/\/tabs\/world$/u, { timeout: 30_000 })
  await page.getByRole('link', { name: '工作区', exact: true }).click()
  const audioCard = page.getByRole('button', { name: /^音频素材/u })
  await expect(audioCard).toBeVisible()
  await audioCard.click()
  await expect(page).toHaveURL(/\/tabs\/workspace\/audio$/u)
  await page.getByRole('button', { name: '创建原生目录', exact: true }).click()
  const pairing = page.getByTestId('local-voice-connection')
  const projectId = (await pairing.getByTestId('audio-local-project-id').textContent())!.trim()
  expect(projectId.length).toBeGreaterThan(0)
  await expect.poll(() => loggedIn(page)).toBe(false)
  const host = await startLocalVoiceFixture(projectId, baseURL!)
  const paths: string[] = []
  page.on('request', request => request.url().startsWith(host.url) && paths.push(new URL(request.url()).pathname))
  async function connect(credential: string) {
    await pairing.getByLabel('本地服务地址', { exact: true }).fill(host.url)
    await pairing.getByLabel('配对凭据', { exact: true }).fill(credential)
    await pairing.getByRole('button', { name: '连接本地服务', exact: true }).click()
  }
  try {
    // This intentionally invalid capability is not a supplier API credential.
    await connect('0'.repeat(64))
    await expect(pairing.getByRole('alert')).toBeVisible()
    await expect(pairing.getByRole('status')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '生成配音', exact: true })).toBeDisabled()
    await connect(host.accessToken)
    await expect(pairing.getByRole('status')).toHaveText(`已连接本机服务：${host.url}`)
    await expect(pairing.locator('input[type="password"]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '生成配音', exact: true })).toBeEnabled()
    await expect.poll(() => loggedIn(page)).toBe(false)
    await page.getByRole('button', { name: '音色设计', exact: true }).click()
    const designer = page.getByTestId('voice-design-workspace')
    await expect(designer.locator('fieldset option[value="fixture-tts"]')).toHaveCount(1)
    await expect(designer.getByRole('alert')).toHaveCount(0)
    await page.getByRole('button', { name: '配音任务', exact: true }).click()
    const jobs = page.getByTestId('voice-jobs')
    await expect(jobs).toContainText('服务端持久保存生成任务')
    await expect(jobs.getByRole('link', { name: '登录', exact: true })).toHaveCount(0)
    const publication = page.getByTestId('audio-publication')
    await publication.getByRole('button', { name: '查询发布状态', exact: true }).click()
    await expect.poll(() => host.status().publicationReads).toBe(1)
    await expect(publication.getByRole('alert')).toHaveCount(0)
    expect(paths).toContain(`/v1/audio/projects/${projectId}/jobs`)
    expect(paths).toContain(`/v1/audio/projects/${projectId}/voice-design`)
    expect(paths).toContain(`/v1/audio/projects/${projectId}/releases/current`)
    expect(await persistedCredential(page, host.accessToken)).toBe(false)
    for (const [label, width, height] of [['normal', 1280, 980], ['narrow', 390, 844]] as const) {
      await page.setViewportSize({ width, height })
      await pairing.scrollIntoViewIfNeeded()
      await expect(pairing).toBeVisible()
      expect(await pairing.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
      await page.screenshot({ path: info.outputPath(`studio-local-voice-${label}.png`), fullPage: true })
    }
    await pairing.getByRole('button', { name: '断开本机连接', exact: true }).click()
    await expect(pairing.getByLabel('配对凭据', { exact: true })).toHaveValue('')
    await expect(publication.getByRole('button', { name: '查询发布状态', exact: true })).toBeDisabled()
    await connect(host.accessToken)
    await expect(pairing.getByRole('status')).toBeVisible()
    await page.reload()
    await expect(pairing.getByLabel('配对凭据', { exact: true })).toHaveValue('')
    await expect(pairing.getByRole('status')).toHaveCount(0)
    await expect(page.getByRole('button', { name: '生成配音', exact: true })).toBeDisabled()
    expect(await persistedCredential(page, host.accessToken)).toBe(false)
    await connect(host.accessToken)
    await expect(pairing.getByRole('status')).toBeVisible()
    await page.getByRole('button', { name: '配音任务', exact: true }).click()
    await expect(jobs).toContainText('服务端持久保存生成任务')
    await expect.poll(() => loggedIn(page)).toBe(false)
    expect(host.status().synthesisCalls).toBe(0)
    expect(errors).toEqual([])
    await writeFile(info.outputPath('local-voice-proof.json'), JSON.stringify({ projectId, accountId: 'local-device', cloudLoggedIn: false, synthesisCalls: 0, persistedCredential: false, wrongTokenRejected: true, refreshRequiresPairing: true, publicationPort: 'fixture-route-only', paths: [...new Set(paths)], errors }, null, 2))
  }
  finally {
    await host.close()
  }
})
