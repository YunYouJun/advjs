import type { EditorBridge } from 'advjs/node'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { parseCharacterMd } from '@advjs/parser'
import { expect, test } from '@playwright/test'
import { createEditorBridge } from 'advjs/node'
import { createEditorVoiceJobsFixture } from '../fixtures/audio/editor-voice-jobs'

const repositoryRoot = resolve(import.meta.dirname, '../..')
let fixture: Awaited<ReturnType<typeof createEditorVoiceJobsFixture>>
let bridge: EditorBridge
let editorUrl: string
let characterPath: string

test.beforeEach(async ({ page }) => {
  fixture = await createEditorVoiceJobsFixture()
  await writeFile(join(fixture.root, 'adv/settings/game.json'), JSON.stringify({ title: '配音角色验收', characters: [] }))
  characterPath = join(fixture.root, 'adv/characters/hero.character.md')
  await mkdir(join(fixture.root, 'adv/characters'), { recursive: true })
  await writeFile(characterPath, `---\nid: hero\nname: Hero\ncv: Original actor\nauthorNote: Keep author metadata\nvoiceProfile: ${JSON.stringify(fixture.profile)}\n---\n\n## 性格\n\nKeep the character prose.\n`)
  bridge = await createEditorBridge({ host: '127.0.0.1', port: 0, projectRoot: fixture.root, publicRoot: join(repositoryRoot, 'editor/core/dist'), audioJobs: { config: fixture.config, storeDirectory: fixture.storeDirectory } })
  const address = new URL((await bridge.start()).url)
  address.pathname = '/characters/hero'
  editorUrl = address.toString()
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

test('native character voice profiles save and clear through the real Editor source seam at normal and 320px widths', async ({ page }, info) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.goto(editorUrl)
  const detail = page.locator('.character-detail')
  await expect(detail).toContainText('fixture-model')
  await detail.getByRole('button', { name: '编辑', exact: true }).click()
  const form = page.locator('.character-form')
  const voice = form.locator('details').filter({ has: page.getByText('配音配置', { exact: true }) })
  await expect(voice.getByLabel('说话风格', { exact: true })).toBeVisible()
  await voice.getByLabel('说话风格', { exact: true }).fill('Calm narration')
  await voice.getByLabel('气质', { exact: true }).fill('calm, warm')
  await form.getByRole('combobox', { name: '音高', exact: true }).click()
  await page.getByRole('option', { name: 'high', exact: true }).click()
  await form.getByRole('combobox', { name: '音高', exact: true }).click()
  await page.getByRole('option', { name: '未指定', exact: true }).click()
  const directory = process.env.ADVJS_AUDIO_SCREENSHOTS || join(tmpdir(), 'advjs-editor-audio-artifacts')
  await mkdir(directory, { recursive: true })
  await voice.screenshot({ path: join(directory, `character-profile-normal-${info.project.name}.png`), animations: 'disabled' })
  const narrow = await page.addStyleTag({ content: '.character-form { width: 320px !important; max-width: 320px !important; }' })
  await expect.poll(() => form.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await voice.screenshot({ path: join(directory, `character-profile-narrow-${info.project.name}.png`), animations: 'disabled' })
  await narrow.evaluate(element => element.remove())
  await form.getByRole('button', { name: '保存', exact: true }).click()
  await expect.poll(async () => parseCharacterMd(await readFile(characterPath, 'utf8')).voiceProfile?.intent.speakingStyle).toBe('Calm narration')
  let source = await readFile(characterPath, 'utf8')
  expect(parseCharacterMd(source).cv).toBe('Original actor')
  expect(source).toContain('authorNote: Keep author metadata')
  expect(source).toContain('Keep the character prose.')
  expect(parseCharacterMd(source).voiceProfile?.intent.pitch).toBeUndefined()
  await detail.getByRole('button', { name: '编辑', exact: true }).click()
  await form.getByTestId('character-voice-clear').click()
  await form.getByRole('button', { name: '保存', exact: true }).click()
  await expect.poll(() => readFile(characterPath, 'utf8')).not.toContain('voiceProfile:')
  source = await readFile(characterPath, 'utf8')
  expect(parseCharacterMd(source).cv).toBe('Original actor')
  expect(source).toContain('Keep the character prose.')
  expect(fixture.calls).toHaveLength(0)
  expect(errors).toEqual([])
})
