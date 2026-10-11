import type { AdvVoiceCandidate, VoiceAuthoringSnapshot } from '@advjs/types'
import type { Locator, Page, TestInfo } from '@playwright/test'
import { Buffer } from 'node:buffer'
import { writeFile } from 'node:fs/promises'
import { expect } from '@playwright/test'
import { verifyStudioHandoffPlayer } from '../design-flow/player'

export interface RealQwenMetadata {
  root: string
  directory: string
  sessionMode?: 'local-pairing'
  publicationEnabled?: boolean
  actorId: string
  lineId: string
  dialogueText: string
  previewText: string
  rightsPath: string
  designedVoiceId: string
  clonedVoiceId: string
  providerId: string
  models: Record<'design' | 'base', { model: string, revision: string }>
}
export function snapshot(page: Page): Promise<VoiceAuthoringSnapshot> {
  return page.evaluate(() => (window as any).designFlowFixture.snapshot())
}
export function files(page: Page): Promise<Record<string, string>> {
  return page.evaluate(() => (window as any).designFlowFixture.files())
}
/** Exercise both native and Studio portal selects through their actual controls. */
export async function chooseOption(page: Page, control: Locator, value: string, label: string) {
  if (await control.evaluate(element => element.tagName === 'SELECT')) {
    await control.selectOption(value)
    return
  }
  await control.click()
  await page.getByRole('option', { name: label, exact: true }).click()
}
export async function designVoice(page: Page, metadata: RealQwenMetadata, source: 'designed' | 'cloned', referenceAssetId?: string) {
  await page.getByRole('button', { name: '音色设计', exact: true }).click()
  const designer = page.getByTestId('voice-design-workspace')
  await expect(designer.getByRole('combobox', { name: '角色 / 项目旁白', exact: true })).toBeEnabled()
  await designer.getByRole('combobox', { name: '角色 / 项目旁白', exact: true }).selectOption(metadata.actorId)
  const details = designer.locator('details.voice-design-create')
  if (!await details.evaluate(element => (element as HTMLDetailsElement).open))
    await details.locator('summary').click()
  const form = designer.getByTestId('voice-design-form')
  await form.getByLabel('项目音色 ID', { exact: true }).fill(source === 'designed' ? metadata.designedVoiceId : metadata.clonedVoiceId)
  await form.getByLabel('名称', { exact: true }).fill(source === 'designed' ? 'Studio 原创描述音色' : 'Studio 原创声音 Base 参考')
  await form.getByLabel('年龄印象', { exact: true }).fill('年轻成年人')
  await form.getByLabel('性别表达', { exact: true }).fill('女性')
  await form.getByLabel('说话风格', { exact: true }).fill('温暖清晰，自然停顿')
  await form.getByLabel('气质（逗号分隔）', { exact: true }).fill('平静, 友好')
  await chooseOption(page, form.getByRole('combobox', { name: '音高', exact: true }), 'medium', '中')
  await chooseOption(page, form.getByRole('combobox', { name: '语速', exact: true }), 'medium', '中')
  await form.getByRole('button', { name: '应用声音意图', exact: true }).click()
  await form.getByLabel('精确语言区域', { exact: true }).fill('zh-CN')
  await form.getByRole('combobox', { name: '已配置供应商', exact: true }).selectOption(metadata.providerId)
  await form.getByRole('combobox', { name: '可信预设模板', exact: true }).selectOption(source === 'designed' ? 'design' : 'base')
  await form.getByRole('combobox', { name: '音色来源', exact: true }).selectOption(source)
  if (source === 'designed') {
    await form.getByLabel('音色设计描述', { exact: true }).fill('年轻成年女性，温暖清晰的普通话声音，语气平静自然，表达友好，不模仿任何真实人物。')
  }
  else {
    await form.getByRole('combobox', { name: '授权原生参考音频', exact: true }).selectOption(referenceAssetId!)
    await form.getByRole('combobox', { name: '参考模式', exact: true }).selectOption('icl')
    await form.getByLabel('参考音频准确转录', { exact: true }).fill(metadata.previewText)
    await form.getByLabel('许可', { exact: true }).fill('synthetic-acceptance-only')
    await form.getByLabel('权利主体', { exact: true }).fill('ADV.JS Studio original synthetic Qwen voice')
    await form.getByLabel('项目内授权记录路径', { exact: true }).fill(metadata.rightsPath)
  }
  await form.getByRole('button', { name: '将此定义加入草稿', exact: true }).click()
  await form.getByRole('button', { name: '保存不可变版本', exact: true }).click()
  const voiceId = source === 'designed' ? metadata.designedVoiceId : metadata.clonedVoiceId
  const versions = designer.getByRole('combobox', { name: '审核音色版本', exact: true })
  await expect.poll(() => versions.locator('option').evaluateAll((options, id) => options.some(option => (option as HTMLOptionElement).value === id), voiceId)).toBe(true)
  // Saving preserves the currently reviewed version. The author explicitly
  // opens the new immutable version before approving its preview.
  await versions.selectOption(voiceId)
  await expect(designer.getByTestId('voice-design-preview-request')).toBeVisible()
  return designer
}

/** Returns genuine decoded bytes and measurements, never a fixture waveform. */
export async function generateAudition(page: Page, info: TestInfo, metadata: RealQwenMetadata, kind: 'design' | 'base') {
  const designer = page.getByTestId('voice-design-workspace')
  const request = designer.getByTestId('voice-design-preview-request')
  await request.getByRole('combobox', { name: '精确语言区域', exact: true }).selectOption('zh-CN')
  await request.getByLabel('预览文本', { exact: true }).fill(metadata.previewText)
  await request.getByLabel('最多计费字符数', { exact: true }).fill('100')
  await request.getByRole('checkbox').check()
  await request.getByRole('button', { name: '审核预览计划', exact: true }).click()
  await expect(request.getByRole('button', { name: '生成已审核预览', exact: true })).toBeEnabled()
  await designer.getByRole('button', { name: '恢复服务端结果', exact: true }).first().click()
  await expect(request.getByRole('button', { name: '生成已审核预览', exact: true })).toBeEnabled()
  await request.getByRole('button', { name: '生成已审核预览', exact: true }).click()
  const preview = designer.locator('[data-preview-id]')
  // One dispatch only; long local inference is neither a network retry nor failure.
  await expect(preview.getByRole('button', { name: '登记已审核样本', exact: true })).toBeVisible({ timeout: 30 * 60 * 1000 })
  await preview.getByRole('button', { name: '校验并试听', exact: true }).click()
  const audio = designer.locator('audio')
  await expect(audio).toHaveAttribute('src', /^blob:/u)
  const measurement = await audio.evaluate(async (element: HTMLAudioElement) => {
    const bytes = await fetch(element.src).then(response => response.arrayBuffer())
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('')
    const context = new AudioContext()
    const decoded = await context.decodeAudioData(bytes.slice(0))
    const samples = decoded.getChannelData(0)
    let squares = 0
    let peak = 0
    for (const sample of samples) {
      squares += sample * sample
      peak = Math.max(peak, Math.abs(sample))
    }
    const binary = new Uint8Array(bytes)
    let text = ''
    for (let offset = 0; offset < binary.length; offset += 8192)
      text += String.fromCharCode(...binary.subarray(offset, offset + 8192))
    await context.close()
    return { sha256, bytes: bytes.byteLength, durationSeconds: decoded.duration, decodedSampleRate: decoded.sampleRate, rms: Math.sqrt(squares / samples.length), peak, base64: btoa(text) }
  })
  expect(measurement.rms).toBeGreaterThan(1e-4)
  expect(measurement.peak).toBeGreaterThan(1e-4)
  expect(measurement.durationSeconds).toBeGreaterThanOrEqual(3)
  expect(measurement.durationSeconds).toBeLessThanOrEqual(20)
  expect(await preview.getAttribute('data-preview-id')).toBeTruthy()
  await expect(preview.locator('code')).toContainText(measurement.sha256)
  await audio.click({ position: { x: 20, y: 20 } })
  await expect.poll(() => audio.evaluate(element => (element as HTMLAudioElement).paused)).toBe(false)
  await audio.evaluate(element => (element as HTMLAudioElement).pause())
  const wav = Buffer.from(measurement.base64, 'base64')
  await writeFile(info.outputPath(`${kind}-audition.wav`), wav)
  await expect.poll(async () => (await snapshot(page)).ledger.lines[metadata.lineId]?.locales['zh-CN']?.takes.length ?? 0).toBe(kind === 'design' ? 0 : 1)
  await preview.getByRole('button', { name: '登记已审核样本', exact: true }).click()
  const sample = designer.locator('[data-sample-id]')
  await expect(sample).toHaveCount(1)
  await sample.getByRole('button', { name: '选择已审核样本', exact: true }).click()
  await designer.getByLabel('显式替换当前 Profile 供应商绑定', { exact: true }).check()
  await sample.getByRole('button', { name: '将所选样本应用到 Profile', exact: true }).click()
  const voiceId = kind === 'design' ? metadata.designedVoiceId : metadata.clonedVoiceId
  await expect.poll(async () => JSON.parse((await files(page))['adv/settings/game.json']!).characters.find((actor: any) => actor.id === metadata.actorId)?.voiceProfile?.locales?.['zh-CN']?.providers?.[metadata.providerId]?.projectVoiceId).toBe(voiceId)
  const nativeFiles = await files(page)
  const library = JSON.parse(nativeFiles['authoring/voices/library.json']!)
  const voice = library.voices.find((voice: any) => voice.id === voiceId)
  expect(voice.design.samples[0]).toMatchObject({ sha256: measurement.sha256, bytes: measurement.bytes, source: kind === 'design' ? 'designed' : 'cloned', model: metadata.models[kind].model })
  await page.screenshot({ path: info.outputPath(`${kind}-studio-normal.png`), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: info.outputPath(`${kind}-studio-narrow.png`), fullPage: true })
  await page.setViewportSize({ width: 1280, height: 900 })
  const { base64: _, ...quality } = measurement
  return { quality, wav, sampleAssetId: voice.design.samples[0].assetId as string, voice }
}

export async function generateDialogue(page: Page, metadata: RealQwenMetadata, kind: 'design' | 'base') {
  await page.getByRole('button', { name: '生成配音', exact: true }).click()
  const jobs = page.getByTestId('voice-jobs')
  await chooseOption(page, jobs.getByRole('combobox', { name: '章节', exact: true }), 'intro', 'Studio 真实配音')
  await chooseOption(page, jobs.getByRole('combobox', { name: '生成范围', exact: true }), kind === 'design' ? 'missing' : 'stale', kind === 'design' ? '仅缺少已选配音' : '仅已选配音失效')
  await jobs.getByLabel('最大新增生成字数', { exact: true }).fill('100')
  await jobs.getByLabel('同时生成数（1–32）', { exact: true }).fill('1')
  await jobs.getByRole('checkbox').check()
  await jobs.getByRole('button', { name: '审核生成计划', exact: true }).click()
  await expect(jobs.getByRole('button', { name: '确认并保存计划', exact: true })).toBeVisible()
  await expect(jobs.locator('.voice-jobs__summary div').filter({ has: page.locator('dt', { hasText: /^新增生成请求$/u }) }).locator('dd')).toHaveText('1')
  await jobs.getByRole('button', { name: '确认并保存计划', exact: true }).click()
  // Each new plan contains one line. Previously committed plans remain disabled.
  await jobs.getByRole('button', { name: '执行已确认计划', exact: true }).and(page.locator('button:enabled')).click()
  await expect.poll(async () => (await snapshot(page)).ledger.lines[metadata.lineId]?.locales['zh-CN']?.takes.length, { timeout: 30 * 60 * 1000, intervals: [1500] }).toBe(kind === 'design' ? 1 : 2)
  const binding = (await snapshot(page)).ledger.lines[metadata.lineId]!.locales['zh-CN']!
  const take = binding.takes.find(take => take.source === (kind === 'design' ? 'designed' : 'cloned'))!
  expect(take).toMatchObject({ spokenText: metadata.dialogueText, providerId: metadata.providerId, model: metadata.models[kind].model, source: kind === 'design' ? 'designed' : 'cloned', projectVoiceId: kind === 'design' ? metadata.designedVoiceId : metadata.clonedVoiceId, projectVoiceVersion: '1' })
  if (kind === 'base') {
    const old = binding.takes.find(take => take.source === 'designed')!
    expect(binding.selectedTake).toBe(old.id)
    expect(old.id).not.toBe(take.id)
  }
  await page.getByRole('button', { name: '配音审核', exact: true }).click()
  const row = page.locator('.voice-review__line').filter({ has: page.locator('code', { hasText: metadata.lineId }) })
  await row.locator('.voice-review__take').filter({ has: page.locator('code', { hasText: take.id }) }).getByRole('button', { name: kind === 'design' ? '绑定此 take' : '替换已选配音', exact: true }).click()
  await expect.poll(async () => (await snapshot(page)).ledger.lines[metadata.lineId]?.locales['zh-CN']?.selectedTake).toBe(take.id)
  await page.evaluate(() => (window as any).designFlowFixture.sync())
  await page.evaluate(() => (window as any).designFlowFixture.persist())
  return take
}

export async function verifyExport(page: Page, info: TestInfo, metadata: RealQwenMetadata, kind: 'design' | 'base', exported: any, candidate?: AdvVoiceCandidate) {
  expect(exported.check.passed).toBe(true)
  expect(exported.diagnostics.filter((issue: any) => issue.severity === 'error')).toEqual([])
  expect(exported.chapterIds).toEqual(['intro', 'outcomes'])
  expect(exported.files).toContain('authoring/voices/library.json')
  if (kind === 'base')
    expect(exported.files).toContain(metadata.rightsPath)
  expect(exported.files.some((path: string) => path.startsWith('authoring/voices/designs/'))).toBe(true)
  expect(exported.files.some((path: string) => path.includes('voice/samples/'))).toBe(true)
  expect(exported.files.some((path: string) => path.includes('.advjs/voice'))).toBe(false)
  if (candidate)
    expect(exported.build.media.map((item: any) => item.sha256)).toEqual([candidate.sha256])
  // Keep both outputs rather than overwriting screenshots when testing two voices.
  const prefixedInfo = { ...info, outputPath: (...paths: string[]) => info.outputPath(kind, ...paths) } as TestInfo
  const player = await verifyStudioHandoffPlayer(page, prefixedInfo, { playerUrl: exported.playerUrl, lineId: metadata.lineId, text: metadata.dialogueText, takeId: exported.take.id, assetId: exported.take.assetId, minimumRms: 1e-4 })
  expect(player.voiceRms).toBeGreaterThan(1e-4)
  expect(player.runtime.voiceLineIds).toEqual([metadata.lineId])
  expect(player.runtime.assetIds).toEqual([exported.take.assetId])
  const proof = { schemaVersion: 1, root: exported.root, outDir: exported.build.outDir, check: exported.check, kind, selectedTake: exported.take, ...player }
  await writeFile(info.outputPath(`${kind}-player-proof.json`), JSON.stringify(proof, null, 2))
  return proof
}
