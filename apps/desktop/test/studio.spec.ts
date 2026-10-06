import { Buffer } from 'node:buffer'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'

const evidence = resolve(import.meta.dirname, '../out/evidence')

function wave() {
  const rate = 8000
  const samples = rate * 4
  const bytes = Buffer.alloc(44 + samples * 2)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(bytes.length - 8, 4)
  bytes.write('WAVEfmt ', 8)
  bytes.writeUInt32LE(16, 16)
  bytes.writeUInt16LE(1, 20)
  bytes.writeUInt16LE(1, 22)
  bytes.writeUInt32LE(rate, 24)
  bytes.writeUInt32LE(rate * 2, 28)
  bytes.writeUInt16LE(2, 32)
  bytes.writeUInt16LE(16, 34)
  bytes.write('data', 36)
  bytes.writeUInt32LE(samples * 2, 40)
  return bytes
}

test('production Studio preserves character/tachie/audio saves and plays without desktop APIs', async ({ page, browser }) => {
  await mkdir(evidence, { recursive: true })
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/tabs/workspace')
  await page.getByRole('button', { name: /立即体验|Quick Start/ }).click()
  await expect(page).toHaveURL(/\/tabs\/world/)
  expect(await page.evaluate(() => 'advDesktop' in window)).toBe(false)
  await page.goto('/tabs/workspace/characters')
  await page.locator('.cc').filter({ hasText: '陆远' }).click()
  const modal = page.locator('ion-modal').filter({ has: page.locator('.cef') })
  await expect(modal).toBeVisible()
  await modal.getByRole('textbox', { name: '角色名', exact: true }).fill('陆远·回归')
  await modal.getByRole('textbox', { name: '性格', exact: true }).fill('Studio 保存的性格。')
  await modal.getByRole('button', { name: '添加', exact: true }).click()
  await modal.locator('.cef-tachie-add ion-input').first().locator('input').fill('default')
  await modal.locator('.cef-tachie-add input[type="file"]').setInputFiles({ name: 'local.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="200"><rect width="80" height="200" fill="#c84"/></svg>') })
  await modal.locator('.cef-tachie-add').getByRole('button', { name: '添加', exact: true }).click()
  await expect(modal.locator('img[alt="default"]')).toBeVisible()
  await modal.locator('.cem-save-btn').click()
  await expect(modal).toBeHidden()
  await page.reload()
  await page.locator('.cc').filter({ hasText: '陆远·回归' }).click()
  await expect(modal.getByRole('textbox', { name: '性格', exact: true })).toHaveValue('Studio 保存的性格。')
  await modal.locator('img[alt="default"]').scrollIntoViewIfNeeded()
  await expect.poll(() => modal.locator('img[alt="default"]').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(80)
  await page.screenshot({ path: resolve(evidence, 'a10-studio-character.png') })
  await modal.getByRole('button', { name: '取消', exact: true }).click()

  await page.goto('/tabs/workspace/audio')
  await page.locator('input[type="file"][accept="audio/*"]').setInputFiles({ name: 'desktop-regression.wav', mimeType: 'audio/wav', buffer: wave() })
  const card = page.locator('.audio-card').filter({ hasText: 'desktop-regression' })
  await expect(card).toBeVisible()
  await card.click()
  const audioModal = page.locator('ion-modal').filter({ has: page.locator('.audio-editor-form') })
  await audioModal.locator('ion-textarea textarea').fill('Studio 项目音频真实保存。')
  await audioModal.locator('.cem-save-btn').click()
  await expect(audioModal).toBeHidden()
  await page.reload()
  await expect(card).toContainText('Studio 项目音频真实保存。')
  const audio = card.locator('audio')
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.duration)).toBe(4)
  await card.getByRole('button', { name: '播放', exact: true }).click()
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(false)
  await page.screenshot({ path: resolve(evidence, 'a10-studio-audio.png') })
  await audio.evaluate((element) => {
    (window as any).__studioAudio = element
  })
  // Ionic retains pages; route within the SPA so the leave hook must pause playback.
  await page.evaluate(() => (document.querySelector('#app') as any).__vue_app__.config.globalProperties.$router.push('/editor?file=adv%2Fchapters%2F01.adv.md'))
  await expect.poll(() => page.evaluate(() => (window as any).__studioAudio.paused), { timeout: 2000 }).toBe(true)
  const source = page.locator('textarea.editor-textarea')
  await expect(source).toBeVisible()
  await source.fill('```yaml\n- type: bgm\n  name: desktop-regression\n- type: tachie\n  enter:\n    name: lu-yuan\n    status: default\n```\n\n> Studio 本地游戏预览。\n\n@lu-yuan\n保存后的 Studio 游戏对白。\n')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByText('已保存！', { exact: true })).toBeVisible()
  // Memory projects debounce IndexedDB writes; verify the persisted source before
  // a fresh page restores the project and creates its gameplay session.
  await expect.poll(() => page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((done, fail) => {
      const request = indexedDB.open('advjs-studio')
      request.onsuccess = () => done(request.result)
      request.onerror = () => fail(request.error)
    })
    try {
      return await new Promise<string>((done, fail) => {
        const request = database.transaction('memfsNodes').objectStore('memfsNodes').get(`memfs:${localStorage.getItem('advjs-studio-current')}:adv/chapters/01.adv.md`)
        request.onsuccess = () => done(request.result?.content ?? '')
        request.onerror = () => fail(request.error)
      })
    }
    finally {
      database.close()
    }
  })).toContain('保存后的 Studio 游戏对白。')
  // Authoring stays at phone width; use a full game viewport for the runtime evidence.
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.goto('/tabs/play')
  const narration = page.locator('.adv-black')
  await expect(narration).toBeVisible({ timeout: 20000 })
  await narration.click()
  await narration.click()
  await expect(page.locator('.adv-dialog-box')).toContainText('保存后的 Studio 游戏对白。')
  await expect.poll(() => page.locator('img.tachie-character').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(80)
  // Capture after the dialogue's entrance animation; its border extends 5px
  // beyond the canvas by design and is clipped by AdvContainer.
  await expect.poll(async () => {
    const bounds = await page.locator('.adv-dialog-box').boundingBox()
    return bounds!.y + bounds!.height
  }).toBeLessThanOrEqual(905)
  await page.screenshot({ path: resolve(evidence, 'a10-studio-preview.png') })
  expect(await page.getByRole('button', { name: '导出 Web 目录', exact: true }).count()).toBe(0)
  expect(errors).toEqual([])
  await writeFile(resolve(evidence, 'a10-studio.json'), JSON.stringify({ browser: browser.version(), production: true, desktopApi: false, characterReload: true, localTachieWidth: 80, audioReload: true, audioDuration: 4, stoppedOnLeave: true, sourceReload: true, gameTachieWidth: 80, authoringViewport: 390, gameViewport: 1280, preview: true, pageErrors: errors }, null, 2))
})
