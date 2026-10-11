import type { EditorBridge } from 'advjs/node'
import { mkdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import { createEditorBridge } from 'advjs/node'
import { createEditorVoiceJobsFixture, editorJobLineIds } from '../fixtures/audio/editor-voice-jobs'

const repositoryRoot = resolve(import.meta.dirname, '../..')
let fixture: Awaited<ReturnType<typeof createEditorVoiceJobsFixture>>
let bridge: EditorBridge
let editorUrl: string

test.beforeEach(async ({ page }) => {
  fixture = await createEditorVoiceJobsFixture()
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

test('native durable jobs require review, execute locally and expose compact narrator and pronunciation editors', async ({ page }, info) => {
  await page.goto(editorUrl)
  await expect(page.locator('.advjs-editor-layout')).toBeVisible()
  const main = page.locator('[data-editor-region="main"]')
  await main.getByRole('tab', { name: '音频', exact: true }).click()
  const panel = main.locator('.ae-audio-workspace')
  await panel.getByRole('tab', { name: '配音任务', exact: true }).click()
  const jobs = panel.getByRole('region', { name: '配音生成任务', exact: true })
  await expect(jobs.getByText('默认预设：fixture。', { exact: false })).toBeVisible()
  expect(fixture.calls).toHaveLength(0)
  await jobs.getByRole('button', { name: '全选', exact: true }).click()
  await jobs.getByTestId('jobs-plan').click()
  await expect(jobs.getByRole('alert')).toContainText('AUDIO_JOB_UNKNOWN_COST')
  await jobs.getByRole('checkbox', { name: '我同意费用无法估算，按上述字符预算执行', exact: true }).check()
  await jobs.getByTestId('jobs-plan').click()
  await expect(jobs.getByTestId('jobs-plan-review')).toContainText('2 句')
  await expect(jobs.getByTestId('jobs-enqueue')).toBeDisabled()
  const directory = process.env.ADVJS_AUDIO_SCREENSHOTS || join(tmpdir(), 'advjs-editor-audio-artifacts')
  await mkdir(directory, { recursive: true })
  await panel.screenshot({ path: join(directory, `jobs-review-normal-${info.project.name}.png`), animations: 'disabled' })
  let narrow = await page.addStyleTag({ content: '.ae-audio-workspace { width: 320px !important; max-width: 320px !important; }' })
  await expect.poll(() => panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await panel.screenshot({ path: join(directory, `jobs-review-narrow-${info.project.name}.png`), animations: 'disabled' })
  await narrow.evaluate(element => element.remove())
  await jobs.getByRole('checkbox', { name: '我已审核范围、语言与预算；生成不会替换已选配音', exact: true }).check()
  await jobs.getByTestId('jobs-enqueue').click()
  await expect(jobs.locator('[data-task-status="queued"]')).toHaveCount(2)
  expect(fixture.calls).toHaveLength(0)
  await jobs.getByTestId('jobs-run').click()
  await expect(jobs.locator('[data-task-status="committed"]')).toHaveCount(2)
  expect(fixture.calls).toHaveLength(2)
  const ledger = JSON.parse(await readFile(join(fixture.root, 'adv/audio/voice-ledger.json'), 'utf8'))
  for (const lineId of editorJobLineIds) {
    expect(ledger.lines[lineId!].locales['zh-CN'].selectedTake).toBeNull()
    expect(ledger.lines[lineId!].locales['zh-CN'].takes).toHaveLength(1)
  }
  await jobs.getByTestId('jobs-refresh').click()
  await jobs.locator('summary').filter({ hasText: '创建与审核计划' }).click()
  await panel.screenshot({ path: join(directory, `jobs-complete-normal-${info.project.name}.png`), animations: 'disabled' })
  narrow = await page.addStyleTag({ content: '.ae-audio-workspace { width: 320px !important; max-width: 320px !important; }' })
  await expect.poll(() => panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await panel.screenshot({ path: join(directory, `jobs-complete-narrow-${info.project.name}.png`), animations: 'disabled' })
  await narrow.evaluate(element => element.remove())
  for (const [title, prefix, label] of [['旁白声音', 'narrator-profile', '项目旁白配音'], ['发音词典', 'pronunciation', '项目发音词典']]) {
    await panel.getByRole('tab', { name: title!, exact: true }).click()
    await expect(panel.getByRole('region', { name: label!, exact: true })).toBeVisible()
    await panel.screenshot({ path: join(directory, `${prefix}-normal-${info.project.name}.png`), animations: 'disabled' })
    narrow = await page.addStyleTag({ content: '.ae-audio-workspace { width: 320px !important; max-width: 320px !important; }' })
    await expect.poll(() => panel.evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await panel.screenshot({ path: join(directory, `${prefix}-narrow-${info.project.name}.png`), animations: 'disabled' })
    await narrow.evaluate(element => element.remove())
  }
})
