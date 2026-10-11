import type { EditorBridge } from 'advjs/node'
import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import { createEditorBridge } from 'advjs/node'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const lineId = 'line_019d137e-7abc-7000-8000-000000000001'
const assetIds = [1, 2].map(index => `audio_019d137e-7abc-7000-8000-00000000000${index}`)
const takeIds = [1, 2].map(index => `take_019d137e-7abc-7000-8000-00000000000${index}`)
let bridge: EditorBridge | undefined
let projectRoot = ''
let editorUrl = ''

function silentWav() {
  const dataSize = 2400 * 2
  const wav = Buffer.alloc(44 + dataSize)
  wav.write('RIFF', 0)
  wav.writeUInt32LE(36 + dataSize, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(24000, 24)
  wav.writeUInt32LE(48000, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(dataSize, 40)
  return wav
}

test.beforeEach(async ({ page }) => {
  projectRoot = await mkdtemp(join(tmpdir(), 'advjs-editor-audio-'))
  const wav = silentWav()
  const sha256 = createHash('sha256').update(wav).digest('hex')
  const kinds = ['bgm', 'ambience', 'sfx', 'ui', 'reference']
  const assets = [...assetIds.map((id, index) => ({ id, type: 'audio', kind: 'voice', path: `voice-${index}.wav`, title: `对白 ${index + 1}`, sha256, bytes: wav.length, mimeType: 'audio/wav', duration: 0.1 })), ...kinds.map(kind => ({ id: `audio-${kind}`, type: 'audio', kind, path: `${kind}.wav`, title: `${kind} 示例`, sha256, bytes: wav.length, mimeType: 'audio/wav', duration: 0.1 }))]
  const takes = assetIds.map((assetId, index) => ({ id: takeIds[index], assetId, sha256, providerId: 'fixture-tts', voiceId: 'system:fixture', model: 'fixture-model', voiceProfileRevision: sha256, inputFingerprint: sha256, spokenText: index ? '雨停了，故事继续。' : '你好，欢迎来到音频工作区。', source: 'system', createdAt: `2026-10-11T08:0${index}:00.000Z` }))
  const files = {
    'adv.config.json': JSON.stringify({ id: 'editor-audio', format: 'adv-md', root: './adv' }),
    'adv/settings/game.json': JSON.stringify({ title: '音频工作区', characters: [] }),
    'adv/chapters/intro.adv.md': `你好，欢迎来到音频工作区。 {#${lineId}}`,
    'adv/assets.json': JSON.stringify({ schemaVersion: 2, id: 'editor-audio-assets', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, assets }),
    'adv/audio/voice-ledger.json': JSON.stringify({ schemaVersion: 1, lines: { [lineId]: { speakerId: 'narrator', displayText: '你好，欢迎来到音频工作区。', locales: { 'zh-CN': { selectedTake: takeIds[0], takes }, 'en': { displayText: 'Hello, welcome to the audio workspace.', selectedTake: null, takes: [] } } } } }),
  }
  for (const [path, content] of Object.entries(files)) {
    await mkdir(join(projectRoot, path, '..'), { recursive: true })
    await writeFile(join(projectRoot, path), content)
  }
  await mkdir(join(projectRoot, 'adv/assets'), { recursive: true })
  for (const asset of assets)
    await writeFile(join(projectRoot, 'adv/assets', asset.path), wav)
  bridge = await createEditorBridge({ host: '127.0.0.1', port: 0, projectRoot, publicRoot: join(repositoryRoot, 'editor/core/dist') })
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
  bridge = undefined
  await rm(projectRoot, { recursive: true, force: true })
})

test('native resources, selected take review and mixer remain usable at normal and narrow panel widths', async ({ page }, info) => {
  await page.goto(editorUrl)
  await expect(page.locator('.advjs-editor-layout')).toBeVisible()
  const main = page.locator('[data-editor-region="main"]')
  await main.getByRole('tab', { name: '音频', exact: true }).click()
  const panel = main.locator('.ae-audio-workspace')
  await expect(panel.locator('[data-asset-id]')).toHaveCount(7)
  await expect(panel.locator('audio')).toHaveCount(0)
  const directory = process.env.ADVJS_AUDIO_SCREENSHOTS || join(tmpdir(), 'advjs-editor-audio-artifacts')
  await mkdir(directory, { recursive: true })
  await panel.screenshot({ path: join(directory, `resources-normal-${info.project.name}.png`), animations: 'disabled' })
  await panel.getByRole('tab', { name: '对白配音', exact: true }).click()
  await expect(panel.getByTestId('voice-synthesize')).toBeDisabled()
  await expect(panel.getByText('当前已选 take', { exact: true })).toBeVisible()
  await panel.getByRole('combobox', { name: '审核历史配音 take' }).click()
  await page.getByRole('option', { name: 'fixture-tts · fixture-model · 2026-10-11T08:01:00.000Z', exact: true }).click()
  await expect(panel.getByTestId('take-select')).toBeDisabled()
  await panel.getByRole('checkbox', { name: '明确替换当前已选配音' }).check()
  await panel.getByTestId('take-select').click()
  await expect.poll(async () => JSON.parse(await readFile(join(projectRoot, 'adv/audio/voice-ledger.json'), 'utf8')).lines[lineId].locales['zh-CN'].selectedTake).toBe(takeIds[1])
  await panel.locator('summary').filter({ hasText: '不可变生成记录与权利信息' }).click()
  await panel.screenshot({ path: join(directory, `voice-normal-${info.project.name}.png`), animations: 'disabled' })
  await page.addStyleTag({ content: '.ae-audio-workspace { width: 320px !important; max-width: 320px !important; }' })
  await expect.poll(() => panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await panel.screenshot({ path: join(directory, `voice-narrow-${info.project.name}.png`), animations: 'disabled' })
  await panel.getByRole('tab', { name: '混音配置', exact: true }).click()
  await expect(panel.getByTestId('mixer-save')).toBeEnabled()
  await panel.getByTestId('mixer-save').click()
  await expect(panel.getByText('混音配置已保存到项目。', { exact: true })).toBeVisible()
  const mixer = JSON.parse(await readFile(join(projectRoot, 'adv/audio/mixer.json'), 'utf8'))
  expect(Object.keys(mixer.buses)).toEqual(['master', 'music', 'ambience', 'voice', 'sfx', 'ui'])
  await expect.poll(() => panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await panel.screenshot({ path: join(directory, `mixer-narrow-${info.project.name}.png`), animations: 'disabled' })
})

test('story graph audio properties and inline source editing write the same native operations', async ({ page }, info) => {
  await page.goto(editorUrl)
  const main = page.locator('[data-editor-region="main"]')
  await main.getByRole('tab', { name: '流程图', exact: true }).click()
  const flow = main.locator('.advjs-flow-editor')
  await flow.getByRole('button', { name: '全部剧情详情', exact: true }).click()
  await flow.getByRole('button', { name: /^音频属性：你好/u }).click()
  const inspector = flow.getByRole('region', { name: '流程音频属性', exact: true })
  await inspector.getByTestId('audio-operation-add').click()
  await inspector.getByRole('combobox').nth(2).click()
  await page.getByRole('option', { name: 'bgm 示例', exact: true }).click()
  await inspector.getByTestId('flow-audio-save').click()
  await expect(inspector.getByText('场景音频已保存。', { exact: true })).toBeVisible()
  const path = join(projectRoot, 'adv/chapters/intro.adv.md')
  await expect.poll(() => readFile(path, 'utf8')).toContain('"asset": "audio-bgm"')
  const directory = process.env.ADVJS_AUDIO_SCREENSHOTS || join(tmpdir(), 'advjs-editor-audio-artifacts')
  await inspector.screenshot({ path: join(directory, `flow-audio-normal-${info.project.name}.png`), animations: 'disabled' })
  await page.addStyleTag({ content: '.flow-audio-inspector { width: 320px !important; max-width: 320px !important; }' })
  await expect.poll(() => inspector.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await inspector.screenshot({ path: join(directory, `flow-audio-narrow-${info.project.name}.png`), animations: 'disabled' })
  await inspector.getByRole('button', { name: '关闭', exact: true }).click()
  await flow.getByRole('button', { name: /^定位源码：你好/u }).click()
  await main.getByRole('button', { name: '场景音频', exact: true }).click()
  const inline = main.getByRole('region', { name: '源码音频属性', exact: true })
  await inline.getByTestId('audio-operation-add').click()
  await inline.getByRole('combobox').first().click()
  await page.getByRole('option', { name: '环境音', exact: true }).click()
  await inline.getByRole('combobox').nth(3).click()
  await page.getByRole('option', { name: 'ambience 示例', exact: true }).click()
  await inline.getByTestId('inline-audio-apply').click()
  await expect(inline).not.toBeVisible()
  await expect(main.getByRole('button', { name: '保存', exact: true })).toBeEnabled()
  await main.getByRole('button', { name: '保存', exact: true }).click()
  await expect.poll(() => readFile(path, 'utf8')).toContain('"slot": "bed"')
  const written = await readFile(path, 'utf8')
  expect(written).toContain('"asset": "audio-bgm"')
  expect(written).toContain('"asset": "audio-ambience"')
  expect(written).toContain(`{#${lineId}}`)
})
