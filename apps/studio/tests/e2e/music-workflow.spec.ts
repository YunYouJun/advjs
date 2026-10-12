import type { AdvAssetEntry } from '@advjs/types'
import type { Locator, Page, TestInfo } from '@playwright/test'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { compileProject } from '@advjs/core'
import { expect, test } from '@playwright/test'
import { musicNativeHandoff } from '../fixtures/music/handoff'
import { musicFiles, musicLineId, musicText, originalMusicWav, privateBrief, privateLicense, sourceUrl } from '../fixtures/music/project'

async function seed(page: Page) {
  await page.evaluate(async (files) => {
    const request = indexedDB.open('advjs-studio')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const prefix = `memfs:${localStorage.getItem('advjs-studio-current')}:`
    const transaction = db.transaction('memfsNodes', 'readwrite')
    const store = transaction.objectStore('memfsNodes')
    const cursor = store.openCursor()
    cursor.onsuccess = () => {
      const row = cursor.result
      if (row) {
        if (String(row.key).startsWith(prefix))
          row.delete()
        row.continue()
        return
      }
      for (const [path, content] of Object.entries(files)) {
        const parts = path.split('/')
        for (let index = 1; index < parts.length; index++)
          store.put({ key: prefix + parts.slice(0, index).join('/'), type: 'directory', size: 0, mtime: Date.now() })
        store.put({ key: prefix + path, type: 'file', content, size: new TextEncoder().encode(content).length, mtime: Date.now() })
      }
    }
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(new Error('MUSIC_FIXTURE_STORAGE_FAILED'))
    })
    db.close()
  }, musicFiles)
}
async function native(page: Page, path: string): Promise<string> {
  return page.evaluate(async (path) => {
    const request = indexedDB.open('advjs-studio')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const row = db.transaction('memfsNodes').objectStore('memfsNodes').get(`memfs:${localStorage.getItem('advjs-studio-current')}:${path}`)
      return await new Promise<string>((resolve, reject) => {
        row.onsuccess = () => resolve(row.result?.content ?? '')
        row.onerror = () => reject(new Error('MUSIC_FIXTURE_READ_FAILED'))
      })
    }
    finally { db.close() }
  }, path)
}
async function choose(page: Page, select: Locator, label: string) {
  await select.click()
  await page.getByRole('option', { name: label, exact: true }).click()
}
async function widths(page: Page, info: TestInfo, stage: string, focus: Locator) {
  for (const [name, width, height] of [['normal', 1280, 980], ['narrow', 390, 844]] as const) {
    await page.setViewportSize({ width, height })
    await focus.scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: info.outputPath(`studio-music-${stage}-${name}.png`), fullPage: true, animations: 'disabled' })
  }
  await page.setViewportSize({ width: 1280, height: 980 })
}
async function probe(page: Page) {
  await page.addInitScript(() => {
    const Native = window.AudioContext
    const probes: Array<{ context: AudioContext, analyser: AnalyserNode }> = []
    class Observed extends Native {
      constructor(options?: AudioContextOptions) {
        super(options)
        const analyser = this.createAnalyser()
        analyser.fftSize = 256
        probes.push({ context: this, analyser })
        const createGain = this.createGain.bind(this)
        let first = true
        this.createGain = () => {
          const gain = createGain()
          if (first) {
            gain.connect(analyser)
            first = false
          }
          return gain
        }
      }
    }
    window.AudioContext = Observed
    Object.assign(window, { musicProbe: () => probes.map(({ context, analyser }) => {
      const samples = new Float32Array(256)
      analyser.getFloatTimeDomainData(samples)
      return { state: context.state, rms: Math.sqrt(samples.reduce((sum, sample) => sum + sample * sample, 0) / samples.length) }
    }) })
  })
}
async function game(page: Page) {
  return page.evaluate(() => {
    const app = (document.getElementById('app') as any).__vue_app__
    const adv = app._context.provides['$advjs-context']
    return { current: adv.store.current, config: JSON.parse(JSON.stringify(adv.gameConfig.value)), audio: adv.$audio.inspect(), probes: (window as any).musicProbe() as Array<{ state: string, rms: number }> }
  })
}

test('original music brief, verified approval and explicit Flow binding export the same playable local music', async ({ page }, info) => {
  test.setTimeout(120_000)
  const initial = await compileProject({ files: musicFiles }, { allowEmptyAssetManifest: true })
  expect(initial.diagnostics.filter(issue => issue.severity === 'error')).toEqual([])
  expect(Object.values(initial.project.program?.chapters ?? {}).flatMap(chapter => Object.values(chapter.nodes)).some(node => node.kind === 'narration' && node.data?.lineId === musicLineId)).toBe(true)
  const errors: string[] = []
  const sourceRequests: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => request.url().startsWith(sourceUrl) && sourceRequests.push(request.url()))
  await probe(page)
  await page.goto('/tabs/workspace')
  await page.getByText('立即体验', { exact: true }).first().click()
  await expect(page).toHaveURL(/\/tabs\/world$/u)
  await seed(page)
  await page.goto('/tabs/workspace/audio')
  const workspace = page.getByTestId('audio-workspace')
  await expect(workspace.locator('.audio-library')).toBeVisible()
  const brief = page.getByTestId('music-brief')
  await brief.locator('summary').first().click()
  await brief.getByLabel('音乐创作说明', { exact: true }).fill(privateBrief)
  await brief.locator('[aria-label="来源页面（可选）"] input').fill(sourceUrl)
  await brief.locator('[aria-label="许可"] input').fill(privateLicense)
  await expect(brief.getByRole('link', { name: '打开 Suno 创作', exact: true })).toHaveAttribute('href', 'https://suno.com/create')
  const download = page.waitForEvent('download')
  await brief.getByRole('button', { name: '下载方案 JSON', exact: true }).click()
  await (await download).saveAs(info.outputPath('music-brief.json'))
  const handedOff = JSON.parse(await readFile(info.outputPath('music-brief.json'), 'utf8'))
  expect(handedOff).toMatchObject({ schemaVersion: 1, usage: 'background', source: { type: 'manual', url: sourceUrl }, brief: { summary: privateBrief }, rights: { license: privateLicense }, review: { status: 'pending' } })
  await widths(page, info, 'brief', brief)
  await brief.getByRole('button', { name: '按此方案导入音乐', exact: true }).click()
  const wav = originalMusicWav()
  const sha256 = createHash('sha256').update(wav).digest('hex')
  const form = workspace.locator('.audio-asset-form')
  await form.getByLabel('本地音频文件', { exact: true }).setInputFiles({ name: 'original-music.wav', mimeType: 'audio/wav', buffer: wav })
  await form.locator('[aria-label="名称"] input').fill('原创章节音乐')
  await form.getByRole('button', { name: '导入音频', exact: true }).click()
  await expect(form).toHaveCount(0)
  const catalog = async () => {
    const compilation = await compileProject({ files: { ...musicFiles, 'adv/assets.json': await native(page, 'adv/assets.json'), 'adv/assets/audio.json': await native(page, 'adv/assets/audio.json') } }, { allowEmptyAssetManifest: true })
    return compilation.project.assets as { assets: AdvAssetEntry[] }
  }
  await expect.poll(async () => (await catalog()).assets.some(asset => asset.title === '原创章节音乐')).toBe(true)
  const asset = (await catalog()).assets.find(asset => asset.title === '原创章节音乐')!
  expect(asset).toMatchObject({ kind: 'bgm', loop: true, sha256, music: handedOff })
  const card = workspace.locator(`[data-asset-id="${asset.id}"]`)
  const review = card.getByTestId('music-review')
  await expect(review.getByRole('checkbox')).toBeDisabled()
  await expect(review.getByRole('button', { name: '审核通过', exact: true })).toBeDisabled()
  await expect(review.getByRole('button', { name: '绑定到章节', exact: true })).toBeDisabled()
  await card.getByRole('button', { name: '试听', exact: true }).click()
  const audition = workspace.locator('.audio-workspace__preview audio')
  await expect(audition).toHaveAttribute('src', /^blob:/u)
  const auditionProof = await audition.evaluate(async (audio: HTMLAudioElement) => {
    const bytes = await fetch(audio.src).then(response => response.arrayBuffer())
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
    return { sha256, bytes: bytes.byteLength }
  })
  expect(auditionProof).toEqual({ sha256, bytes: wav.length })
  if (info.project.name === 'webkit')
    await workspace.getByRole('button', { name: '播放试听', exact: true }).tap()
  else
    await workspace.getByRole('button', { name: '播放试听', exact: true }).click()
  await expect.poll(() => audition.evaluate(audio => (audio as HTMLAudioElement).currentTime)).toBeGreaterThan(0.05)
  await expect(review.getByRole('checkbox')).toBeEnabled()
  await review.getByRole('checkbox').check()
  await expect(review.getByRole('button', { name: '审核通过', exact: true })).toBeEnabled()
  await review.getByRole('button', { name: '审核通过', exact: true }).click()
  await expect.poll(async () => (await catalog()).assets.find(row => row.id === asset.id)?.music?.review.status).toBe('approved')
  await widths(page, info, 'approval', review)
  // Keep a genuinely imported, unapproved master in the author library; it must
  // remain in the native ZIP while being absent from the playable publication.
  await workspace.locator('.audio-library__heading').getByRole('button', { name: '导入音频', exact: true }).click()
  await form.getByLabel('本地音频文件', { exact: true }).setInputFiles({ name: 'unused-original.wav', mimeType: 'audio/wav', buffer: originalMusicWav(550) })
  await form.locator('[aria-label="名称"] input').fill('未绑定音乐候选')
  await choose(page, form.getByRole('combobox', { name: '音频用途', exact: true }), '音乐')
  await form.getByRole('button', { name: '导入音频', exact: true }).click()
  await expect(form).toHaveCount(0)
  await expect.poll(async () => (await catalog()).assets.some(asset => asset.title === '未绑定音乐候选')).toBe(true)
  const unused = (await catalog()).assets.find(row => row.title === '未绑定音乐候选')!
  expect(unused.music?.review.status).toBe('pending')
  await review.getByRole('button', { name: '绑定到章节', exact: true }).click()
  await expect(page).toHaveURL(/\/tabs\/workspace\/chapters\?music=/u)
  const binding = page.getByTestId('flow-music-binding')
  await expect(binding.getByRole('button', { name: '加入章节开头草稿', exact: true })).toBeDisabled()
  await binding.getByRole('checkbox').check()
  await binding.getByRole('button', { name: '加入章节开头草稿', exact: true }).click()
  await page.getByRole('button', { name: '保存 JSON', exact: true }).click()
  await expect.poll(async () => JSON.parse(await native(page, 'adv/chapters/intro.chapter.json')).nodes[0]?.operations?.[0]?.asset).toBe(asset.id)
  const chapter = JSON.parse(await native(page, 'adv/chapters/intro.chapter.json'))
  expect(chapter.nodes[0]).toMatchObject({ type: 'audio', next: 'speech', operations: [{ type: 'bgm', action: 'set', asset: asset.id, loop: true, gain: 0.7 }] })
  expect(chapter.nodes[1]).toEqual(JSON.parse(musicFiles['adv/chapters/intro.chapter.json']).nodes[0])
  expect(chapter.notes).toEqual({ original: 'preserve' })
  await widths(page, info, 'binding', binding)
  await page.goto('/tabs/workspace')
  const exporting = page.waitForEvent('download')
  await page.getByTitle('导出项目', { exact: true }).click()
  const zipPath = info.outputPath('music-native-project.advpkg.zip')
  await (await exporting).saveAs(zipPath)
  const handoff = await musicNativeHandoff(await readFile(zipPath), info.outputPath('native-project'), asset.id, unused.id)
  try {
    expect(handoff.media).toEqual([{ path: expect.any(String), sha256 }])
    await page.goto(handoff.playerUrl)
    await page.locator('[data-action="start_game"]').click()
    await expect.poll(async () => (await game(page)).current?.data?.lineId).toBe(musicLineId)
    let playback = await game(page)
    await expect.poll(async () => {
      playback = await game(page)
      return Math.max(0, ...playback.probes.map(probe => probe.rms))
    }).toBeGreaterThan(1e-4)
    expect(playback.probes.some(probe => probe.state === 'running')).toBe(true)
    expect(playback.audio.state.bgm.assetId).toBe(asset.id)
    expect(playback.audio.tracks.some((track: any) => track.assetId === asset.id && track.bus === 'music' && track.status === 'playing')).toBe(true)
    expect(playback.audio.errors).toEqual([])
    expect(Object.keys(playback.config.audio.assets)).toEqual([asset.id])
    expect(Object.values(playback.config.audio.assets).every((row: any) => row.music === undefined)).toBe(true)
    const publicConfig = JSON.stringify(playback.config)
    for (const field of [sourceUrl, privateBrief, privateLicense, unused.id, '"rights"', '"review"'])
      expect(publicConfig).not.toContain(field)
    await expect(page.locator('.adv-black:visible .print-words')).toContainText(musicText)
    await expect(page.locator('.print-words .invisible')).toHaveCount(0)
    await widths(page, info, 'player', page.locator('.adv-black:visible'))
    expect(errors).toEqual([])
    expect(sourceRequests).toEqual([])
    await writeFile(info.outputPath('music-proof.json'), JSON.stringify({ browser: info.project.name, device: info.project.name === 'webkit' ? 'iPhone13 touch emulation; not hardware' : 'desktop Chromium', mediaSource: 'original procedural PCM fixture; not Suno output', newModelCalls: 0, cloudWrites: 0, handmadeBrief: handedOff, audition: auditionProof, assetId: asset.id, unboundAssetId: unused.id, approved: JSON.parse(await readFile(`${handoff.outDir}/../adv/assets.json`, 'utf8')), chapter, export: { zipPath, inventory: handoff.inventory, check: { passed: handoff.check.passed, issues: handoff.check.issues }, media: handoff.media }, player: { lineId: playback.current.data.lineId, text: playback.current.data.text, audio: playback.audio, probes: playback.probes, privateMetadataExcluded: true }, errors, sourceRequests }, null, 2))
  }
  finally { await handoff.close() }
})
