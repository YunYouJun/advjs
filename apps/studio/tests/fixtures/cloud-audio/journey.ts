import type { Locator, Page } from '@playwright/test'
import type { HostedAudioPublication, HostedVoiceJobsSnapshot } from '../../../../../packages/advjs/shared/hosted-audio'
import type { StudioCloudAudioTarget } from './config'
import { createHash } from 'node:crypto'
import { createAdvAssetCatalog, normalizeAdvAssetManifest } from '@advjs/assets'
import { expect } from '@playwright/test'
import { cloudAudioProjectUrl, cloudAudioUrl } from './config'

/** Observes the production client's request without inspecting its auth headers. */
export function hostedResponse(page: Page, target: StudioCloudAudioTarget, suffix: string, method = 'GET', timeout = 30_000) {
  const expected = `${cloudAudioProjectUrl(target)}${suffix}`
  return page.waitForResponse(response => response.url() === expected && response.request().method() === method, { timeout })
}

export async function openCloudAudio(page: Page, target: StudioCloudAudioTarget) {
  await page.goto(`${target.studioUrl}/tabs/workspace/audio`)
  await expect(page.getByTestId('audio-workspace')).toBeVisible()
  const inspectIdentity = () => page.evaluate(async () => {
    interface Store { userId?: string, isLoggedIn?: boolean, currentProjectId?: string }
    interface App { config: { globalProperties: { $pinia?: { _s: Map<string, Store> } } }, _context: { provides: Record<PropertyKey, unknown> } }
    const app = (document.querySelector('#app') as unknown as { __vue_app__?: App })?.__vue_app__
    const key = app && Reflect.ownKeys(app._context.provides).find(key => typeof key === 'symbol' && key.description === 'cloudbase:auth')
    const sdk = typeof key === 'symbol' ? app?._context.provides[key] as { getSession?: () => Promise<unknown> } | undefined : undefined
    if (!sdk?.getSession)
      throw new Error('STUDIO_CLOUD_SDK_UNAVAILABLE')
    let response: unknown
    try {
      response = await sdk.getSession()
    }
    catch {
      throw new Error('STUDIO_CLOUD_SESSION_FAILED')
    }
    // Only this finite summary leaves the browser. Never return a session,
    // access/refresh token, storageState, arbitrary SDK error or user metadata.
    const data = response && typeof response === 'object' && 'data' in response ? response.data : undefined
    const session = data && typeof data === 'object' && 'session' in data ? data.session : undefined
    const user = session && typeof session === 'object' && 'user' in session ? session.user : undefined
    const sdkUserId = user && typeof user === 'object' && 'id' in user && typeof user.id === 'string' ? user.id : undefined
    const authenticated = Boolean(session && typeof session === 'object' && 'access_token' in session && typeof session.access_token === 'string' && session.access_token)
    const auth = app?.config.globalProperties.$pinia?._s.get('auth')
    const studio = app?.config.globalProperties.$pinia?._s.get('studio')
    return { authenticated: authenticated && auth?.isLoggedIn === true && sdkUserId === auth.userId, accountId: auth?.userId, projectId: studio?.currentProjectId }
  })
  await expect.poll(inspectIdentity).toEqual({ authenticated: true, accountId: target.accountId, projectId: target.projectId })
  return inspectIdentity()
}

export async function readCloudJobs(page: Page, target: StudioCloudAudioTarget): Promise<HostedVoiceJobsSnapshot> {
  const response = hostedResponse(page, target, '/jobs')
  await page.getByTestId('audio-workspace').getByRole('button', { name: /^(?:配音任务|Voice jobs)$/u }).click()
  const result = await response
  expect(result.status()).toBe(200)
  const jobs: HostedVoiceJobsSnapshot = await result.json()
  expect(jobs.accountId).toBe(target.accountId)
  expect(jobs.projectId).toBe(target.projectId)
  return jobs
}

export async function chooseCloudOption(page: Page, control: Locator, label: string) {
  if (await control.evaluate(element => element.tagName === 'SELECT')) {
    await control.selectOption({ label })
    return
  }
  await control.click()
  await page.getByRole('option', { name: label, exact: true }).click()
}

async function limitedBytes(response: Response, limit: number) {
  if (!response.ok || !response.body)
    throw new Error('STUDIO_CLOUD_PUBLIC_MEDIA_UNAVAILABLE')
  const reader = response.body.getReader()
  const parts: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const item = await reader.read()
      if (item.done)
        break
      total += item.value.byteLength
      if (total > limit)
        throw new Error('STUDIO_CLOUD_PUBLIC_MEDIA_LIMIT')
      parts.push(item.value)
    }
  }
  finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    bytes.set(part, offset)
    offset += part.byteLength
  }
  return bytes
}

/** Genuine public COS bytes, pinned manifest hash, variants and selected identity. */
export async function verifyCloudPublication(target: StudioCloudAudioTarget, publication: HostedAudioPublication, selection: { takeId: string, assetId: string, sha256: string }) {
  const manifestUrl = cloudAudioUrl(publication.manifestUrl)
  expect(new URL(manifestUrl).origin).toBe(target.mediaOrigin)
  const response = await fetch(manifestUrl, { redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(30_000) })
  const bytes = await limitedBytes(response, 2 * 1024 * 1024)
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(publication.revision)
  const text = new TextDecoder().decode(bytes)
  for (const field of ['voiceProfile', 'spokenText', 'inputFingerprint', 'presetSha256', 'consentRecord', 'access_token', 'refresh_token', 'apiKey'])
    expect(text).not.toContain(`"${field}"`)
  for (const path of ['authoring/voices', 'authoring/rights', 'voice/samples', '.advjs/voice'])
    expect(text).not.toContain(path)
  const manifest = normalizeAdvAssetManifest(JSON.parse(text))
  expect(manifest.schemaVersion).toBe(2)
  expect(Object.values(manifest.profiles).every(profile => profile.provider === 'http' && !profile.root)).toBe(true)
  expect(manifest.assets.some(asset => asset.kind === 'reference')).toBe(false)
  const selected = manifest.assets.find(asset => asset.id === selection.assetId)
  expect(selected?.sha256).toBe(selection.sha256)
  expect(selected?.kind).toBe('voice')
  const catalog = createAdvAssetCatalog(manifest)
  const variants = []
  try {
    for (const asset of manifest.assets) {
      expect(Object.keys(asset.variants ?? {}).sort()).toEqual(['aac', 'opus'])
      for (const name of ['opus', 'aac']) {
        const variant = asset.variants![name]!
        expect(variant.path).toBeUndefined()
        expect(variant.objectKey).toBeTruthy()
        if (asset.id === selection.assetId)
          expect(variant.objectKey).toContain(selection.takeId)
        const resolved = await catalog.resolve(asset.id, { variant: name })
        const url = cloudAudioUrl(resolved.src)
        expect(new URL(url).origin).toBe(target.mediaOrigin)
        const result = await fetch(url, { redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(30_000), headers: { origin: new URL(target.studioUrl).origin } })
        const media = await limitedBytes(result, Math.min(variant.bytes ?? 0, 64 * 1024 * 1024))
        expect(media.byteLength).toBe(variant.bytes)
        expect(createHash('sha256').update(media).digest('hex')).toBe(variant.sha256)
        expect(result.headers.get('content-type')?.split(';')[0]).toBe(variant.mimeType)
        expect(['*', new URL(target.studioUrl).origin]).toContain(result.headers.get('access-control-allow-origin'))
        variants.push({ assetId: asset.id, variant: name, url, bytes: media.byteLength, sha256: variant.sha256, mimeType: variant.mimeType, publicCosRequestId: result.headers.get('x-cos-request-id') })
      }
    }
  }
  finally { catalog.dispose() }
  return { manifestUrl, revision: publication.revision, manifestObjectKey: publication.manifestObjectKey, selected: selection, assets: manifest.assets.length, variants }
}
