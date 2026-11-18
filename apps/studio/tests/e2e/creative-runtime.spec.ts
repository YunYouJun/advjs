import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import { configureTemplateRecording, importTemplateMedia, playTemplateMedia } from './production-media-workflow'

for (const media of [false, true]) {
  test(media ? 'adopts and plays actual media through the product and real Runtime service, then stales changed speech' : 'runs the actual product six-role journey through HTTP, task engine, worker, repair, adoption and independent closure', async ({ page, request }, info) => {
    test.setTimeout(240000)
    const audioPath = process.env.STUDIO_CREATIVE_VOICE_WAV
    test.skip(media && !audioPath, 'Requires the existing real external speech; never generates new media')
    const url = '/tabs/workspace/creative-team'
    let playback: unknown[] = []
    let voiceCoverage: string[] = []
    await page.addInitScript((media) => {
      localStorage.setItem('creative-runtime-fixture-mode', media ? 'media' : 'text')
      const rows: any[] = []
      Object.assign(window, { templatePlayback: rows })
      const start = AudioBufferSourceNode.prototype.start
      AudioBufferSourceNode.prototype.start = function (...args: Parameters<typeof start>) {
        if (this.buffer && this.buffer.duration > 1) {
          const at = this.context.currentTime
          const row = { duration: this.buffer.duration, state: this.context.state, ended: false, trusted: false, elapsed: 0 }
          rows.push(row)
          this.addEventListener('ended', event => Object.assign(row, { ended: true, trusted: event.isTrusted, elapsed: this.context.currentTime - at }), { once: true })
        }
        return start.apply(this, args)
      }
    }, media)
    const errors: string[] = []
    const warnings: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error')
        errors.push(message.text())
      if (message.type() === 'warning')
        warnings.push(message.text())
    })
    const snapshot = async () => ({ ui: await page.evaluate(async () => ({ run: (window as any).creativeRuntimeFixture.run(), files: await (window as any).creativeRuntimeFixture.files(), media: await (window as any).creativeRuntimeFixture.media() })), service: await (await request.get('http://127.0.0.1:4205/__fixture/snapshot')).json() })
    const card = (summary: string) => page.locator('.team-artifact').filter({ has: page.getByRole('heading', { name: summary, exact: true }) }).last()
    async function select(summary: string) {
      await expect(card(summary)).toBeVisible({ timeout: 30000 })
      await card(summary).getByRole('button', { name: '选定候选并继续', exact: true }).click()
    }
    try {
      await page.goto(url)
      await expect(page).toHaveTitle('ADV.JS Studio')
      await expect(page.locator('vite-error-overlay')).toHaveCount(0)
      await expect(page.getByText('还没有制作组任务。可以先请导演制定计划，也可以直接找一位伙伴。')).toBeVisible()
      if (media)
        await configureTemplateRecording(page, url, 'creativeRuntimeFixture')
      const initial = await (await request.get('http://127.0.0.1:4205/__fixture/snapshot')).json()
      await page.locator('#team-goal').fill('雨夜车站，两位主要人物和两个结局；缺失媒体明确交接。')
      await page.locator('#team-budget').fill('1.234')
      await page.getByRole('button', { name: '建立任务并审阅', exact: true }).click()
      await expect(page.getByRole('button', { name: '确认预算并开始', exact: true })).toBeVisible()
      expect((await (await request.get('http://127.0.0.1:4205/__fixture/snapshot')).json()).executions).toEqual(initial.executions)
      await page.getByRole('button', { name: '确认预算并开始', exact: true }).click()
      await expect(page.getByRole('heading', { name: '模板起步 · 六角色分工 fixture', exact: true })).toBeVisible({ timeout: 30000 })
      const state = await (await request.get('http://127.0.0.1:4205/__fixture/snapshot')).json()
      expect(state.failures).toEqual([])
      expect(state.executions).toHaveLength(initial.executions.length + 1)
      expect(state.ledger.slice(initial.ledger.length).map((item: any) => item.kind)).toEqual(['reserve', 'settle'])
      expect(state.account.reservedMicroPoints).toBe(0)
      expect(state.account.chargedMicroPoints).toBeGreaterThan(0)
      expect(state.tasks.at(-1)).toMatchObject({ status: 'completed', billingStatus: 'settled', attempt: 1 })
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 })
        await page.getByRole('heading', { name: '模板起步 · 六角色分工 fixture', exact: true }).scrollIntoViewIfNeeded()
        await page.screenshot({ path: info.outputPath(`runtime-director-${width}.png`) })
      }
      await card('模板起步 · 六角色分工 fixture').getByRole('button', { name: '确认分工并继续', exact: true }).click()
      await expect(card('模板起步 · 两位人物 fixture')).toBeVisible({ timeout: 30000 })
      await card('模板起步 · 两位人物 fixture').getByRole('button', { name: '编辑候选', exact: true }).click()
      const editor = page.getByTestId('creative-candidate-editor').filter({ visible: true })
      await editor.locator('textarea[id$="-lin-motivation"]').fill('先核对信封署名，再寻找收件人')
      await editor.getByLabel('本次修改的原因').fill('真实 HTTP 作者修订，应进入后续编剧上下文')
      await editor.getByRole('button', { name: '保存候选修订', exact: true }).click()
      await select('模板起步 · 两位人物 fixture')
      await expect(card('模板起步 · 含预埋问题的章节 fixture')).toBeVisible({ timeout: 30000 })
      await card('模板起步 · 含预埋问题的章节 fixture').getByRole('button', { name: '编辑候选', exact: true }).click()
      const script = editor.getByRole('group', { name: '01', exact: true }).getByLabel('AdvScript', { exact: true })
      await expect(script).toHaveValue(/先核对信封署名，再寻找收件人/)
      await script.fill((await script.inputValue()).replace('等我确认信上的名字。', '让我再核对一次信上的名字。'))
      if (media)
        await editor.getByRole('button', { name: '补齐台词身份', exact: true }).click()
      await editor.getByLabel('本次修改的原因').fill('保留作者对白和可复现的悬空结局')
      await editor.getByRole('button', { name: '保存候选修订', exact: true }).click()
      await select('模板起步 · 含预埋问题的章节 fixture')
      await select('模板起步 · 美术交接 fixture')
      await select('模板起步 · 人物与旁白方案 fixture')
      await select('模板起步 · 两结局计划 fixture')
      const candidates = await snapshot()
      expect(new Set(candidates.ui.run.artifacts.map((item: any) => item.partner))).toEqual(new Set(['director', 'character-designer', 'writer', 'art-director', 'voice-director', 'playtester']))
      expect(Object.keys(candidates.ui.files)).toHaveLength(media ? 7 : 5)
      const playtest = page.getByTestId('creative-playtest')
      await playtest.getByRole('combobox', { name: '执行快照', exact: true }).selectOption('candidate')
      await playtest.getByRole('button', { name: '载入试玩员提出的路径', exact: true }).click()
      await playtest.getByRole('button', { name: '执行这些路径', exact: true }).click()
      await expect(playtest.getByText('已同步作者宿主报告，服务端未重放', { exact: true })).toBeVisible()
      const repair = page.getByTestId('creative-playtest-repair')
      await repair.getByRole('combobox', { name: '报告问题', exact: true }).selectOption({ label: 'ADV_RUNTIME_UNKNOWN_TARGET · adv/chapters/01.adv.md' })
      await repair.getByRole('combobox', { name: '负责任务', exact: true }).selectOption('script')
      await repair.getByRole('button', { name: '按此报告返工', exact: true }).click()
      await select('模板起步 · 修复悬空结局 fixture')
      for (const [taskId, summary] of [['voice', '模板起步 · 人物与旁白方案 fixture'], ['check', '模板起步 · 两结局计划 fixture']]) {
        const rework = page.getByTestId('creative-task-rework').filter({ has: page.locator(`#creative-rework-${taskId}`) })
        await rework.locator('textarea').fill('作者明确要求按修复后的章节重新核对')
        await rework.getByRole('button', { name: '请求返工', exact: true }).click()
        await select(summary)
      }
      await playtest.getByRole('button', { name: '载入这份报告的复现输入', exact: true }).click()
      await playtest.getByRole('button', { name: '执行这些路径', exact: true }).click()
      await expect(page.getByTestId('creative-playtest-report').getByRole('heading', { name: /指定路径通过/ })).toHaveCount(2)
      const milestone = page.getByTestId('creative-milestone')
      await milestone.getByRole('checkbox', { name: '模板起步 · 两位人物 fixture', exact: true }).check()
      await milestone.getByRole('checkbox', { name: '模板起步 · 修复悬空结局 fixture', exact: true }).check()
      await milestone.getByLabel('采用或撤销的原因').fill('实际服务确认人物和修复章节的采用')
      await milestone.getByRole('button', { name: '审阅采用', exact: true }).click()
      await milestone.getByRole('button', { name: '确认写入项目', exact: true }).click()
      await expect(milestone.getByText(/最近一次采用已确认 · 实际服务确认人物和修复章节的采用/)).toBeVisible()
      if (media) {
        await importTemplateMedia(page, url, audioPath!, 'creativeRuntimeFixture')
        const rework = page.getByTestId('creative-task-rework').filter({ has: page.locator('#creative-rework-check') })
        await rework.locator('textarea').fill('真实媒体已经采用，按当前保存版本重新核对。')
        await rework.getByRole('button', { name: '请求返工', exact: true }).click()
        await select('模板起步 · 两结局计划 fixture')
      }
      await playtest.getByRole('combobox', { name: '执行快照', exact: true }).selectOption('saved')
      await playtest.getByRole('button', { name: '载入试玩员提出的路径', exact: true }).click()
      await playtest.getByRole('button', { name: '执行这些路径', exact: true }).click()
      await expect(page.getByTestId('creative-playtest-report').getByRole('heading', { name: /指定路径通过/ })).toHaveCount(2)
      await expect.poll(() => page.evaluate(() => ((window as any).creativeRuntimeFixture.run().playtests ?? []).filter((item: any) => item.scope === 'saved').map((item: any) => [item.passed, item.failed])), { timeout: 15000 }).toEqual([[2, 0]])
      if (media) {
        playback = await playTemplateMedia(page, url, info, 'creativeRuntimeFixture')
        const coverage = page.getByTestId('creative-voice-coverage')
        await coverage.getByRole('button', { name: '检查全部对白配音', exact: true }).click()
        await coverage.getByRole('combobox', { name: '配音状态', exact: true }).selectOption('all')
        const rows = coverage.getByTestId('creative-voice-coverage-row')
        await expect(rows.filter({ hasText: '已选用，字节匹配' })).toHaveCount(1)
        await expect(rows.filter({ hasText: '缺少配音' })).toHaveCount(4)
        voiceCoverage = await rows.allTextContents()
      }
      await page.getByRole('button', { name: '生成导演交付建议', exact: true }).click()
      await select('实际服务记录的替身导演建议')
      const delivery = page.getByTestId('creative-delivery')
      await expect(delivery.getByLabel('采用、保留或排除的理由', { exact: true })).toHaveCount(media ? 10 : 7)
      for (const reason of await delivery.getByLabel('采用、保留或排除的理由', { exact: true }).all())
        await reason.fill('仅核对实际 Runtime 服务接线与作者决定，模型及媒体品质尚未验收。')
      await delivery.getByLabel('作者交付说明与剩余事项', { exact: true }).fill(media ? '实际 HTTP／服务／任务／Worker 与一张既有图片、一段外部对白播放已验证；另四条配音缺失。身份、模型、积分与数据库端口是明确替身，品质未验收。' : '本地实际 HTTP／服务／任务／Worker 已验证；身份、模型、积分与数据库端口是明确替身，图片和音频未制作。')
      await delivery.getByRole('checkbox').check()
      await delivery.getByRole('button', { name: '审阅交付记录', exact: true }).click()
      await delivery.getByRole('button', { name: '确认记录并结束本次制作组', exact: true }).click()
      await expect(delivery.getByText(/作者已结束本次制作组/)).toBeVisible()
      const closed = await snapshot()
      expect(closed.service.failures).toEqual([])
      expect(closed.service.account.reservedMicroPoints).toBe(0)
      expect(closed.service.account.chargedMicroPoints).toBe(initial.account.chargedMicroPoints + closed.ui.run.chargedMicroPoints)
      expect(closed.service.executions).toHaveLength(initial.executions.length + (media ? 12 : 10))
      expect(closed.service.ledger.slice(initial.ledger.length).filter((item: any) => item.kind === 'settle')).toHaveLength(media ? 12 : 10)
      expect(closed.service.outputs.slice(initial.outputs.length).find((item: any) => item.capability === 'write-chapters').handoff.candidates.some((item: any) => item.output?.kind === 'characters' && item.output.characters[0].motivation === '先核对信封署名，再寻找收件人')).toBe(true)
      const writer = closed.service.tasks.slice(initial.tasks.length).find((item: any) => item.capabilityId === 'write-chapters')
      expect(writer.payload.context.files['adv/characters/lin.character.md']).toContain('先核对信封署名，再寻找收件人')
      expect(writer.executionPlan.request.prompt.user).toContain('先核对信封署名，再寻找收件人')
      expect(closed.service.submissions.slice(initial.submissions.length).every((item: any) => item.childContextVersion === 2 && item.inputBytes <= 56 * 1024)).toBe(true)
      if (media) {
        expect(closed.ui.media).toHaveLength(2)
        expect(closed.ui.media.every((asset: any) => asset.sha256 === asset.expectedSha256 && asset.bytes === asset.expectedBytes)).toBe(true)
      }
      for (const width of [1280, 390]) {
        await page.setViewportSize({ width, height: 900 })
        await delivery.scrollIntoViewIfNeeded()
        await page.screenshot({ path: info.outputPath(`runtime-closed-${width}.png`) })
      }
      const posts: string[] = []
      page.on('request', request => request.method() === 'POST' && posts.push(request.url()))
      await page.reload()
      await expect(delivery.getByText(/作者已结束本次制作组/)).toBeVisible()
      const reopened = await snapshot()
      expect(reopened.ui.files).toEqual(closed.ui.files)
      expect(reopened.ui.run.delivery).toEqual(closed.ui.run.delivery)
      expect(reopened.ui.media).toEqual(closed.ui.media)
      expect(reopened.service.executions).toEqual(closed.service.executions)
      expect(reopened.service.ledger).toEqual(closed.service.ledger)
      expect(posts).toEqual([])
      let edited: unknown
      if (media) {
        await page.goto('/editor?file=adv%2Fchapters%2F01.adv.md')
        const source = page.locator('.editor-textarea')
        await expect(source).toHaveValue(reopened.ui.files['adv/chapters/01.adv.md'])
        await source.fill(reopened.ui.files['adv/chapters/01.adv.md'].replace('列车还没有到，我们再等一会儿。', '列车已经到了，我们现在出发。'))
        await page.getByRole('button', { name: '保存', exact: true }).click()
        await expect(page.getByRole('button', { name: '保存', exact: true })).toBeEnabled()
        await page.goto('/tabs/workspace/audio?section=review&speaker=lin&line=line_01900400-0000-7000-8000-000000000001')
        const stale = page.getByTestId('audio-workspace').getByText('文本已变化', { exact: true }).first()
        await expect(stale).toBeVisible()
        await stale.scrollIntoViewIfNeeded()
        await expect(stale).toBeInViewport()
        await page.screenshot({ path: info.outputPath('runtime-changed-speech-stale.png') })
        await page.goto(url)
        await expect(delivery.getByText(/作者已结束本次制作组/)).toBeVisible()
        edited = await snapshot()
        expect((edited as any).ui.run.delivery).toEqual(closed.ui.run.delivery)
        expect((edited as any).ui.media).toEqual(closed.ui.media)
        expect((edited as any).service.executions).toEqual(closed.service.executions)
        expect((edited as any).service.ledger).toEqual(closed.service.ledger)
      }
      await writeFile(info.outputPath('runtime-http-journey.json'), JSON.stringify({ scope: 'Actual product App/session/clients -> HTTP/auth boundary -> creative service/CloudBase store adapter -> task engine -> Worker -> production parser/artifact stamping. Identity, database, point port and provider responses remain explicit local substitutes; no production billing or model quality proof.', initial, director: state, candidates, playback, voiceCoverage, closed, reopened, edited }, null, 2))
    }
    catch (cause) {
      await writeFile(info.outputPath('interaction-failure.txt'), cause instanceof Error ? cause.stack ?? cause.message : String(cause))
      throw cause
    }
    finally {
      await writeFile(info.outputPath('service-state.json'), JSON.stringify(await snapshot().catch(() => ({ unavailable: true })), null, 2))
      await writeFile(info.outputPath('browser-console.json'), JSON.stringify({ errors, warnings }, null, 2))
      expect(errors).toEqual([])
      expect(warnings).toEqual([])
    }
  })
}
