import type { Locator, Page } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'

function wav() {
  const samples = 24000
  const data = Buffer.alloc(44 + samples * 2)
  data.write('RIFF', 0)
  data.writeUInt32LE(36 + samples * 2, 4)
  data.write('WAVEfmt ', 8)
  data.writeUInt32LE(16, 16)
  data.writeUInt16LE(1, 20)
  data.writeUInt16LE(1, 22)
  data.writeUInt32LE(24000, 24)
  data.writeUInt32LE(48000, 28)
  data.writeUInt16LE(2, 32)
  data.writeUInt16LE(16, 34)
  data.write('data', 36)
  data.writeUInt32LE(samples * 2, 40)
  for (let index = 0; index < samples; index++)
    data.writeInt16LE(Math.round(Math.sin(index * 2 * Math.PI * 220 / 24000) * 1200), 44 + index * 2)
  return data
}

async function readProjectFile(page: Page, path: string) {
  return page.evaluate(async (path) => {
    const request = indexedDB.open('advjs-studio')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const key = `memfs:${localStorage.getItem('advjs-studio-current')}:${path}`
      const lookup = database.transaction('memfsNodes').objectStore('memfsNodes').get(key)
      return await new Promise<string | null>((resolve, reject) => {
        lookup.onsuccess = () => resolve(lookup.result?.content ?? null)
        lookup.onerror = () => reject(lookup.error)
      })
    }
    finally {
      database.close()
    }
  }, path)
}

async function seedReviewedTakes(page: Page, bytes: Buffer) {
  await expect.poll(() => readProjectFile(page, 'adv/assets.json')).toBeTruthy()
  const lineId = 'line_01900400-0000-7000-8000-000000000010'
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const assets = [1, 2, 3].map(index => ({ id: `audio_01900400-0000-7000-8000-00000000002${index}`, type: 'audio', kind: 'voice', path: `audio/voice-${index}.wav`, sha256, bytes: bytes.length, mimeType: 'audio/wav', duration: 1, title: `Voice take ${index}` }))
  const takes = assets.map((asset, index) => ({ id: `take_01900400-0000-7000-8000-00000000003${index}`, assetId: asset.id, sha256, providerId: 'fixture-native', voiceId: 'reviewed-voice', model: 'offline-fixture', voiceProfileRevision: 'a'.repeat(64), inputFingerprint: 'b'.repeat(64), spokenText: index === 0 ? '欢迎来到海边。' : index === 1 ? '早先的对白。' : 'Welcome to the seaside.', createdAt: '2026-10-11T08:00:00.000Z', source: 'system' }))
  const ledger = { schemaVersion: 1, lines: { [lineId]: { speakerId: 'ye-qing', displayText: '欢迎来到海边。', locales: { 'zh-CN': { selectedTake: takes[0]!.id, takes: takes.slice(0, 2) }, 'en': { displayText: 'Welcome to the seaside.', selectedTake: null, takes: takes.slice(2) } } } } }
  const fragment = JSON.parse((await readProjectFile(page, 'adv/assets/audio.json')) ?? '{"schemaVersion":2,"assets":[]}')
  const root = JSON.parse((await readProjectFile(page, 'adv/assets.json'))!)
  if (!root.includes.includes('assets/audio.json'))
    root.includes.push('assets/audio.json')
  fragment.assets.push(...assets)
  await page.evaluate(async ({ assets, ledger, fragment, root, bytes, lineId }) => {
    const request = indexedDB.open('advjs-studio')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const transaction = database.transaction('memfsNodes', 'readwrite')
    const table = transaction.objectStore('memfsNodes')
    const projectId = localStorage.getItem('advjs-studio-current')
    const put = (path: string, content?: string, blob?: Blob) => {
      const segments = path.split('/')
      for (let count = 1; count < segments.length; count++)
        table.put({ key: `memfs:${projectId}:${segments.slice(0, count).join('/')}`, type: 'directory', content: '', size: 0, mtime: Date.now() })
      table.put({ key: `memfs:${projectId}:${path}`, type: 'file', content: content ?? '', blob, size: blob?.size ?? content?.length ?? 0, mtime: Date.now() })
    }
    put('adv/assets/audio.json', JSON.stringify(fragment))
    put('adv/assets.json', JSON.stringify(root))
    put('adv/audio/voice-ledger.json', JSON.stringify(ledger))
    put('adv/chapters/audio-review.adv.md', `@叶晴\n欢迎来到海边。 {#${lineId}}`)
    for (const asset of assets)
      put(`adv/assets/${asset.path}`, undefined, new Blob([new Uint8Array(bytes)], { type: 'audio/wav' }))
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  }, { assets, ledger, fragment, root, bytes: [...bytes], lineId })
  await page.reload()
  return { lineId, takes }
}

async function writeProjectFile(page: Page, path: string, content: string) {
  await page.evaluate(async ({ path, content }) => {
    const request = indexedDB.open('advjs-studio')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const transaction = database.transaction('memfsNodes', 'readwrite')
    transaction.objectStore('memfsNodes').put({ key: `memfs:${localStorage.getItem('advjs-studio-current')}:${path}`, type: 'file', content, size: content.length, mtime: Date.now() })
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  }, { path, content })
}

async function configureProfile(page: Page, fields: Locator) {
  for (const [field, value] of Object.entries({ locale: 'zh-CN', providerId: 'fixture-native', model: 'offline-fixture', voiceId: 'reviewed-voice' }))
    await fields.locator(`[data-field="${field}"] input`).fill(value)
  await fields.getByRole('combobox').last().click()
  await page.getByRole('option', { name: '系统声音', exact: true }).click()
  await fields.getByRole('button', { name: '应用服务绑定', exact: true }).click()
  await expect(fields.locator('.voice-profile-fields__bindings')).toContainText('fixture-native')
}

async function readPrivateJobs(page: Page) {
  return await page.evaluate(async () => {
    const request = indexedDB.open('advjs-studio-private-audio-jobs-v1')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const lookup = database.transaction('documents').objectStore('documents').getAll()
    const result = await new Promise<Array<{ scopeKey: string, document: { jobs: Record<string, { id: string, tasks: Array<{ status: string, speakerId: string, characterCount: number }>, cancelled: boolean }> } }>>((resolve, reject) => {
      lookup.onsuccess = () => resolve(lookup.result)
      lookup.onerror = () => reject(lookup.error)
    })
    database.close()
    return result
  })
}

test('native Studio audio library, voice review and mixer work at desktop and mobile widths', async ({ page }, testInfo) => {
  test.setTimeout(90000)
  const failures: string[] = []
  page.on('pageerror', error => failures.push(error.message))
  await page.goto('/tabs/workspace')
  await page.getByText('立即体验', { exact: true }).first().click()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('advjs-studio-current'))).toBeTruthy()
  await page.goto('/tabs/workspace/audio')
  await page.getByRole('button', { name: '创建原生目录', exact: true }).click()
  await expect(page.getByTestId('audio-workspace').getByRole('button', { name: '生成配音', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: '导入音频', exact: true }).click()
  const bytes = wav()
  await page.locator('input[type="file"]').setInputFiles({ name: '海边音乐.wav', mimeType: 'audio/wav', buffer: bytes })
  await page.locator('.audio-asset-form').getByRole('combobox').click()
  await page.getByRole('option', { name: '音乐', exact: true }).click()
  await page.locator('.audio-asset-form').getByRole('button', { name: '导入音频', exact: true }).click()
  await expect(page.locator('.audio-library__asset')).toHaveCount(1)
  await expect(page.locator('.audio-library__asset')).toContainText('海边音乐.wav')
  await expect.poll(async () => (await readProjectFile(page, 'adv/assets/audio.json'))?.includes('sha256')).toBe(true)
  expect(JSON.parse((await readProjectFile(page, 'adv/assets/audio.json'))!).assets[0].kind).toBe('bgm')
  expect(await readProjectFile(page, 'adv/audio/海边音乐.md')).toBeNull()
  await page.getByRole('button', { name: '混音器', exact: true }).click()
  await page.locator('#mixer-gain-music').evaluate((element) => {
    const input = element as HTMLInputElement
    input.value = '0.62'
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.getByRole('button', { name: '保存项目混音', exact: true }).click()
  await expect.poll(async () => JSON.parse((await readProjectFile(page, 'adv/audio/mixer.json')) ?? '{}').buses?.music?.gain).toBe(0.62)
  const fixture = await seedReviewedTakes(page, bytes)
  await page.getByRole('button', { name: '配音审核', exact: true }).click()
  await expect(page.locator('.voice-review__line')).toHaveCount(2)
  await expect(page.getByText('文本已变化', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: '替换已选配音', exact: true }).click()
  await page.locator('.voice-review__confirmation input[type=checkbox]').check()
  await page.getByRole('button', { name: '确认采用', exact: true }).click()
  await expect.poll(async () => JSON.parse((await readProjectFile(page, 'adv/audio/voice-ledger.json')) ?? '{}').lines?.[fixture.lineId]?.locales?.['zh-CN']?.selectedTake).toBe(fixture.takes[1]!.id)
  await expect(page.locator('.voice-review__take')).toHaveCount(3)
  await page.getByRole('button', { name: '绑定此 take', exact: true }).click()
  await page.locator('.voice-review__confirmation input[type=checkbox]').check()
  await page.getByRole('button', { name: '确认采用', exact: true }).click()
  await expect.poll(async () => JSON.parse((await readProjectFile(page, 'adv/audio/voice-ledger.json')) ?? '{}').lines?.[fixture.lineId]?.locales?.en?.selectedTake).toBe(fixture.takes[2]!.id)
  await page.setViewportSize({ width: 1280, height: 980 })
  await page.locator('ion-content').filter({ has: page.getByTestId('audio-workspace') }).evaluate(element => (element as HTMLElement & { scrollToTop: (duration: number) => Promise<void> }).scrollToTop(0))
  await page.screenshot({ path: testInfo.outputPath('studio-audio-normal.png'), fullPage: true })
  await page.locator('.voice-review__line').first().screenshot({ path: testInfo.outputPath('studio-take-review-normal.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.locator('ion-content').filter({ has: page.getByTestId('audio-workspace') }).evaluate(element => (element as HTMLElement & { scrollToTop: (duration: number) => Promise<void> }).scrollToTop(0))
  await page.screenshot({ path: testInfo.outputPath('studio-audio-narrow.png'), fullPage: true })
  await page.locator('.voice-review__line').first().screenshot({ path: testInfo.outputPath('studio-take-review-narrow.png') })
  expect(await page.getByTestId('audio-workspace').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await page.getByRole('button', { name: '资源库', exact: true }).click()
  await page.locator('ion-content').filter({ has: page.getByTestId('audio-workspace') }).evaluate(element => (element as HTMLElement & { scrollToTop: (duration: number) => Promise<void> }).scrollToTop(0))
  await page.screenshot({ path: testInfo.outputPath('studio-audio-library-narrow.png'), fullPage: true })
  await page.getByRole('button', { name: '混音器', exact: true }).click()
  await page.locator('ion-content').filter({ has: page.getByTestId('audio-workspace') }).evaluate(element => (element as HTMLElement & { scrollToTop: (duration: number) => Promise<void> }).scrollToTop(0))
  await page.screenshot({ path: testInfo.outputPath('studio-audio-mixer-narrow.png'), fullPage: true })
  await page.getByRole('button', { name: '资源库', exact: true }).click()
  await page.locator('.audio-library__asset').first().getByRole('button', { name: '试听', exact: true }).click()
  const player = page.locator('.audio-workspace__preview audio')
  await expect.poll(() => player.evaluate(element => (element as HTMLAudioElement).duration)).toBe(1)
  await player.click({ position: { x: 24, y: 26 } })
  await expect.poll(() => player.evaluate(element => (element as HTMLAudioElement).paused)).toBe(false)
  await page.locator('ion-back-button').last().click()
  await expect(page.locator('.audio-workspace__preview audio')).toHaveCount(0)
  expect(failures).toEqual([])
})

test('Studio private voice plans persist, isolate scope and block uncertain outcomes with real author inputs', async ({ page, context }, testInfo) => {
  test.setTimeout(120000)
  const failures: string[] = []
  page.on('pageerror', error => failures.push(error.message))
  await page.goto('/tabs/workspace')
  await page.getByText('立即体验', { exact: true }).first().click()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('advjs-studio-current'))).toBeTruthy()
  await page.goto('/tabs/workspace/audio')
  await page.getByRole('button', { name: '创建原生目录', exact: true }).click()
  // Seed persisted immutable history; generation remains a real host capability.
  await seedReviewedTakes(page, wav())
  const narratorId = 'line_01900400-0000-7000-8000-000000000011'
  await writeProjectFile(page, 'adv/chapters/audio-narrator.adv.md', `> ADV海岸旁白。 {#${narratorId}}`)

  await page.goto('/tabs/workspace/characters')
  await page.locator('.cc-wrapper').filter({ hasText: '叶晴' }).getByRole('button', { name: '编辑', exact: true }).click()
  const characterFields = page.locator('ion-modal').getByTestId('voice-profile-fields')
  await configureProfile(page, characterFields)
  await page.setViewportSize({ width: 390, height: 844 })
  await characterFields.scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('studio-character-voice-narrow.png'), fullPage: true })
  await page.locator('ion-modal .cem-save-btn').click()
  await expect.poll(async () => (await readProjectFile(page, 'adv/characters/ye-qing.character.md'))?.includes('voiceProfile:')).toBe(true)

  await page.goto('/tabs/workspace/audio')
  await page.getByRole('button', { name: '配音任务', exact: true }).click()
  const jobs = page.getByTestId('voice-jobs')
  await jobs.getByText('项目旁白声音', { exact: true }).click()
  const narratorFields = jobs.getByTestId('voice-profile-fields')
  await configureProfile(page, narratorFields)
  await narratorFields.scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('studio-narrator-voice-narrow.png'), fullPage: true })
  await jobs.getByRole('button', { name: '保存旁白配置', exact: true }).click()
  await expect.poll(async () => JSON.parse((await readProjectFile(page, 'adv/audio/voice-profiles.json')) ?? '{}').narrator?.locales?.['zh-CN']?.providers?.['fixture-native']?.model).toBe('offline-fixture')

  await jobs.getByText('项目发音词典', { exact: true }).click()
  await jobs.getByRole('button', { name: '添加发音规则', exact: true }).click()
  const rule = jobs.locator('.voice-configuration__row')
  await rule.locator('input').nth(1).fill('ADV')
  await rule.locator('input').nth(2).fill('冒险')
  await rule.scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('studio-pronunciation-narrow.png'), fullPage: true })
  await jobs.getByRole('button', { name: '保存发音词典', exact: true }).click()
  await expect.poll(async () => JSON.parse((await readProjectFile(page, 'adv/audio/pronunciation.json')) ?? '{}').replacements?.ADV).toBe('冒险')
  await jobs.locator('.voice-jobs__form').getByRole('combobox').nth(1).click()
  await page.getByRole('option', { name: 'zh-CN', exact: true }).click()
  await jobs.locator('.voice-jobs__form').getByRole('combobox').nth(3).click()
  await page.getByRole('option', { name: '整个范围', exact: true }).click()
  await jobs.getByRole('button', { name: '审核生成计划', exact: true }).click()
  await expect(jobs.getByRole('alert')).toContainText('供应商报价未知')
  await jobs.getByRole('checkbox').check()
  await context.setOffline(true)
  await expect(jobs).toContainText('当前离线')
  await jobs.getByRole('button', { name: '审核生成计划', exact: true }).click()
  await expect(jobs.locator('.voice-jobs__review')).toContainText('费用未知')
  await jobs.getByRole('button', { name: '确认并保存计划', exact: true }).click()
  await expect(jobs.locator('.voice-jobs__job')).toHaveCount(1)
  await expect(jobs.getByRole('button', { name: '执行已确认计划', exact: true })).toBeDisabled()
  const stored = (await readPrivateJobs(page))[0]!
  const job = Object.values(stored.document.jobs)[0]!
  expect(job.tasks.map(task => task.speakerId).sort()).toEqual(['narrator', 'ye-qing'])
  expect(job.tasks.find(task => task.speakerId === 'narrator')?.characterCount).toBe(7)
  expect(JSON.stringify(stored)).not.toContain('欢迎来到海边')
  expect(JSON.stringify(stored)).not.toContain('ADV海岸旁白')
  expect(JSON.stringify(stored)).not.toContain('pronunciation')
  await jobs.getByRole('button', { name: '取消任务', exact: true }).click()
  await expect(jobs.locator('.voice-jobs__job')).toContainText('已取消')
  await context.setOffline(false)
  await page.reload()
  await page.getByRole('button', { name: '配音任务', exact: true }).click()
  await expect(jobs.locator('.voice-jobs__job')).toContainText('已取消')
  await jobs.getByRole('button', { name: '恢复排队', exact: true }).click()
  await expect(jobs.locator('.voice-jobs__job')).toContainText('等待执行')

  // Simulate another tab crashing after dispatch. A reload must never resend it.
  await page.evaluate(async ({ scopeKey, jobId }) => {
    const request = indexedDB.open('advjs-studio-private-audio-jobs-v1')
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const transaction = database.transaction('documents', 'readwrite')
    const table = transaction.objectStore('documents')
    const lookup = table.get(scopeKey)
    lookup.onsuccess = () => {
      const row = lookup.result
      const original = row.document.jobs[jobId]
      const task = original.tasks[0]
      task.status = 'running'
      task.attempts = 1
      row.document.idempotency[task.idempotencyKey] = { key: task.idempotencyKey, accountId: original.accountId, projectId: original.projectId, inputFingerprint: task.inputFingerprint, ownerJobId: original.id, ownerTaskId: task.id, status: 'running', createdAt: original.createdAt, updatedAt: original.updatedAt, expiresAt: original.expiresAt }
      table.put(row)
      // A foreign account's otherwise valid job must stay isolated.
      const foreign = structuredClone(row)
      foreign.scopeKey = JSON.stringify(['another-account', original.projectId])
      foreign.document.jobs[jobId].accountId = 'another-account'
      foreign.document.idempotency[task.idempotencyKey].accountId = 'another-account'
      table.put(foreign)
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    database.close()
  }, { scopeKey: stored.scopeKey, jobId: job.id })
  await page.reload()
  await page.getByRole('button', { name: '配音任务', exact: true }).click()
  await expect(jobs.locator('.voice-jobs__job')).toHaveCount(1)
  await expect(jobs.locator('.voice-jobs__job')).toContainText('结果未知')
  await expect(jobs.getByRole('button', { name: '执行已确认计划', exact: true })).toBeDisabled()
  await expect(jobs.getByRole('button', { name: '重新排队已确认失败项', exact: true })).toHaveCount(0)
  expect(await readPrivateJobs(page)).toHaveLength(2)
  await jobs.locator('.voice-jobs__job').scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('studio-voice-jobs-narrow.png'), fullPage: true })
  expect(await jobs.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  await page.setViewportSize({ width: 1280, height: 980 })
  await page.screenshot({ path: testInfo.outputPath('studio-voice-jobs-normal.png'), fullPage: true })
  await page.evaluate(() => localStorage.setItem('advjs-studio-locale', 'en'))
  await page.reload()
  await page.getByRole('button', { name: 'Voice jobs', exact: true }).click()
  await expect(jobs).toContainText('Unknown outcome; verification required')
  await expect(jobs.getByRole('button', { name: 'Run approved plan', exact: true })).toBeDisabled()
  await page.setViewportSize({ width: 390, height: 844 })
  await jobs.locator('.voice-jobs__job').scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath('studio-voice-jobs-en-narrow.png'), fullPage: true })
  expect(await jobs.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  expect(failures).toEqual([])
})
