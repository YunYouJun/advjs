export interface StudioCloudAudioTarget {
  studioUrl: string
  serviceUrl: string
  projectId: string
  accountId: string
  storageState: string
  publish: boolean
  generate: boolean
  mediaOrigin?: string
  chapterTitle?: string
  lineId?: string
  locale?: string
  providerId?: string
  maxCharacters: number
  selectedTakeId?: string
  selectedAssetId?: string
  masterSha256?: string
  player: boolean
  lineText?: string
  choiceLabel?: string
  branchText?: string
}

export type StudioCloudAudioGate = { enabled: false, reason: string } | { enabled: true, target: StudioCloudAudioTarget }

/** This gate describes a remote deployment, never a localhost/tunnel simulation. */
export function cloudAudioUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  }
  catch {
    throw new Error('STUDIO_CLOUD_URL_INVALID')
  }
  const host = url.hostname.toLowerCase()
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash
    || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')
    || host.startsWith('[') || /^\d+(?:\.\d+){3}$/u.test(host)
    || ['trycloudflare.com', 'ngrok.io', 'ngrok-free.app', 'loca.lt'].some(domain => host === domain || host.endsWith(`.${domain}`))) {
    throw new Error('STUDIO_CLOUD_URL_INVALID')
  }
  return url.toString().replace(/\/$/u, '')
}

/** No credentials are read here: operator supplies an opaque private state-file path. */
export function readStudioCloudAudioGate(environment: Record<string, string | undefined>): StudioCloudAudioGate {
  if (environment.ADVJS_STUDIO_CLOUD_E2E !== '1')
    return { enabled: false, reason: 'Real cloud audio acceptance is opt-in (ADVJS_STUDIO_CLOUD_E2E=1)' }
  const required = ['ADVJS_STUDIO_CLOUD_URL', 'ADVJS_STUDIO_CLOUD_AUDIO_URL', 'ADVJS_STUDIO_CLOUD_PROJECT_ID', 'ADVJS_STUDIO_CLOUD_ACCOUNT_ID', 'ADVJS_STUDIO_CLOUD_STORAGE_STATE'] as const
  const missing = required.filter(key => !environment[key]?.trim())
  if (missing.length)
    return { enabled: false, reason: `Missing operator configuration: ${missing.join(', ')}` }
  const projectId = environment.ADVJS_STUDIO_CLOUD_PROJECT_ID!
  const accountId = environment.ADVJS_STUDIO_CLOUD_ACCOUNT_ID!
  if (!/^[\w.:-]{1,128}$/u.test(projectId) || !accountId.trim() || accountId.length > 256)
    throw new Error('STUDIO_CLOUD_SCOPE_INVALID')
  const publish = environment.ADVJS_STUDIO_CLOUD_WRITE === '1'
  const generate = environment.ADVJS_STUDIO_CLOUD_GENERATE === '1'
  if (generate && !publish)
    throw new Error('STUDIO_CLOUD_WRITE_REQUIRED')
  const mediaOrigin = environment.ADVJS_STUDIO_CLOUD_MEDIA_ORIGIN && cloudAudioUrl(environment.ADVJS_STUDIO_CLOUD_MEDIA_ORIGIN)
  if (publish && !mediaOrigin)
    throw new Error('STUDIO_CLOUD_MEDIA_ORIGIN_REQUIRED')
  const maxCharacters = Number(environment.ADVJS_STUDIO_CLOUD_MAX_CHARACTERS ?? '100')
  if (!Number.isSafeInteger(maxCharacters) || maxCharacters < 1 || maxCharacters > 5000)
    throw new Error('STUDIO_CLOUD_BUDGET_INVALID')
  const lineId = environment.ADVJS_STUDIO_CLOUD_LINE_ID
  if (lineId && !/^line_[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u.test(lineId))
    throw new Error('STUDIO_CLOUD_LINE_INVALID')
  if (generate && (!lineId || !environment.ADVJS_STUDIO_CLOUD_CHAPTER_TITLE || !environment.ADVJS_STUDIO_CLOUD_LOCALE || !environment.ADVJS_STUDIO_CLOUD_PROVIDER_ID))
    throw new Error('STUDIO_CLOUD_GENERATION_TARGET_REQUIRED')
  const selectedTakeId = environment.ADVJS_STUDIO_CLOUD_SELECTED_TAKE_ID
  const selectedAssetId = environment.ADVJS_STUDIO_CLOUD_SELECTED_ASSET_ID
  const masterSha256 = environment.ADVJS_STUDIO_CLOUD_MASTER_SHA256
  const uuid = '[a-f0-9]{8}-[a-f0-9]{4}-7[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}'
  if (publish && !generate && (!new RegExp(`^take_${uuid}$`, 'u').test(selectedTakeId ?? '') || !new RegExp(`^audio_${uuid}$`, 'u').test(selectedAssetId ?? '') || !/^[a-f0-9]{64}$/u.test(masterSha256 ?? '')))
    throw new Error('STUDIO_CLOUD_SELECTED_IDENTITY_REQUIRED')
  const player = environment.ADVJS_STUDIO_CLOUD_PLAYER === '1'
  if (player && (!publish || !lineId || !environment.ADVJS_STUDIO_CLOUD_LOCALE || !environment.ADVJS_STUDIO_CLOUD_LINE_TEXT || !environment.ADVJS_STUDIO_CLOUD_CHOICE_LABEL || !environment.ADVJS_STUDIO_CLOUD_BRANCH_TEXT))
    throw new Error('STUDIO_CLOUD_PLAYER_TARGET_REQUIRED')
  return { enabled: true, target: {
    studioUrl: cloudAudioUrl(environment.ADVJS_STUDIO_CLOUD_URL!),
    serviceUrl: cloudAudioUrl(environment.ADVJS_STUDIO_CLOUD_AUDIO_URL!),
    projectId,
    accountId,
    storageState: environment.ADVJS_STUDIO_CLOUD_STORAGE_STATE!,
    publish,
    generate,
    mediaOrigin: mediaOrigin && new URL(mediaOrigin).origin,
    chapterTitle: environment.ADVJS_STUDIO_CLOUD_CHAPTER_TITLE,
    lineId,
    locale: environment.ADVJS_STUDIO_CLOUD_LOCALE,
    providerId: environment.ADVJS_STUDIO_CLOUD_PROVIDER_ID,
    maxCharacters,
    selectedTakeId,
    selectedAssetId,
    masterSha256,
    player,
    lineText: environment.ADVJS_STUDIO_CLOUD_LINE_TEXT,
    choiceLabel: environment.ADVJS_STUDIO_CLOUD_CHOICE_LABEL,
    branchText: environment.ADVJS_STUDIO_CLOUD_BRANCH_TEXT,
  } }
}

export function cloudAudioProjectUrl(target: StudioCloudAudioTarget) {
  return `${target.serviceUrl}/v1/audio/projects/${encodeURIComponent(target.projectId)}`
}
