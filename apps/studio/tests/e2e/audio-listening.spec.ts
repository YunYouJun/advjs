import type { Page } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { inspectVoiceListeningSession } from '@advjs/audio'
import { expect, test } from '@playwright/test'
import { createEditorBridge } from 'advjs/node'
import { createEditorListeningFixture } from '../../../../tests/fixtures/audio/editor-listening'

async function seedNativeProject(page: Page, fixture: Awaited<ReturnType<typeof createEditorListeningFixture>>) {
  const files = Object.entries(fixture.files).map(([path, content]) => ({ path, content, bytes: undefined as number[] | undefined }))
  for (const asset of fixture.assets)
    files.push({ path: `public/media/${asset.path}`, content: '', bytes: [...await readFile(join(fixture.root, 'public/media', asset.path))] })
  await page.evaluate(async (files) => {
    const request = indexedDB.open('advjs-studio')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const prefix = `memfs:${localStorage.getItem('advjs-studio-current')}:`
    const transaction = db.transaction('memfsNodes', 'readwrite')
    const store = transaction.objectStore('memfsNodes')
    // This fresh Playwright context owns the QuickStart project. Only its
    // temporary FS is replaced; no native author project or model cache is used.
    const cursor = store.openCursor()
    cursor.onsuccess = () => {
      const item = cursor.result
      if (item) {
        if (String(item.key).startsWith(prefix))
          item.delete()
        item.continue()
        return
      }
      for (const file of files) {
        const parts = file.path.split('/')
        for (let i = 1; i < parts.length; i++)
          store.put({ key: prefix + parts.slice(0, i).join('/'), type: 'directory', content: '', size: 0, mtime: Date.now() })
        // Use the adapter's production byte persistence format. Safari does not
        // reliably clone Blob values into IndexedDB; init reconstructs these.
        const binary = file.bytes ? new Uint8Array(file.bytes).buffer : undefined
        store.put({ key: prefix + file.path, type: 'file', content: file.content, ...(binary ? { binary, mimeType: 'audio/wav' } : {}), size: binary?.byteLength ?? new TextEncoder().encode(file.content).length, mtime: Date.now() })
      }
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = (event) => {
        const code = transaction.error?.name ?? (event.target as IDBRequest).error?.name ?? 'UNKNOWN'
        reject(new Error(`Native fixture storage failed: ${code}`))
      }
    })
    db.close()
  }, files)
}

async function nativeLedger(page: Page): Promise<string> {
  return await page.evaluate(async () => {
    const request = indexedDB.open('advjs-studio')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const key = `memfs:${localStorage.getItem('advjs-studio-current')}:adv/audio/voice-ledger.json`
      const lookup = db.transaction('memfsNodes').objectStore('memfsNodes').get(key)
      return await new Promise<string>((resolve, reject) => {
        lookup.onsuccess = () => resolve(lookup.result.content)
        lookup.onerror = () => reject(lookup.error)
      })
    }
    finally {
      db.close()
    }
  })
}

async function updateNativeFixtureFile(page: Page, path: string, content?: string, bytes?: Uint8Array) {
  await page.evaluate(async ({ path, content, bytes }) => {
    const request = indexedDB.open('advjs-studio')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const transaction = db.transaction('memfsNodes', 'readwrite')
      const table = transaction.objectStore('memfsNodes')
      const key = `memfs:${localStorage.getItem('advjs-studio-current')}:${path}`
      const lookup = table.get(key)
      lookup.onsuccess = () => {
        if (!lookup.result) {
          transaction.abort()
          return
        }
        const row = { ...lookup.result, mtime: Date.now() }
        if (content !== undefined) {
          row.content = content
          row.size = new TextEncoder().encode(content).length
        }
        if (bytes) {
          row.binary = new Uint8Array(bytes).buffer
          row.mimeType = 'audio/wav'
          row.size = bytes.length
          delete row.blob
        }
        table.put(row)
      }
      await new Promise<void>((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onabort = () => reject(new Error('Native fixture mutation failed'))
      })
    }
    finally {
      db.close()
    }
  }, { path, content, bytes: bytes ? [...bytes] : undefined })
}

async function restoreInEditor(page: Page, root: string, sessionPath: string, destination: string) {
  const bridge = await createEditorBridge({ host: '127.0.0.1', port: 0, projectRoot: root, publicRoot: resolve(import.meta.dirname, '../../../../editor/core/dist') })
  const editor = await page.context().newPage()
  try {
    await editor.addInitScript(() => {
      localStorage.setItem('advjs:editor:locale', 'zh-CN')
      localStorage.setItem('advjs:editor:onboarded', 'true')
    })
    try {
      await editor.goto((await bridge.start()).url, { waitUntil: 'domcontentloaded' })
    }
    catch {
      throw new Error('Editor restore navigation failed; scoped launch credentials omitted')
    }
    const main = editor.locator('[data-editor-region="main"]')
    await main.getByRole('tab', { name: '音频', exact: true }).click()
    const panel = main.locator('.ae-audio-workspace')
    await panel.getByRole('tab', { name: '对白配音', exact: true }).click()
    await panel.getByTestId('voice-listening-open').click()
    const advanced = panel.getByRole('region', { name: '高级匿名听审' })
    await advanced.locator('input[type=file]').setInputFiles(sessionPath)
    await expect(advanced.getByText('已恢复评分和备注；', { exact: false })).toBeVisible()
    const download = editor.waitForEvent('download')
    await advanced.getByTestId('voice-listening-export').click()
    await (await download).saveAs(destination)
    const incoming = JSON.parse(await readFile(sessionPath, 'utf8'))
    const returned = JSON.parse(await readFile(destination, 'utf8'))
    expect(returned.projectId).toBe(incoming.projectId)
    expect(returned.samples).toHaveLength(8)
    for (const sample of incoming.samples) {
      const actual = returned.samples.find((value: { candidate: { takeId: string } }) => value.candidate.takeId === sample.candidate.takeId)
      expect(actual.scores).toEqual(sample.scores)
      expect(actual.notes).toBe(sample.notes)
      expect(actual.candidate.sha256).toBe(sample.candidate.sha256)
      expect(actual.plays).toEqual([])
      expect(actual.endedCount).toBe(0)
      expect(actual.observedDurationSeconds).toBeUndefined()
    }
    expect(returned.humanConfirmed).toBe(false)
    expect(returned.standardMOS).toBeNull()
    return { destination, identitiesMatched: true, gradesAndNotesPreserved: true, playbackAndHumanCleared: true }
  }
  finally {
    await editor.close()
    await bridge.stop()
  }
}

async function privateDraft(page: Page) {
  return await page.evaluate(() => {
    const key = Object.keys(localStorage).find(key => key.startsWith('advjs-studio-private-listening-v1:'))
    return key ? JSON.parse(localStorage.getItem(key)!) : null
  })
}

test('native daily audition, anonymous multi-group review and project-private restore share one protocol', async ({ page }, info) => {
  test.setTimeout(180000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const fixture = await createEditorListeningFixture({ directory: info.outputPath('native'), archivedCalls: process.env.ADVJS_LISTENING_ARCHIVED_CALLS })
  expect(fixture.compiledLines.map(line => line.lineId)).toEqual(fixture.lines.map(line => line.id))
  const originalLedger = await readFile(join(fixture.root, 'adv/audio/voice-ledger.json'), 'utf8')
  await page.goto('/tabs/workspace', { waitUntil: 'domcontentloaded' })
  await page.getByText('立即体验', { exact: true }).first().click()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('advjs-studio-current'))).toBeTruthy()
  await seedNativeProject(page, fixture)
  await page.goto('/tabs/workspace/audio', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '配音审核', exact: true }).click()
  await expect(page.locator('.voice-review__line')).toHaveCount(4)
  const nativeBefore = await nativeLedger(page)
  expect(nativeBefore).toBe(originalLedger)
  await expect(page.getByTestId('studio-advanced-listening')).toHaveCount(0)
  const first = page.locator('.voice-review__line').first()
  const dailyAudition = first.getByRole('button', { name: '听 A', exact: true })
  if (info.project.use.hasTouch)
    await dailyAudition.tap()
  else
    await dailyAudition.click()
  const player = page.locator('.audio-workspace__preview audio')
  await expect.poll(() => player.evaluate(element => (element as HTMLAudioElement).readyState)).toBeGreaterThanOrEqual(2)
  const dailySha = await player.evaluate(async (element) => {
    const bytes = await (await fetch((element as HTMLAudioElement).currentSrc)).arrayBuffer()
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('')
  })
  expect(dailySha).toBe(fixture.assets[0]!.sha256)
  await first.getByRole('button', { name: '替换已选配音', exact: true }).click()
  expect(await nativeLedger(page)).toBe(nativeBefore)
  await page.locator('.voice-review__confirmation input[type=checkbox]').check()
  await page.getByRole('button', { name: '确认采用', exact: true }).click()
  await expect.poll(async () => JSON.parse(await nativeLedger(page)).lines[fixture.lines[0]!.id].locales['zh-CN'].selectedTake).toBe(fixture.sourceProof[1]!.takeId)
  const nativeAfterAdoption = await nativeLedger(page)
  const chapter = JSON.parse(fixture.files[fixture.chapterPath as keyof typeof fixture.files])
  const changedSource = '新的剧情台词，请重新审核原配音。'
  chapter.nodes[0].text = changedSource
  await updateNativeFixtureFile(page, fixture.chapterPath, JSON.stringify(chapter))
  await page.goto('/tabs/workspace/audio', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '配音审核', exact: true }).click()
  await expect(first.getByText(changedSource, { exact: true })).toBeVisible()
  await first.getByRole('button', { name: '复核并沿用', exact: true }).click()
  await page.locator('.voice-review__confirmation input[type=checkbox]').check()
  await page.getByRole('button', { name: '确认采用', exact: true }).click()
  await expect(first.getByText('本次已复核保留绑定', { exact: false })).toBeVisible()
  expect(await nativeLedger(page)).toBe(nativeAfterAdoption)
  const selectedAsset = fixture.assets[1]!
  const originalMedia = new Uint8Array(await readFile(join(fixture.root, 'public/media', selectedAsset.path)))
  const tamperedMedia = originalMedia.slice()
  tamperedMedia[44] = tamperedMedia[44]! ^ 1
  await updateNativeFixtureFile(page, `public/media/${selectedAsset.path}`, undefined, tamperedMedia)
  await page.goto('/tabs/workspace/audio', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '配音审核', exact: true }).click()
  await first.getByRole('button', { name: '复核并沿用', exact: true }).click()
  await page.locator('.voice-review__confirmation input[type=checkbox]').check()
  await page.getByRole('button', { name: '确认采用', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('VOICE_AUDIO_CHANGED')
  await expect(first.getByText('本次已复核保留绑定', { exact: false })).toHaveCount(0)
  expect(await nativeLedger(page)).toBe(nativeAfterAdoption)
  await updateNativeFixtureFile(page, `public/media/${selectedAsset.path}`, undefined, originalMedia)
  await page.goto('/tabs/workspace/audio', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '配音审核', exact: true }).click()
  const advancedEntry = first.getByRole('button', { name: '高级听审', exact: true })
  if (info.project.use.hasTouch) {
    await advancedEntry.tap()
  }
  else {
    await advancedEntry.focus()
    await expect(advancedEntry).toBeFocused()
    await advancedEntry.press('Enter')
  }
  const advanced = page.getByTestId('studio-advanced-listening')
  await advanced.getByRole('combobox', { name: '候选范围', exact: true }).click()
  await page.getByRole('option', { name: '全部项目对白组', exact: true }).click()
  for (const checkbox of await advanced.locator('.advanced-listening__setup input[type=checkbox]').all())
    await checkbox.check()
  await advanced.getByRole('button', { name: '创建匿名听审', exact: true }).click()
  await expect(advanced.locator('.listening-ratings__sample')).toHaveCount(8)
  await expect(advanced).not.toContainText('archived-qwen-import-fixture')
  const played = []
  for (const card of await advanced.locator('.listening-ratings__sample').all()) {
    const label = ((await card.locator('h3').textContent()) ?? '').split(' · ')[0]!
    await card.getByRole('button', { name: `试听 ${label}`, exact: true }).click()
    await expect.poll(() => player.evaluate(element => (element as HTMLAudioElement).readyState)).toBeGreaterThanOrEqual(2)
    const sha256 = await player.evaluate(async (element) => {
      const bytes = await (await fetch((element as HTMLAudioElement).currentSrc)).arrayBuffer()
      return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('')
    })
    await expect.poll(() => player.evaluate(element => (element as HTMLAudioElement).ended), { timeout: 15000 }).toBe(true)
    played.push({ sample: label, sha256, duration: await player.evaluate(element => (element as HTMLAudioElement).duration) })
  }
  expect(new Set(played.map(sample => sample.sha256))).toEqual(new Set(fixture.assets.map(asset => asset.sha256)))
  // Explicit UI simulation exercises grade/note interoperability, never claims
  // a human listener, auditory quality or a MOS measurement.
  const score = advanced.locator('.listening-ratings__sample').first().getByRole('combobox').first()
  await score.click()
  await page.getByRole('option', { name: '不适用', exact: true }).click()
  await advanced.locator('.listening-ratings__notes textarea').first().fill('UI interoperability simulation; no human auditory rating')
  await expect.poll(async () => (await privateDraft(page))?.samples?.[0]?.notes).toContain('UI interoperability simulation')
  const download = page.waitForEvent('download')
  await advanced.getByRole('button', { name: '导出私有听审 JSON', exact: true }).click()
  const exported = await download
  const exportPath = info.outputPath('studio-session.json')
  await exported.saveAs(exportPath)
  const session = JSON.parse(await readFile(exportPath, 'utf8'))
  expect(session.projectId).toBe('voice-listening-acceptance')
  expect(session.humanConfirmed).toBe(false)
  expect(session.standardMOS).toBeNull()
  expect(session.samples.every((sample: { endedCount: number }) => sample.endedCount > 0)).toBe(true)
  const playbackReview = inspectVoiceListeningSession(session)
  for (const sample of playbackReview.samples) {
    expect(sample.coverage).toBeGreaterThanOrEqual(0.95)
    expect(sample.pendingReasons).not.toContain('VOICE_LISTENING_SIMULATED_PLAYBACK')
  }
  await advanced.locator('input[type=file]').setInputFiles(exportPath)
  await expect(advanced).toContainText('播放记录与真人确认已清空')
  await expect.poll(async () => (await privateDraft(page))?.samples?.every((sample: { plays: unknown[], endedCount: number }) => !sample.plays.length && sample.endedCount === 0)).toBe(true)
  const editorRoundTrip = await restoreInEditor(page, fixture.root, exportPath, info.outputPath('studio-to-editor-session.json'))
  const editorSession = process.env.ADVJS_LISTENING_EDITOR_SESSION || editorRoundTrip.destination
  if (editorSession) {
    await advanced.locator('input[type=file]').setInputFiles(editorSession)
    await expect(advanced).toContainText('播放记录与真人确认已清空')
    const incoming = JSON.parse(await readFile(editorSession, 'utf8'))
    const restored = await privateDraft(page)
    expect(restored.samples).toHaveLength(8)
    for (const sample of incoming.samples) {
      const actual = restored.samples.find((value: { candidate: { takeId: string } }) => value.candidate.takeId === sample.candidate.takeId)
      expect(actual.scores).toEqual(sample.scores)
      expect(actual.notes).toBe(sample.notes)
      expect(actual.plays).toEqual([])
      expect(actual.endedCount).toBe(0)
      expect(actual.observedDurationSeconds).toBeUndefined()
    }
    expect(restored.humanConfirmed).toBe(false)
    expect(restored.standardMOS).toBeNull()
  }
  await page.getByRole('button', { name: '收起高级听审（保留草稿）', exact: true }).click()
  await page.getByRole('button', { name: '继续高级听审', exact: true }).click()
  await expect(advanced.locator('.listening-ratings__sample')).toHaveCount(8)
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme)
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 980 })
      await expect.poll(() => page.getByTestId('audio-workspace').evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
      await first.evaluate(element => element.scrollIntoView({ block: 'start' }))
      await page.screenshot({ path: info.outputPath(`studio-daily-${theme}-${width}.png`) })
      await advanced.evaluate(element => element.scrollIntoView({ block: 'start' }))
      await page.screenshot({ path: info.outputPath(`studio-advanced-${theme}-${width}.png`) })
      await advanced.locator('.listening-ratings__sample').first().evaluate(element => element.scrollIntoView({ block: 'start' }))
      await page.screenshot({ path: info.outputPath(`studio-ratings-${theme}-${width}.png`) })
      const layout = await page.getByTestId('audio-workspace').evaluate(element => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        overflowing: [...element.querySelectorAll('*')].filter(item => item.scrollWidth > item.clientWidth + 1).map(item => ({ tag: item.tagName, class: item.className, clientWidth: item.clientWidth, scrollWidth: item.scrollWidth })),
      }))
      await writeFile(info.outputPath(`layout-${theme}-${width}.json`), JSON.stringify(layout, null, 2))
      expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1)
    }
  }
  const nativeAfterReview = await nativeLedger(page)
  expect(nativeAfterReview).toBe(nativeAfterAdoption)
  const originals = await Promise.all(fixture.assets.map(async (asset) => {
    const bytes = await readFile(join(fixture.root, 'public/media', asset.path))
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(asset.sha256)
    return { id: asset.id, sha256: asset.sha256, bytes: bytes.length }
  }))
  expect(await readFile(join(fixture.root, 'adv/audio/voice-ledger.json'), 'utf8')).toBe(originalLedger)
  await page.getByRole('button', { name: '资源库', exact: true }).click()
  await expect(page.locator('.audio-workspace__preview audio')).toHaveCount(0)
  expect(errors).toEqual([])
  await writeFile(info.outputPath('proof.json'), JSON.stringify({ kind: 'advjs-studio-listening-ui-simulation', projectId: session.projectId, browser: info.project.name, touchEmulation: Boolean(info.project.use.hasTouch), physicalDevice: false, archivedQwen: Boolean(process.env.ADVJS_LISTENING_ARCHIVED_CALLS), originalSources: fixture.sourceProof, played, playbackReview, originals, exportedSession: exportPath, editorSessionImported: editorSession, editorRoundTrip, retainedStaleWithVerifiedOriginalBytes: true, tamperedMediaRetentionRejected: true, nativeLedgerBytes: new TextEncoder().encode(nativeAfterAdoption).byteLength, nativeLedgerSha256BeforeScore: createHash('sha256').update(nativeAfterAdoption).digest('hex'), nativeLedgerSha256AfterScore: createHash('sha256').update(nativeAfterReview).digest('hex'), studioNativeLedgerUnchangedByRatings: true, sourceLedgerUnchanged: true, humanListeners: 0, humanConfirmed: false, standardMOS: null, newTtsCalls: fixture.newTtsCalls, cloudWrites: fixture.cloudWrites, pageErrors: errors }, null, 2))
})

test('touch daily audition and lazy advanced entry release the verified player', async ({ page }, info) => {
  test.skip(!info.project.use.hasTouch, 'Touch emulation supplements desktop keyboard review')
  const fixture = await createEditorListeningFixture({ directory: info.outputPath('native'), archivedCalls: process.env.ADVJS_LISTENING_ARCHIVED_CALLS })
  await page.goto('/tabs/workspace', { waitUntil: 'domcontentloaded' })
  await page.getByText('立即体验', { exact: true }).first().tap()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('advjs-studio-current'))).toBeTruthy()
  await seedNativeProject(page, fixture)
  await page.goto('/tabs/workspace/audio', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '配音审核', exact: true }).tap()
  const before = await nativeLedger(page)
  const first = page.locator('.voice-review__line').first()
  await first.getByRole('button', { name: '听 A', exact: true }).tap()
  const player = page.locator('.audio-workspace__preview audio')
  await expect.poll(() => player.evaluate(element => !(element as HTMLAudioElement).paused)).toBe(true)
  const sha256 = await player.evaluate(async (element) => {
    const bytes = await (await fetch((element as HTMLAudioElement).currentSrc)).arrayBuffer()
    return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('')
  })
  expect(sha256).toBe(fixture.assets[0]!.sha256)
  await first.getByRole('button', { name: '高级听审', exact: true }).tap()
  await expect(page.getByTestId('studio-advanced-listening')).toBeVisible()
  await expect(player).toHaveCount(0)
  await page.getByRole('button', { name: '收起高级听审（保留草稿）', exact: true }).tap()
  await expect(page.getByTestId('studio-advanced-listening')).toBeHidden()
  expect(await nativeLedger(page)).toBe(before)
  await page.screenshot({ path: info.outputPath('touch-daily-and-lazy-entry.png') })
  await writeFile(info.outputPath('touch-proof.json'), JSON.stringify({ kind: 'advjs-studio-listening-touch-emulation', browser: 'webkit', emulatedDevice: 'iPhone 13', physicalDevice: false, sha256, nativeLedgerUnchanged: true, humanListeners: 0, standardMOS: null, newTtsCalls: 0, cloudWrites: 0 }, null, 2))
})

test('long comparison statuses clip inside their values and preserve operable full options', async ({ page }, info) => {
  const fixture = await createEditorListeningFixture({ directory: info.outputPath('native'), archivedCalls: process.env.ADVJS_LISTENING_ARCHIVED_CALLS })
  await page.goto('/tabs/workspace', { waitUntil: 'domcontentloaded' })
  await page.getByText('立即体验', { exact: true }).first().click()
  await expect.poll(() => page.evaluate(() => localStorage.getItem('advjs-studio-current'))).toBeTruthy()
  await seedNativeProject(page, fixture)
  const chapter = JSON.parse(fixture.files[fixture.chapterPath as keyof typeof fixture.files])
  chapter.nodes[0].text = '当前剧情台词已经变化，请重新审核原配音。'
  await updateNativeFixtureFile(page, fixture.chapterPath, JSON.stringify(chapter))
  await page.goto('/tabs/workspace/audio', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: '配音审核', exact: true }).click()
  const before = await nativeLedger(page)
  const first = page.locator('.voice-review__line').first()
  const painted = []
  for (const theme of ['light', 'dark']) {
    await page.evaluate(theme => document.documentElement.classList.toggle('dark', theme === 'dark'), theme)
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 980 })
      await first.evaluate(element => element.scrollIntoView({ block: 'start' }))
      const select = first.getByRole('combobox', { name: '候选 A', exact: true })
      await expect(select).toContainText('文本已变化')
      const paint = await first.locator('.voice-review__compare-side').first().evaluate((element) => {
        const trigger = element.querySelector('.s-select-trigger')!
        const value = trigger.querySelector('span:first-child')!
        const icon = trigger.querySelector('.s-select-trigger__icon')!
        const listen = element.querySelector('.s-button')!
        const box = (element: Element) => {
          const rect = element.getBoundingClientRect()
          return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
        }
        const style = getComputedStyle(value)
        return { trigger: box(trigger), value: box(value), icon: box(icon), listen: box(listen), overflow: style.overflowX, ellipsis: style.textOverflow, valueWidth: value.clientWidth, textWidth: value.scrollWidth, fullText: value.textContent }
      })
      expect(paint.overflow).toBe('hidden')
      expect(paint.ellipsis).toBe('ellipsis')
      expect(paint.textWidth).toBeGreaterThan(paint.valueWidth)
      expect(paint.value.left).toBeGreaterThanOrEqual(paint.trigger.left)
      expect(paint.value.right).toBeLessThanOrEqual(paint.icon.left + 1)
      expect(paint.trigger.right <= paint.listen.left + 1 || paint.trigger.bottom <= paint.listen.top + 1).toBe(true)
      expect(paint.fullText).toContain('文本已变化')
      if (info.project.use.hasTouch)
        await select.tap()
      else
        await select.click()
      const options = page.getByRole('option')
      await expect(options).toHaveCount(2)
      await expect(options.first()).toBeVisible()
      expect(await options.allTextContents()).toEqual(expect.arrayContaining([expect.stringContaining('已选正式配音'), expect.stringContaining('未选历史')]))
      await page.screenshot({ path: info.outputPath(`compare-options-${theme}-${width}.png`), animations: 'disabled' })
      if (info.project.use.hasTouch)
        await options.first().tap()
      else
        await options.first().click()
      await expect(options).toHaveCount(0)
      await page.screenshot({ path: info.outputPath(`compare-values-${theme}-${width}.png`), animations: 'disabled' })
      painted.push({ theme, width, ...paint })
    }
  }
  const listen = first.getByRole('button', { name: '听 A', exact: true })
  if (info.project.use.hasTouch)
    await listen.tap()
  else
    await listen.click()
  const player = page.locator('.audio-workspace__preview audio')
  await expect.poll(() => player.evaluate(element => !(element as HTMLAudioElement).paused)).toBe(true)
  await first.getByRole('button', { name: '高级听审', exact: true }).click()
  await expect(player).toHaveCount(0)
  expect(await nativeLedger(page)).toBe(before)
  await writeFile(info.outputPath('compare-paint-proof.json'), JSON.stringify({ kind: 'advjs-studio-voice-compare-paint', browser: info.project.name, touchEmulation: Boolean(info.project.use.hasTouch), physicalDevice: false, painted, fullOptionLabelsPreserved: true, nativeLedgerUnchanged: true, humanListeners: 0, standardMOS: null, newTtsCalls: 0, cloudWrites: 0 }, null, 2))
})
