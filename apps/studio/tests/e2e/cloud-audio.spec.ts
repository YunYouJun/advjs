import type { VoiceGenerationJob } from '@advjs/audio'
import type { Browser, BrowserContext } from '@playwright/test'
import type { HostedAudioPublication, HostedVoiceReceipts, HostedVoiceReviewedPlan } from '../../../../packages/advjs/shared/hosted-audio'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { expect, test, webkit } from '@playwright/test'
import { cloudAudioProjectUrl, readStudioCloudAudioGate } from '../fixtures/cloud-audio/config'
import { chooseCloudOption, hostedResponse, openCloudAudio, readCloudJobs, verifyCloudPublication } from '../fixtures/cloud-audio/journey'
import { verifyStudioHandoffPlayer } from '../fixtures/design-flow/player'

const gate = readStudioCloudAudioGate(process.env)
test.skip(!gate.enabled, gate.enabled ? '' : gate.reason)

test('reads the deployed Studio account/project through its genuine CloudBase session', async ({ page, request }, info) => {
  if (!gate.enabled)
    return
  const target = gate.target
  const mutatingRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().startsWith(`${cloudAudioProjectUrl(target)}/`) && !['GET', 'OPTIONS'].includes(request.method()))
      mutatingRequests.push(request.method())
  })
  const unauthorized = await request.get(`${cloudAudioProjectUrl(target)}/jobs`)
  expect(unauthorized.status()).toBe(401)
  const identity = await openCloudAudio(page, target)
  const jobs = await readCloudJobs(page, target)
  const publication = page.getByTestId('audio-publication')
  const currentResponse = hostedResponse(page, target, '/releases/current')
  await publication.getByRole('button', { name: /^(?:查询发布状态|Check publication)$/u }).click()
  expect((await currentResponse).status()).toBe(200)
  await page.getByTestId('audio-workspace').screenshot({ path: info.outputPath('cloud-audio-normal.png') })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByTestId('audio-workspace').screenshot({ path: info.outputPath('cloud-audio-narrow.png') })
  expect(mutatingRequests).toEqual([])
  await writeFile(info.outputPath('cloud-read-proof.json'), JSON.stringify({ schemaVersion: 1, studioUrl: target.studioUrl, serviceUrl: target.serviceUrl, ...identity, unauthenticatedStatus: unauthorized.status(), configured: jobs.configured, providers: jobs.providers.map(provider => provider.id), jobs: jobs.jobs.length, mutatingRequests: mutatingRequests.length, cloudComputeVerifiedByThisBrowserTest: false }, null, 2))
})

test('explicitly generates at most one reviewed line, adopts it and publishes genuine cloud variants', async ({ page }, info) => {
  test.skip(!gate.enabled || !gate.target.publish, 'Cloud writes require ADVJS_STUDIO_CLOUD_WRITE=1 and a dedicated registered project')
  if (!gate.enabled)
    return
  const target = gate.target
  await openCloudAudio(page, target)
  const beforeJobs = await readCloudJobs(page, target)
  let selection = { takeId: target.selectedTakeId!, assetId: target.selectedAssetId!, sha256: target.masterSha256! }
  let jobId: string | undefined
  if (target.generate) {
    const unresolved = beforeJobs.jobs.flatMap(job => job.tasks).filter(task => task.lineId === target.lineId && ['queued', 'running', 'unknown', 'generated'].includes(task.status))
    expect(unresolved, 'An unresolved existing attempt must be reconciled before a new charged cloud dispatch').toEqual([])
    const jobs = page.getByTestId('voice-jobs')
    await chooseCloudOption(page, jobs.getByRole('combobox', { name: /^(?:章节|Chapter)$/u }), target.chapterTitle!)
    await chooseCloudOption(page, jobs.getByRole('combobox', { name: /^(?:配音语言|Voice locale)$/u }), target.locale!)
    await chooseCloudOption(page, jobs.getByRole('combobox', { name: /^(?:已配置服务|Configured provider)$/u }), target.providerId!)
    const scope = jobs.getByRole('combobox', { name: /^(?:生成范围|Generation scope)$/u })
    await scope.click()
    await page.getByRole('option', { name: /^(?:仅缺少已选配音|Missing selected voice)$/u }).click()
    await jobs.getByLabel(/^(?:最大新增生成字数|Maximum new characters)$/u).fill(String(target.maxCharacters))
    await jobs.getByLabel(/^(?:同时生成数（1–32）|Concurrent requests \(1–32\))$/u).fill('1')
    await jobs.getByRole('checkbox').check()
    const reviewedResponse = hostedResponse(page, target, '/plan', 'POST')
    await jobs.getByRole('button', { name: /^(?:审核生成计划|Review generation plan)$/u }).click()
    const reviewed: HostedVoiceReviewedPlan = await (await reviewedResponse).json()
    // Fail before enqueue/dispatch when scope would bill a second line, hit an
    // old cache or use a different provider. No test retry or recovery re-synth.
    expect(reviewed.plan.summary.newGenerations).toBe(1)
    expect(reviewed.plan.summary.lines).toBe(1)
    expect(reviewed.plan.tasks.map(task => task.lineId)).toEqual([target.lineId])
    expect(reviewed.plan.tasks[0]?.providerId).toBe(target.providerId)
    const enqueueResponse = hostedResponse(page, target, '/enqueue', 'POST')
    await jobs.getByRole('button', { name: /^(?:确认并保存计划|Approve and save plan)$/u }).click()
    const enqueued: VoiceGenerationJob = await (await enqueueResponse).json()
    jobId = enqueued.id
    await writeFile(info.outputPath('cloud-dispatch-checkpoint.json'), JSON.stringify({ schemaVersion: 1, accountId: target.accountId, projectId: target.projectId, jobId, lineId: target.lineId, providerId: target.providerId, autoRetry: false }, null, 2))
    const receiptResponse = hostedResponse(page, target, `/jobs/${jobId}/receipts`, 'GET', 30 * 60_000)
    await jobs.locator(`[data-job-id="${jobId}"]`).getByRole('button', { name: /^(?:执行已确认计划|Run approved plan)$/u }).click()
    const receipt: HostedVoiceReceipts = await (await receiptResponse).json()
    expect(receipt.receipts).toHaveLength(1)
    expect(receipt.job.tasks[0]?.attempts).toBe(1)
    const take = receipt.receipts[0]!.take
    selection = { takeId: take.id, assetId: take.assetId, sha256: take.sha256 }
    await page.getByTestId('audio-workspace').getByRole('button', { name: /^(?:配音审核|Voice review)$/u }).click()
    const row = page.locator('.voice-review__line').filter({ has: page.locator('code', { hasText: target.lineId! }) })
    const candidate = row.locator('.voice-review__take').filter({ has: page.locator('code', { hasText: take.id }) })
    await expect(candidate).toBeVisible()
    expect(await candidate.evaluate(element => element.classList.contains('voice-review__take--selected'))).toBe(false)
    await candidate.getByRole('button', { name: /^(?:试听|Audition)$/u }).click()
    const audition = page.locator('.audio-workspace__preview audio')
    await expect(audition).toHaveAttribute('src', /^blob:/u)
    const audioProof = await audition.evaluate(async (element: HTMLAudioElement) => {
      const blob = await fetch(element.src).then(response => response.blob())
      if (blob.size > 64 * 1024 * 1024)
        throw new Error('STUDIO_CLOUD_AUDITION_LIMIT')
      const bytes = await blob.arrayBuffer()
      const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
      const context = new AudioContext()
      try {
        const decoded = await context.decodeAudioData(bytes.slice(0))
        const samples = decoded.getChannelData(0)
        let squares = 0
        let peak = 0
        for (const value of samples) {
          squares += value * value
          peak = Math.max(peak, Math.abs(value))
        }
        return { sha256: Array.from(hash, value => value.toString(16).padStart(2, '0')).join(''), bytes: bytes.byteLength, duration: decoded.duration, rms: Math.sqrt(squares / samples.length), peak }
      }
      finally { await context.close() }
    })
    expect(audioProof.sha256).toBe(take.sha256)
    expect(audioProof.rms).toBeGreaterThan(1e-4)
    await audition.click({ position: { x: 20, y: 20 } })
    await expect.poll(() => audition.evaluate((element: HTMLAudioElement) => element.paused)).toBe(false)
    await audition.evaluate((element: HTMLAudioElement) => element.pause())
    await writeFile(info.outputPath('cloud-audition-proof.json'), JSON.stringify(audioProof, null, 2))
    await candidate.getByRole('button', { name: /^(?:绑定此 take|Bind this take)$/u }).click()
    await expect(candidate).toHaveClass(/voice-review__take--selected/u)
  }
  else {
    // Check the exact operator-reviewed local selection before any sync/release
    // write; the browser cannot silently publish a different historical take.
    await page.getByTestId('audio-workspace').getByRole('button', { name: /^(?:配音审核|Voice review)$/u }).click()
    const selected = page.locator('.voice-review__take--selected').filter({ has: page.locator('code', { hasText: selection.takeId }) })
    await expect(selected).toBeVisible()
    await expect(selected.locator('code', { hasText: selection.assetId })).toHaveCount(1)
    await expect(selected.locator('code', { hasText: `SHA-256: ${selection.sha256}` })).toHaveCount(1)
  }
  const publication = page.getByTestId('audio-publication')
  await publication.getByRole('button', { name: /^(?:审核音频发布|Review audio release)$/u }).click()
  await expect(publication.getByTestId('audio-publication-review')).toBeVisible({ timeout: 15 * 60_000 })
  const publishedResponse = hostedResponse(page, target, '/releases/publish', 'POST', 120_000)
  await publication.getByRole('button', { name: /^(?:发布已审核音频|Publish reviewed audio)$/u }).click()
  const published: HostedAudioPublication = await (await publishedResponse).json()
  const proof = await verifyCloudPublication(target, published, selection)
  await page.reload()
  await openCloudAudio(page, target)
  const currentResponse = hostedResponse(page, target, '/releases/current')
  await page.getByTestId('audio-publication').getByRole('button', { name: /^(?:查询发布状态|Check publication)$/u }).click()
  expect(await (await currentResponse).json()).toEqual(published)
  await writeFile(info.outputPath('cloud-publish-proof.json'), JSON.stringify({ schemaVersion: 1, studioUrl: target.studioUrl, serviceUrl: target.serviceUrl, projectId: target.projectId, jobId, synthesisDispatchesByThisTest: target.generate ? 1 : 0, reloadedCurrentMatches: true, ...proof }, null, 2))
  if (target.player) {
    await page.goto(`${target.studioUrl}/tabs/workspace`)
    const downloading = page.waitForEvent('download')
    await page.getByRole('button', { name: /^(?:导出项目|Export Project)$/u }).click()
    const download = await downloading
    const archivePath = info.outputPath('cloud-native-project.advpkg.zip')
    await download.saveAs(archivePath)
    const { buildCloudStudioHandoff } = await import('../fixtures/cloud-audio/handoff')
    const handoff = await buildCloudStudioHandoff(await readFile(archivePath), published)
    let chromiumContext: BrowserContext | undefined
    let webkitBrowser: Browser | undefined
    try {
      // These two contexts have no CloudBase storageState or credentials. Only
      // the static player is local; every published audio byte comes from COS.
      chromiumContext = await page.context().browser()!.newContext()
      webkitBrowser = await webkit.launch()
      const chromiumPage = await chromiumContext.newPage()
      const webkitPage = await webkitBrowser.newPage()
      for (const [browser, player] of [['chromium', chromiumPage], ['webkit', webkitPage]] as const) {
        const directory = info.outputPath(`cloud-player-${browser}`)
        await mkdir(directory, { recursive: true })
        const playerInfo = { ...info, outputPath: (...segments: string[]) => info.outputPath(`cloud-player-${browser}`, ...segments) }
        const playerProof = await verifyStudioHandoffPlayer(player, playerInfo, { playerUrl: handoff.playerUrl, lineId: target.lineId!, text: target.lineText!, locale: target.locale, takeId: selection.takeId, assetId: selection.assetId, minimumRms: 1e-4, choiceLabel: target.choiceLabel!, branchText: target.branchText! })
        expect(playerProof.assetSha256).toBe(selection.sha256)
        await writeFile(info.outputPath(`cloud-player-${browser}/player-proof.json`), JSON.stringify({ schemaVersion: 1, ...playerProof, manifestUrl: published.manifestUrl, manifestSha256: published.revision, host: { staticPlayer: 'local', audio: target.mediaOrigin, cloudComputeVerifiedByThisBrowserTest: false }, root: handoff.root, build: handoff.build, check: handoff.check, nativeFiles: handoff.inventory }, null, 2))
      }
    }
    finally {
      await chromiumContext?.close()
      await webkitBrowser?.close()
      await handoff.close()
    }
  }
})
