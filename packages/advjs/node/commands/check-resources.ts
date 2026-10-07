import type { AdvAssetManifest } from '@advjs/types'
import type { CheckIssue } from './check'
import { readFileSync, statSync } from 'node:fs'
import { createAdvAssetCatalog } from '@advjs/assets'
import { advNodeMap, mdParse } from '@advjs/parser'
import { dirname, relative, resolve } from 'pathe'

interface ResourceSource {
  file: string
  content: string
  data?: unknown
}

interface MarkdownNode {
  type: string
  url?: string
  value?: string
  lang?: string | null
  identifier?: string
  children?: MarkdownNode[]
  position?: { start: { line: number, column: number, offset?: number }, end: { offset?: number } }
}

const mediaKeys = new Set(['src', 'url', 'avatar', 'cover', 'favicon', 'thumbnail', 'poster'])
const mediaContainers = new Set(['characters', 'scenes', 'tachies', 'gallery', 'items', 'bgm', 'collection', 'library', 'assets', 'manifest', 'bundles', 'backgrounds', 'images', 'audios', 'videos', 'models'])
const dynamicReference = /\$\{|\{\{|%24%7B|%7B%7B/iu
const remoteReference = /^(?:https?:|data:|blob:|\/\/)/iu

function isFile(file: string): boolean {
  try {
    return statSync(file).isFile()
  }
  catch {
    return false
  }
}

/** Filesystem adapter for references already parsed by the Markdown/catalog parsers. */
export async function checkLocalResources(options: {
  cwd: string
  files: string[]
  games?: ResourceSource[]
  manifest?: AdvAssetManifest
  manifestFile?: string
  catalogSources?: ResourceSource[]
}): Promise<CheckIssue[]> {
  const issues: CheckIssue[] = []
  const seen = new Set<string>()
  const check = (value: string, source: ResourceSource, start = 0, mode: 'public' | 'markdown' | 'project' = 'public', resolvedPath?: string) => {
    if (!value || remoteReference.test(value) || value.startsWith('#'))
      return
    const index = source.content.indexOf(value, start)
    const offset = index < 0 ? start : index
    const before = source.content.slice(0, offset)
    const line = before.split('\n').length
    const column = offset - before.lastIndexOf('\n')
    const id = `${source.file}:${offset}:${value}:${resolvedPath ?? ''}`
    if (seen.has(id))
      return
    seen.add(id)
    const base = { category: 'resource' as const, file: relative(options.cwd, source.file), line, column }
    if (dynamicReference.test(value) || (/^[a-z][\w+.-]*:/iu.test(value) && !remoteReference.test(value))) {
      issues.push({
        ...base,
        code: 'ADV_STATIC_RESOURCE_UNCERTAIN',
        type: 'warning',
        certainty: 'uncertain',
        message: `Resource "${value}" requires runtime resolution.`,
        suggestion: 'Use a literal local URL or verify the host/provider that resolves this resource.',
      })
      return
    }
    let path: string
    try {
      path = mode === 'project' ? value : decodeURIComponent(value.split(/[?#]/u)[0])
    }
    catch {
      issues.push({ ...base, type: 'error', certainty: 'certain', code: 'ADV_STATIC_INVALID_RESOURCE_URL', message: `Resource URL has invalid percent encoding: ${value}`, suggestion: 'Correct the URL encoding or use the literal filename.' })
      return
    }
    const target = resolvedPath ?? (mode === 'project'
      ? resolve(options.cwd, path)
      : path.startsWith('/')
        ? resolve(options.cwd, 'public', `.${path}`)
        : resolve(mode === 'markdown' ? dirname(source.file) : resolve(options.cwd, 'public'), path))
    if (!isFile(target)) {
      issues.push({
        ...base,
        code: 'ADV_STATIC_MISSING_RESOURCE',
        type: 'error',
        certainty: 'certain',
        message: `Local resource "${value}" is missing (expected ${relative(options.cwd, target)}).`,
        suggestion: `Add the file at ${relative(options.cwd, target)} or correct this reference, including its filename case.`,
      })
    }
  }

  // Traverse known resource containers only. User variables/action payloads may
  // contain arbitrary strings named src/url and are not resource declarations.
  const inspect = (value: unknown, source: ResourceSource, start: number, container = false) => {
    if (Array.isArray(value)) {
      value.forEach(child => inspect(child, source, start, container))
      return
    }
    if (!value || typeof value !== 'object')
      return
    const record = value as Record<string, unknown>
    if (typeof record.type === 'string' && (record.type.includes('/') || ['actions', 'activity', 'when'].includes(record.type)))
      return
    for (const [key, child] of Object.entries(record)) {
      if (mediaKeys.has(key) && typeof child === 'string') {
        // Chapter sources have their own diagnostics.
        if (record.type !== 'fountain')
          check(child, source, start)
      }
      else if (key === 'name' && ['background', 'bgm'].includes(String(record.type)) && typeof child === 'string' && /[/.]/u.test(child)) {
        if (!options.manifest?.assets.some(asset => asset.id === child))
          check(child, source, start)
      }
      else if (key !== 'variables' && key !== 'actions' && key !== 'input' && (container || mediaContainers.has(key))) {
        inspect(child, source, start, true)
      }
    }
  }

  for (const file of [...new Set(options.files)].sort()) {
    const source = { file, content: readFileSync(file, 'utf8') }
    const ast = await mdParse(source.content)
    const definitions = new Map<string, string>()
    const gather = (node: MarkdownNode) => {
      if (node.type === 'definition' && node.identifier && node.url)
        definitions.set(node.identifier, node.url)
      node.children?.forEach(gather)
    }
    gather(ast)
    const visit = (node: MarkdownNode) => {
      const start = node.position?.start.offset ?? 0
      if (node.type === 'image' && node.url)
        check(node.url, source, start, 'markdown')
      if (node.type === 'imageReference' && node.identifier && definitions.has(node.identifier))
        check(definitions.get(node.identifier)!, source, start, 'markdown')
      if (node.type === 'yaml' || (node.type === 'code' && node.lang)) {
        const parser = advNodeMap.find(item => item.suffix.includes(node.type === 'yaml' ? 'yaml' : node.lang!.toLowerCase()))
        if (parser && node.value) {
          try {
            inspect(parser.parse(node.value), source, start)
          }
          catch {
            // Syntax diagnostics are emitted by the existing content compiler.
          }
        }
      }
      node.children?.forEach(visit)
    }
    visit(ast)
  }
  for (const game of options.games ?? []) {
    try {
      inspect(game.data ?? JSON.parse(game.content), game, 0)
    }
    catch {
      // Project compilation reports malformed settings.
    }
  }

  if (options.manifest && options.manifestFile) {
    const manifestSource = { file: options.manifestFile, content: readFileSync(options.manifestFile, 'utf8') }
    const catalog = createAdvAssetCatalog(options.manifest, { adapter: { resolve: request => request.location } })
    for (const asset of options.manifest.assets) {
      for (const [variant, location] of [[undefined, asset], ...Object.entries(asset.variants ?? {})] as const) {
        if (!location.path)
          continue
        const source = options.catalogSources?.find(item => item.content.includes(JSON.stringify(location.path))) ?? manifestSource
        const profiles = Object.entries(options.manifest.profiles).filter(([, profile]) => profile.provider === 'project')
        if (!profiles.length)
          check(location.path, source, 0, 'project')
        for (const [profile] of profiles) {
          const resolved = await catalog.resolve(asset.id, { profile, variant })
          check(location.path, source, 0, 'project', resolve(options.cwd, resolved.src))
        }
      }
    }
  }
  return issues
}
