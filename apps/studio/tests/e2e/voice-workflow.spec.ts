import type { Page, TestInfo } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
import { parseCharacterMd } from '@advjs/parser'
import { expect, test } from '@playwright/test'
import { startLocalVoiceFixture } from '../fixtures/local-voice/server'

const heroLineId = 'line_019d137e-7abc-7000-8000-00000000d001'
const otherLineId = 'line_019d137e-7abc-7000-8000-00000000d002'
const text = '这是主角明确选用的对白。'
const nativeFiles = {
  'adv.config.json': JSON.stringify({ id: 'voice-workflow-closeout', format: 'flow', root: 'adv', entryChapterId: 'intro' }),
  'adv/settings/game.json': JSON.stringify({ title: '角色配音闭环验收', locale: 'zh-CN', entryChapterId: 'intro', chapters: [{ id: 'intro', sources: ['chapters/intro.chapter.json'] }] }),
  'adv/characters/hero.character.md': '---\nid: hero\nname: 主角\n---\n原生角色，声音由作者显式设计与应用。\n',
  'adv/characters/other.character.md': '---\nid: other\nname: 其他角色\n---\n故意没有配音 Profile，不应被角色范围生成。\n',
  'adv/chapters/intro.chapter.json': JSON.stringify({ schemaVersion: 1, id: 'intro', title: '角色对白', startNodeId: 'hero', nodes: [{ id: 'hero', type: 'dialogues', dialogues: [{ lineId: heroLineId, speaker: 'hero', text }] }, { id: 'other', type: 'dialogues', dialogues: [{ lineId: otherLineId, speaker: 'other', text: '其他角色保持未配音。' }] }, { id: 'end', type: 'end' }] }),
  'adv/assets.json': JSON.stringify({ schemaVersion: 2, id: 'editor-jobs-assets', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'public/media' } }, assets: [] }),
}
async function seedProject(page: Page) {
  await page.evaluate(async (files) => {
    const open = indexedDB.open('advjs-studio')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
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
      transaction.onerror = () => reject(new Error('Native fixture storage failed'))
    })
    db.close()
  }, nativeFiles)
}
async function readNative(page: Page, path: string) {
  return page.evaluate(async (path) => {
    const open = indexedDB.open('advjs-studio')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    try {
      const request = db.transaction('memfsNodes').objectStore('memfsNodes').get(`memfs:${localStorage.getItem('advjs-studio-current')}:${path}`)
      return await new Promise<string | undefined>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result?.content)
        request.onerror = () => reject(new Error('Native fixture read failed'))
      })
    }
    finally { db.close() }
  }, path)
}
async function screenshotWidths(page: Page, info: TestInfo, stage: string) {
  for (const [label, width, height] of [['normal', 1280, 980], ['narrow', 390, 844]] as const) {
    await page.setViewportSize({ width, height })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const focus = stage === 'jobs'
      ? page.getByRole('combobox', { name: '目标角色或旁白', exact: true })
      : stage === 'review' ? page.locator('.voice-review__line') : stage === 'design' ? page.getByRole('button', { name: '生成这个角色的对白', exact: true }) : page.locator('.adv-dialog-box:visible')
    await focus.scrollIntoViewIfNeeded()
    await page.screenshot({ path: info.outputPath(`studio-workflow-${stage}-${label}.png`), fullPage: true, animations: 'disabled' })
  }
  await page.setViewportSize({ width: 1280, height: 980 })
}

test('saved character design leads to scoped dialogue generation, explicit adoption and the existing player', async ({ page, baseURL }, info) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
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
    Object.assign(window, { workflowAudioProbe: () => probes.map(({ context, analyser }) => {
      const samples = new Float32Array(256)
      analyser.getFloatTimeDomainData(samples)
      return { state: context.state, rms: Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length) }
    }) })
  })
  await page.goto('/tabs/workspace')
  await page.getByText('立即体验', { exact: true }).first().click()
  await expect(page).toHaveURL(/\/tabs\/world$/u)
  await seedProject(page)
  await page.goto('/tabs/workspace/characters')
  const heroCard = page.locator('.cc-wrapper').filter({ has: page.locator('.cc-name', { hasText: /^主角$/u }) })
  await expect(heroCard).toBeVisible()
  await heroCard.getByRole('button', { name: '设计角色音色', exact: true }).click()
  await expect(page).toHaveURL(/section=design.*speaker=hero/u)
  const pairing = page.getByTestId('local-voice-connection')
  const projectId = (await pairing.getByTestId('audio-local-project-id').textContent())!.trim()
  const host = await startLocalVoiceFixture(projectId, baseURL!, nativeFiles)
  try {
    await pairing.getByLabel('本地服务地址', { exact: true }).fill(host.url)
    await pairing.getByLabel('配对凭据', { exact: true }).fill(host.accessToken)
    await pairing.getByRole('button', { name: '连接本地服务', exact: true }).click()
    await expect(pairing.getByRole('status')).toBeVisible()
    const designer = page.getByTestId('voice-design-workspace')
    await expect(designer.getByRole('combobox', { name: '角色 / 项目旁白', exact: true })).toHaveValue('hero')
    const form = designer.getByTestId('voice-design-form')
    await form.getByLabel('项目音色 ID', { exact: true }).fill('hero-workflow-voice')
    await form.getByLabel('名称', { exact: true }).fill('主角审核音色')
    await form.getByRole('combobox', { name: '已配置供应商', exact: true }).selectOption('fixture-tts')
    await form.getByRole('combobox', { name: '可信预设模板', exact: true }).selectOption('fixture')
    await form.getByRole('combobox', { name: '音色来源', exact: true }).selectOption('system')
    await form.getByRole('combobox', { name: '内置音色', exact: true }).selectOption('system:fixture')
    await form.getByRole('button', { name: '将此定义加入草稿', exact: true }).click()
    await form.getByRole('button', { name: '保存不可变版本', exact: true }).click()
    const request = designer.getByTestId('voice-design-preview-request')
    await request.getByLabel('预览文本', { exact: true }).fill('主角音色试听。')
    await request.getByRole('checkbox').check()
    await request.getByRole('button', { name: '审核预览计划', exact: true }).click()
    await request.getByRole('button', { name: '生成已审核预览', exact: true }).click()
    const candidate = designer.locator('[data-preview-id]')
    await candidate.getByRole('button', { name: '校验并试听', exact: true }).click()
    await expect(designer.locator('audio')).toHaveAttribute('src', /^blob:/u)
    await candidate.getByRole('button', { name: '登记已审核样本', exact: true }).click()
    const sample = designer.locator('[data-sample-id]')
    await sample.getByRole('button', { name: '选择已审核样本', exact: true }).click()
    await sample.getByRole('button', { name: '将所选样本应用到 Profile', exact: true }).click()
    await expect(designer.getByRole('button', { name: '生成这个角色的对白', exact: true })).toBeVisible()
    await expect.poll(async () => parseCharacterMd((await readNative(page, 'adv/characters/hero.character.md'))!).voiceProfile?.locales?.['zh-CN']?.providers['fixture-tts']?.projectVoiceId).toBe('hero-workflow-voice')
    await screenshotWidths(page, info, 'design')
    await designer.getByRole('button', { name: '生成这个角色的对白', exact: true }).click()
    const jobs = page.getByTestId('voice-jobs')
    await expect(jobs.getByRole('combobox', { name: '目标角色或旁白', exact: true })).toContainText('hero')
    await jobs.getByRole('checkbox').check()
    await jobs.getByRole('button', { name: '审核生成计划', exact: true }).click()
    await expect(jobs.locator('.voice-jobs__summary')).toContainText('1')
    expect(host.status().synthesisCalls).toBe(1)
    await screenshotWidths(page, info, 'jobs')
    await jobs.getByRole('button', { name: '确认并保存计划', exact: true }).click()
    await jobs.getByRole('button', { name: '执行已确认计划', exact: true }).click()
    await jobs.getByRole('button', { name: '试听并选用对白配音', exact: true }).click()
    const review = page.locator('.voice-review')
    await expect(review.locator('.voice-review__line')).toHaveCount(1)
    await expect(review).toContainText(text)
    const ledger = () => readNative(page, 'adv/audio/voice-ledger.json').then(value => JSON.parse(value!))
    await expect.poll(async () => (await ledger()).lines[heroLineId]?.locales['zh-CN']?.takes.length).toBe(1)
    const take = (await ledger()).lines[heroLineId].locales['zh-CN'].takes[0]
    expect(take).toMatchObject({ spokenText: text, projectVoiceId: 'hero-workflow-voice', projectVoiceVersion: '1' })
    expect((await ledger()).lines[heroLineId].locales['zh-CN'].selectedTake).toBeNull()
    await review.getByRole('button', { name: '试听', exact: true }).click()
    await expect(page.locator('.audio-workspace__preview audio')).toHaveAttribute('src', /^blob:/u)
    await review.getByRole('button', { name: '绑定此 take', exact: true }).click()
    const confirmation = review.locator('.voice-review__confirmation')
    await confirmation.getByRole('checkbox').check()
    await confirmation.getByRole('button', { name: '确认采用', exact: true }).click()
    await expect.poll(async () => (await ledger()).lines[heroLineId].locales['zh-CN'].selectedTake).toBe(take.id)
    expect((await ledger()).lines[otherLineId]).toBeUndefined()
    await screenshotWidths(page, info, 'review')
    await page.getByRole('button', { name: '在游戏中播放已选配音', exact: true }).click()
    await expect(page).toHaveURL(/\/tabs\/play$/u)
    const reading = page.locator('.adv-dialog-box:visible')
    await expect(reading.locator('.print-words')).toContainText(text)
    // Embedded author previews begin directly at their chapter. Completing
    // typewriting is a normal user gesture that also unlocks its audio.
    await reading.click({ position: { x: 20, y: 20 } })
    let voiceRms = 0
    await expect.poll(async () => {
      voiceRms = await page.evaluate(() => Math.max(0, ...(window as any).workflowAudioProbe().map((probe: { rms: number }) => probe.rms)))
      return voiceRms
    }).toBeGreaterThan(0.01)
    const player = await page.evaluate((lineId) => {
      const app = (document.getElementById('app') as any).__vue_app__
      const visited = new Set()
      function find(node: any): any {
        if (!node || typeof node !== 'object' || visited.has(node) || visited.size > 10000)
          return
        visited.add(node)
        const context = node.component?.provides?.['$advjs-context']
        if (context?.store.current?.data?.lineId === lineId)
          return context
        for (const child of [node.component?.subTree, ...(Array.isArray(node.children) ? node.children : [])]) {
          const context = find(child)
          if (context)
            return context
        }
      }
      // Production Vue keeps VNodes but omits dev-only DOM component pointers.
      const adv = find(app._container._vnode)
      if (!adv)
        throw new Error('PLAYER_CURRENT_LINE_CONTEXT_REQUIRED')
      const binding = adv.gameConfig.value.audio.voiceLedger.lines[lineId].locales['zh-CN']
      return { lineId: adv.store.current.data.lineId, takeId: binding.selectedTake, assetId: binding.takes[0].assetId, audio: adv.$audio.inspect() }
    }, heroLineId)
    expect(player).toMatchObject({ lineId: heroLineId, takeId: take.id, assetId: take.assetId })
    expect(player.audio.errors).toEqual([])
    await screenshotWidths(page, info, 'player')
    const status = host.status()
    expect(status.synthesisCalls).toBe(2)
    expect(status.calls.map(call => call.speakerId)).toEqual(['hero', 'hero'])
    expect(status.calls[1]!.text).toBe(text)
    expect(status.publicationReads).toBe(0)
    expect(errors).toEqual([])
    await writeFile(info.outputPath('voice-workflow-proof.json'), JSON.stringify({ mode: 'production-studio-finite-local-host-original-fixture-wave', provider: 'fixture-tts', realModelCalls: 0, cosWrites: 0, projectId, nativeProjectId: 'voice-workflow-closeout', role: 'hero', excludedRole: 'other', lineId: heroLineId, take, profile: { projectVoiceId: 'hero-workflow-voice', projectVoiceVersion: '1' }, explicitAdoption: true, playerVoiceRms: voiceRms, player, ...status, errors }, null, 2))
  }
  finally { await host.close() }
})
