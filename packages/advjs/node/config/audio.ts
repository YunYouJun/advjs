import type { AdvGameAudioConfig } from '@advjs/types'
import { createHash } from 'node:crypto'
import { readFile, realpath } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { createAdvAssetCatalog, normalizeAdvAssetManifest } from '@advjs/assets'
import { isRuntimeAudioAsset, parseAudioMixerConfig, parseVoiceLedger, projectRuntimeVoiceLedger, resolveRuntimeAudioAsset, runtimeAudioAssetIds } from '@advjs/audio'

async function readOptional(root: string, path: string) {
  try {
    const bound = relative(await realpath(root), await realpath(path))
    if (isAbsolute(bound) || bound === '..' || bound.startsWith('../'))
      throw new Error('ADV_AUDIO_CATALOG_INVALID: Audio document escapes project')
    return await readFile(path, 'utf8')
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      return undefined
    throw error
  }
}

/** Read the same canonical documents consumed by Editor and Studio previews. */
export async function loadProjectAudioConfig(root: string, runtimeAssetIds?: ReadonlySet<string>): Promise<AdvGameAudioConfig | undefined> {
  const manifestPath = resolve(root, 'adv/assets.json')
  const source = await readOptional(root, manifestPath)
  const mixer = await readOptional(root, resolve(root, 'adv/audio/mixer.json'))
  const ledger = await readOptional(root, resolve(root, 'adv/audio/voice-ledger.json'))
  if (!source && !mixer && !ledger)
    return undefined
  const audio: AdvGameAudioConfig = { assets: {}, locale: 'zh-CN' }
  if (ledger)
    audio.voiceLedger = projectRuntimeVoiceLedger(parseVoiceLedger(JSON.parse(ledger)))
  const selectedVoiceIds = runtimeAudioAssetIds(audio.voiceLedger)
  if (source) {
    const parsed = JSON.parse(source)
    if (parsed.includes) {
      const assets = []
      for (const include of parsed.includes as string[]) {
        if (include.startsWith('/') || include.split(/[\\/]/u).includes('..'))
          throw new Error('ADV_AUDIO_CATALOG_INVALID: Fragment escapes project')
        const fragmentSource = await readOptional(root, resolve(dirname(manifestPath), include))
        if (!fragmentSource)
          throw new Error('ADV_AUDIO_CATALOG_INVALID: Missing fragment')
        const fragment = JSON.parse(fragmentSource)
        if (fragment.schemaVersion !== 2 || !Array.isArray(fragment.assets))
          throw new Error('ADV_AUDIO_CATALOG_INVALID: Invalid fragment')
        assets.push(...fragment.assets)
      }
      delete parsed.includes
      parsed.assets = assets
    }
    const manifest = normalizeAdvAssetManifest(parsed)
    const catalog = createAdvAssetCatalog(manifest, { profile: manifest.profiles.local ? 'local' : undefined, adapter: {
      async resolve(asset) {
        if (asset.provider === 'http')
          return asset.baseUrl ? new URL(asset.location, asset.baseUrl).href : asset.location
        const path = relative(resolve(root, 'public'), resolve(root, asset.location)).replaceAll('\\', '/')
        if (path.startsWith('../'))
          throw new Error('ADV_AUDIO_PUBLIC_IMPORT_REQUIRED: Static module games require local audio under public/; canonical project builds can bundle other project paths')
        if (asset.asset.type === 'audio') {
          const source = asset.variant ? asset.asset.variants?.[asset.variant] : asset.asset
          if (asset.variant && (!source?.sha256 || !Number.isSafeInteger(source.bytes) || source.bytes! <= 0))
            throw new Error('ADV_AUDIO_VARIANT_IDENTITY_REQUIRED: Local processed audio requires its hash and byte count')
          if (source?.sha256 || source?.bytes !== undefined) {
            const target = await realpath(resolve(root, asset.location))
            const bound = relative(await realpath(root), target)
            if (isAbsolute(bound) || bound === '..' || bound.startsWith('../'))
              throw new Error('ADV_AUDIO_CATALOG_INVALID: Audio media escapes project')
            const bytes = await readFile(target)
            if ((source.sha256 && createHash('sha256').update(bytes).digest('hex') !== source.sha256) || (source.bytes !== undefined && bytes.byteLength !== source.bytes))
              throw new Error('ADV_AUDIO_MEDIA_CHANGED: Project media differs from its catalog')
          }
        }
        return `/${path}`
      },
    } })
    for (const asset of manifest.assets.filter(asset => isRuntimeAudioAsset(asset, selectedVoiceIds) && (!runtimeAssetIds || runtimeAssetIds.has(asset.id)))) {
      audio.assets[asset.id] = await resolveRuntimeAudioAsset(asset, async variant => (await catalog.resolve(asset.id, { variant })).src)
    }
  }
  if (mixer)
    audio.mixer = parseAudioMixerConfig(JSON.parse(mixer))
  return audio
}
