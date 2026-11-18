import type { AdvVoiceSynthesisRequest } from '@advjs/types'
import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { normalizeAdvAssetManifest } from '@advjs/assets'
import { audioProjectMediaPath } from '@advjs/audio'
import { projectFile } from './runtime'

export interface BreezeReference {
  assetId: string
  sha256: string
  text: string
}

async function json(root: string, path: string): Promise<Record<string, unknown>> {
  const file = await projectFile(root, path)
  if ((await stat(file)).size > 1024 * 1024)
    throw new Error('Breeze reference manifest exceeds the size limit')
  try {
    const value: unknown = JSON.parse(await readFile(file, 'utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('Expected a JSON object')
    return value as Record<string, unknown>
  }
  catch {
    throw new Error('Breeze reference manifest must contain a JSON object')
  }
}

/** Resolve only a registered native project reference; no arbitrary path or URL. */
export async function referenceBytes(request: AdvVoiceSynthesisRequest, reference: BreezeReference, characterId: string) {
  const manifestPath = await projectFile(request.root, request.assetManifestPath ?? 'adv/assets.json')
  const source = await json(request.root, manifestPath)
  if (source.schemaVersion !== 2 || (source.includes !== undefined && (!Array.isArray(source.includes) || source.assets !== undefined)))
    throw new Error('Breeze requires a native reference asset manifest')
  const assets: unknown[] = Array.isArray(source.assets) ? [...source.assets] : []
  for (const include of (source.includes as unknown[] | undefined) ?? []) {
    if (typeof include !== 'string' || isAbsolute(include) || include.includes('\\') || include.includes(':') || include.split('/').some(part => !part || ['.', '..', '.git', 'node_modules'].includes(part)))
      throw new Error('Invalid Breeze reference asset fragment path')
    const fragment = await json(request.root, resolve(dirname(manifestPath), include))
    if (fragment.schemaVersion !== 2 || !Array.isArray(fragment.assets))
      throw new Error('Invalid Breeze reference asset fragment')
    assets.push(...fragment.assets)
  }
  const { includes: _includes, ...base } = source
  const catalog = normalizeAdvAssetManifest({ ...base, assets })
  const matches = catalog.assets.filter(asset => asset.id === reference.assetId)
  const asset = matches[0]
  if (matches.length !== 1 || !asset || asset.type !== 'audio' || asset.kind !== 'reference' || asset.sha256 !== reference.sha256 || (asset.characterId !== undefined && asset.characterId !== characterId))
    throw new Error('Breeze reference is missing, changed, duplicated or belongs to another character')
  const file = await projectFile(request.root, audioProjectMediaPath(catalog, asset))
  if ((await stat(file)).size > 20 * 1024 * 1024)
    throw new Error('Breeze reference exceeds the 20 MiB size limit')
  const bytes = await readFile(file)
  if (!bytes.length || bytes.length > 20 * 1024 * 1024 || createHash('sha256').update(bytes).digest('hex') !== reference.sha256 || bytes.length !== asset.bytes)
    throw new Error('Breeze reference audio changed or has invalid metadata')
  request.signal?.throwIfAborted()
  return { bytes, mimeType: asset.mimeType ?? 'application/octet-stream', path: relative(request.root, file) }
}
