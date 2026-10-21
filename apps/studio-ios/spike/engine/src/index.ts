/**
 * SPIKE (P0 feasibility only, not production code).
 *
 * A headless ADV.JS engine facade for JavaScriptCore. Every operation takes a
 * JSON string and resolves to a JSON string so the Swift host never calls
 * engine internals. The production engine package is built in P1 from shared
 * modules; this spike imports the current sources directly to measure them.
 *
 * `host-prelude.ts` is prepended by `build.ts` as a banner so Web API shims
 * exist before any bundled module evaluates, regardless of import order.
 */
import type { AdvAssetManifest, AdvCharacter, AdvGameConfig, AdvProjectCompileOptions, AdvProjectFileMap } from '@advjs/types'
import type { ProjectSourcePatch } from '../../../../../packages/core/src/project/serialize'
import { normalizeAdvAssetManifest } from '@advjs/assets'
import { parseAst, parseCharacterMd, stringifyCharacterMd } from '@advjs/parser'
import { compileProject } from '../../../../../packages/core/src/project/compile'
import { createProjectGameConfig } from '../../../../../packages/core/src/project/runtime-config'
import { applyProjectPatches } from '../../../../../packages/core/src/project/serialize'
import { parseAudioMd, stringifyAudioMd } from '../../../../studio/src/utils/audioMd'
import { parseChapterMd, stringifyChapterMd } from '../../../../studio/src/utils/chapterMd'
import { parseLocationMd, stringifyLocationMd } from '../../../../studio/src/utils/locationMd'
import { parseSceneMd, stringifySceneMd } from '../../../../studio/src/utils/sceneMd'

export const ENGINE_API_VERSION = 0

type ContentType = 'audio' | 'chapter' | 'character' | 'location' | 'scene'

interface EngineError {
  code: string
  message: string
}

type EngineResponse
  = | { ok: true, apiVersion: number, result: unknown }
    | { ok: false, apiVersion: number, error: EngineError }

const operations: Record<string, (input: any) => unknown> = {
  'engine.info': () => ({
    apiVersion: ENGINE_API_VERSION,
    operations: Object.keys(operations).sort(),
    hasIntl: typeof Intl !== 'undefined',
    hasTextEncoder: typeof TextEncoder !== 'undefined',
  }),
  'project.compile': (input: { files: AdvProjectFileMap, options?: AdvProjectCompileOptions }) =>
    compileProject({ files: input.files }, input.options ?? {}),
  'project.playerConfig': async (input: { files: AdvProjectFileMap, options?: AdvProjectCompileOptions, baseUrl: string }) => {
    const compilation = await compileProject({ files: input.files }, input.options ?? {})
    if (compilation.diagnostics.some(item => item.severity === 'error'))
      return { diagnostics: compilation.diagnostics }
    return {
      diagnostics: compilation.diagnostics,
      gameConfig: resolvePlayerUrls(createProjectGameConfig(compilation, input.files), compilation.project.assets, input.baseUrl),
    }
  },
  'project.applyPatches': (input: { files: AdvProjectFileMap, patches: ProjectSourcePatch[] }) =>
    applyProjectPatches(input.files, input.patches),
  'chapter.parseAst': (input: { content: string, glossary?: string }) =>
    parseAst(input.content, input.glossary ?? ''),
  'content.parse': (input: { type: ContentType, content: string, filename?: string }) => {
    switch (input.type) {
      case 'audio': return parseAudioMd(input.content)
      case 'chapter': return parseChapterMd(input.content, input.filename ?? 'chapter.adv.md')
      case 'character': return parseCharacterMd(input.content)
      case 'location': return parseLocationMd(input.content)
      case 'scene': return parseSceneMd(input.content)
    }
    throw new EngineFailure('ENGINE_UNKNOWN_CONTENT_TYPE', `Unknown content type: ${String(input.type)}`)
  },
  'content.stringify': (input: { type: ContentType, data: any }) => {
    switch (input.type) {
      case 'audio': return stringifyAudioMd(input.data)
      case 'chapter': return stringifyChapterMd(input.data)
      case 'character': return stringifyCharacterMd(input.data as AdvCharacter)
      case 'location': return stringifyLocationMd(input.data)
      case 'scene': return stringifySceneMd(input.data)
    }
    throw new EngineFailure('ENGINE_UNKNOWN_CONTENT_TYPE', `Unknown content type: ${String(input.type)}`)
  },
  'host.digest': async (input: { text: string }) => {
    const bytes = new TextEncoder().encode(input.text)
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
    return {
      byteLength: bytes.byteLength,
      sha256: Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join(''),
      roundTrip: new TextDecoder().decode(bytes),
      clone: structuredClone({ list: [1, 'two', { three: null }], nested: { when: 'now' } }),
    }
  },
  'assets.normalizeManifest': (input: { manifest: unknown, allowEmpty?: boolean }) =>
    normalizeAdvAssetManifest(input.manifest, { allowEmpty: input.allowEmpty }),
}

const ABSOLUTE_URL = /^(?:https?:|data:|blob:)/u

/**
 * SPIKE: maps project-relative media paths onto the player's read-only scheme.
 * JavaScriptCore has no `URL`, so paths are joined as normalized strings.
 */
function resolvePlayerUrls(gameConfig: AdvGameConfig, manifest: AdvAssetManifest | undefined, baseUrl: string): AdvGameConfig {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const toUrl = (path: string) => ABSOLUTE_URL.test(path) || !path ? path : `${base}${path.replace(/^\.?\//u, '')}`
  const profile = manifest?.profiles[manifest.defaultProfile ?? '']
  const assetRoot = profile?.provider === 'project' ? (profile.root ?? '').replace(/^\.?\/|\/$/gu, '') : ''
  const audioUrl = (path: string) => ABSOLUTE_URL.test(path) ? path : toUrl(assetRoot ? `${assetRoot}/${path}` : path)
  return {
    ...gameConfig,
    characters: gameConfig.characters.map(character => ({
      ...character,
      ...(character.avatar ? { avatar: toUrl(character.avatar) } : {}),
      tachies: Object.fromEntries(Object.entries(character.tachies ?? {}).map(([status, tachie]) => [status, { ...tachie, src: toUrl(tachie.src) }])),
    })),
    scenes: gameConfig.scenes.map(scene => scene.type === 'image' ? { ...scene, src: toUrl(scene.src) } : scene),
    audio: gameConfig.audio && {
      ...gameConfig.audio,
      assets: Object.fromEntries(Object.entries(gameConfig.audio.assets).map(([id, asset]) => [id, {
        ...asset,
        src: audioUrl(asset.src),
        ...(asset.variants
          ? { variants: Object.fromEntries(Object.entries(asset.variants).map(([name, variant]) => [name, variant && { ...variant, src: audioUrl(variant.src) }])) }
          : {}),
      }])),
    },
  }
}

class EngineFailure extends Error {
  constructor(public code: string, message: string) {
    super(message)
  }
}

function failure(error: unknown): EngineResponse {
  if (error instanceof EngineFailure)
    return { ok: false, apiVersion: ENGINE_API_VERSION, error: { code: error.code, message: error.message } }
  return {
    ok: false,
    apiVersion: ENGINE_API_VERSION,
    error: {
      code: 'ENGINE_OPERATION_FAILED',
      message: error instanceof Error ? error.message : String(error),
    },
  }
}

/** The only entry point the native host calls. */
export async function call(operation: string, inputJson: string): Promise<string> {
  let response: EngineResponse
  try {
    const handler = operations[operation]
    if (!handler)
      throw new EngineFailure('ENGINE_UNKNOWN_OPERATION', `Unknown operation: ${operation}`)
    const input: unknown = JSON.parse(inputJson)
    // Runtime exception text differs between V8 and JavaScriptCore; reject bad
    // shapes with a stable code instead of leaking engine-specific messages.
    if (!input || typeof input !== 'object' || Array.isArray(input))
      throw new EngineFailure('ENGINE_INVALID_INPUT', `${operation} expects a JSON object`)
    const result = await handler(input)
    response = { ok: true, apiVersion: ENGINE_API_VERSION, result }
  }
  catch (error) {
    response = failure(error)
  }
  return JSON.stringify(response)
}
