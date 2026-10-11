import type { Page } from '@playwright/test'
import type { EditorBridge } from 'advjs/node'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import { createEditorBridge } from 'advjs/node'
import { createEditorVoiceDesignFixture } from '../fixtures/audio/editor-voice-design'

const repositoryRoot = resolve(import.meta.dirname, '../..')
let fixture: Awaited<ReturnType<typeof createEditorVoiceDesignFixture>>
let bridge: EditorBridge
let editorUrl: string

async function choose(page: Page, label: string, option: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

test.beforeEach(async ({ page }) => {
  fixture = await createEditorVoiceDesignFixture()
  bridge = await createEditorBridge({ host: '127.0.0.1', port: 0, projectRoot: fixture.root, publicRoot: join(repositoryRoot, 'editor/core/dist'), audioJobs: { config: fixture.config, storeDirectory: fixture.storeDirectory } })
  editorUrl = (await bridge.start()).url
  await page.addInitScript(() => {
    localStorage.setItem('advjs:editor:locale', 'zh-CN')
    localStorage.setItem('advjs:editor:onboarded', 'true')
    localStorage.setItem('nuxt-color-mode', 'dark')
  })
  await page.setViewportSize({ width: 1440, height: 1000 })
})
test.afterEach(async () => {
  await bridge?.stop()
  await rm(fixture.directory, { recursive: true, force: true })
})

test('production Editor designs immutable voices, auditions native candidates and explicitly applies a reviewed sample', async ({ page }, info) => {
  await page.goto(editorUrl)
  const main = page.locator('[data-editor-region="main"]')
  await main.getByRole('tab', { name: '音频', exact: true }).click()
  const panel = main.locator('.ae-audio-workspace')
  await panel.getByRole('tab', { name: '音色设计', exact: true }).click()
  const design = panel.getByRole('region', { name: '音色设计', exact: true })
  await expect(design.getByTestId('design-new')).toBeEnabled()
  expect(fixture.calls).toHaveLength(0)
  await design.getByTestId('design-new').click()
  await choose(page, '设计角色／旁白', 'Hero')
  await design.getByLabel('音色名称', { exact: true }).fill('Hero 温暖音色')
  await design.getByLabel('说话风格', { exact: true }).fill('清晰温暖')
  await choose(page, 'zh-CN fixture-tts 音色来源', '描述设计')
  await design.getByLabel('音色描述', { exact: true }).fill('清晰、温暖、自然的原创声音')
  await design.getByTestId('design-save').click()
  await expect(design.getByTestId('design-new-version')).toBeEnabled()
  expect(fixture.calls).toHaveLength(0)
  const saved = JSON.parse(await readFile(join(fixture.root, 'authoring/voices/library.json'), 'utf8'))
  const voiceId = saved.voices[0].id
  expect(saved.voices[0].design.locales['zh-CN'].providers['fixture-tts'].source).toBe('designed')
  await design.getByRole('checkbox', { name: '当前费用无法估算；我允许在字符预算内生成试听', exact: true }).check()
  await design.getByTestId('design-plan').click()
  await expect(design.getByTestId('design-review')).toBeVisible()
  await expect(design.getByTestId('design-execute')).toBeDisabled()
  expect(fixture.calls).toHaveLength(0)
  await design.getByRole('checkbox', { name: '我已核对音色、语言、试听文本与预算', exact: true }).check()
  await design.getByTestId('design-execute').click()
  await expect(design.getByTestId('design-preview-ready')).toBeVisible()
  expect(fixture.calls).toHaveLength(1)
  await expect(design.getByTestId('design-apply')).toBeDisabled()
  await design.getByTestId('design-audition').click()
  const audio = design.getByLabel('音色候选试听')
  await expect(audio).toBeVisible()
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.readyState >= 2 && Number.isFinite(element.duration))).toBe(true)
  const signal = await audio.evaluate(async (element: HTMLAudioElement) => {
    const context = new AudioContext()
    const buffer = await context.decodeAudioData(await (await fetch(element.src)).arrayBuffer())
    const samples = buffer.getChannelData(0)
    const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length)
    await context.close()
    return { duration: buffer.duration, rms }
  })
  expect(signal.duration).toBeCloseTo(1, 2)
  expect(signal.rms).toBeGreaterThan(0.1)
  const directory = process.env.ADVJS_AUDIO_SCREENSHOTS || join(tmpdir(), 'advjs-editor-audio-artifacts')
  await mkdir(directory, { recursive: true })
  await panel.screenshot({ path: join(directory, `voice-design-normal-${info.project.name}.png`), animations: 'disabled' })
  const narrow = await page.addStyleTag({ content: '.ae-audio-workspace { width: 320px !important; max-width: 320px !important; }' })
  await expect.poll(() => panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await panel.screenshot({ path: join(directory, `voice-design-narrow-${info.project.name}.png`), animations: 'disabled' })
  await narrow.evaluate(element => element.remove())
  await design.getByTestId('design-stop-audition').click()
  await expect(audio).toHaveCount(0)
  await design.getByTestId('design-register').click()
  await expect(design.getByTestId('design-preview-registered')).toBeVisible()
  await expect(design.getByTestId('design-apply')).toBeDisabled()
  await design.getByTestId('design-select-sample').click()
  await expect(design.getByTestId('design-select-sample')).toBeDisabled()
  await expect(design.getByTestId('design-apply')).toBeDisabled()
  await design.getByRole('checkbox', { name: '我确认替换此语言／供应商的已有角色音色绑定', exact: true }).check()
  await design.getByTestId('design-apply').click()
  await expect.poll(async () => JSON.parse(await readFile(join(fixture.root, 'adv/settings/game.json'), 'utf8')).characters[0].voiceProfile.locales['zh-CN'].providers['fixture-tts'].projectVoiceId).toBe(voiceId)
  const game = JSON.parse(await readFile(join(fixture.root, 'adv/settings/game.json'), 'utf8'))
  expect(game.characters[0].voiceProfile.intent.speakingStyle).toBe('清晰温暖')
  expect(game.voiceProfile).toBeUndefined()
  await design.getByTestId('design-reload').click()
  await design.getByTestId('design-plan').click()
  await design.getByRole('checkbox', { name: '我已核对音色、语言、试听文本与预算', exact: true }).check()
  await design.getByTestId('design-execute').click()
  await expect(design.getByTestId('design-preview-registered')).toHaveCount(1)
  expect(fixture.calls).toHaveLength(1)
  await design.getByTestId('design-new-version').click()
  await design.getByLabel('音色描述', { exact: true }).fill('第二版轻快自然的声音')
  await design.getByTestId('design-save').click()
  await expect.poll(async () => JSON.parse(await readFile(join(fixture.root, 'authoring/voices/library.json'), 'utf8')).voices.length).toBe(2)
  const updated = JSON.parse(await readFile(join(fixture.root, 'authoring/voices/library.json'), 'utf8'))
  expect(updated.voices).toHaveLength(2)
  expect(updated.voices[1].id).not.toBe(voiceId)
  expect(updated.voices[1].design.supersedes).toEqual({ id: voiceId, version: '1' })
  expect(updated.voices[0].design.selectedSamples['zh-CN']['fixture-tts'].assetId).toBeTruthy()
  expect(fixture.calls).toHaveLength(1)
})

test('production Editor saves exact-language built-ins and authorized reference conditions without synthesizing', async ({ page }) => {
  await page.goto(editorUrl)
  const main = page.locator('[data-editor-region="main"]')
  await main.getByRole('tab', { name: '音频', exact: true }).click()
  const panel = main.locator('.ae-audio-workspace')
  await panel.getByRole('tab', { name: '音色设计', exact: true }).click()
  const design = panel.getByRole('region', { name: '音色设计', exact: true })
  await design.getByTestId('design-new').click()
  await choose(page, '设计角色／旁白', 'Hero')
  await choose(page, 'zh-CN fixture-tts 音色来源', '授权参考音色')
  await choose(page, 'zh-CN fixture-tts 已登记参考', '本地原创参考')
  await expect(design.getByTestId('design-save')).toBeDisabled()
  await design.getByLabel('参考文本', { exact: true }).fill('本地原创验收音频')
  await design.getByLabel('使用许可', { exact: true }).fill('original-test-license')
  await design.getByLabel('声音主体', { exact: true }).fill('original fixture')
  await design.getByLabel('项目同意文件', { exact: true }).fill('authoring/rights/original.json')
  await design.getByLabel('新增语言', { exact: true }).fill('en-US')
  await design.getByTestId('design-add-binding').click()
  await expect(design.getByRole('combobox', { name: 'en-US fixture-tts 内置音色', exact: true })).toContainText('本地验收内置音色')
  await design.getByTestId('design-save').click()
  await expect(design.getByTestId('design-new-version')).toBeEnabled()
  const voice = JSON.parse(await readFile(join(fixture.root, 'authoring/voices/library.json'), 'utf8')).voices[0]
  expect(voice.design.locales['zh-CN'].providers['fixture-tts']).toEqual({ preset: 'fixture', source: 'cloned', reference: { assetId: 'reference/original', sha256: fixture.sha256, mode: 'icl', text: '本地原创验收音频' }, rights: { license: 'original-test-license', subject: 'original fixture', consentRecord: 'authoring/rights/original.json' } })
  expect(voice.design.locales['en-US'].providers['fixture-tts']).toEqual({ preset: 'fixture', source: 'system', providerVoiceId: 'system:fixture' })
  expect(voice.implementations['fixture-tts'].localePresets['en-US'].presetPath).not.toBe(voice.implementations['fixture-tts'].localePresets['zh-CN'].presetPath)
  expect(voice.design.samples).toEqual([])
  expect(fixture.calls).toHaveLength(0)
})
