import { sha256 } from '../utils/hash'

export const ADV_CLI_SCHEMA_VERSION = 1 as const

export const ADV_CLI_COMMANDS = [
  'init',
  'check',
  'build',
  'editor',
  'agent.install',
  'doctor',
  'deploy',
  'deploy.artifact',
] as const

export type AdvCliCommand = typeof ADV_CLI_COMMANDS[number]

export const ADV_ERROR_CODES = [
  'ADV_USAGE',
  'ADV_VALIDATION',
  'ADV_BUILD',
  'ADV_EDITOR',
  'ADV_AUTH',
  'ADV_DEPLOY',
  'ADV_NETWORK',
  'ADV_INTERNAL',
] as const

export type AdvErrorCode = typeof ADV_ERROR_CODES[number]

export const ADV_CONTENT_REVISION_SCHEMA_VERSION = 1 as const
export const ADV_CONTENT_REVISION_ALGORITHM = 'sha256' as const

export const ADV_NONDETERMINISTIC_FIELDS = [
  'createdAt',
  'updatedAt',
  'generatedAt',
  'builtAt',
  'deployedAt',
  'deploymentId',
  'deploymentUrl',
  'durationMs',
] as const

export const ADV_CRITICAL_DEPLOYMENT_RESOURCES = [
  'index.html',
  'html-referenced-js',
  'html-referenced-css',
  'build-manifest-entry-assets',
  'spa-fallback',
] as const

export interface ContentRevisionProjectFile {
  path: string
  content: string | Uint8Array
}

export interface ContentRevisionRegisteredAsset {
  id: string
  path: string
  sha256: string
}

export interface ContentRevisionInput {
  projectFiles: readonly ContentRevisionProjectFile[]
  assetManifest: unknown
  registeredAssets: readonly ContentRevisionRegisteredAsset[]
}

export interface CanonicalContentManifest {
  schemaVersion: typeof ADV_CONTENT_REVISION_SCHEMA_VERSION
  algorithm: typeof ADV_CONTENT_REVISION_ALGORITHM
  projectFiles: Array<{
    path: string
    sha256: string
  }>
  assetManifest: CanonicalJsonValue
  registeredAssets: ContentRevisionRegisteredAsset[]
}

type CanonicalJsonValue
  = | null
    | boolean
    | number
    | string
    | CanonicalJsonValue[]
    | { [key: string]: CanonicalJsonValue }

const WINDOWS_DRIVE_PATH_RE = /^[a-z]:\//iu
const SHA256_RE = /^[a-f0-9]{64}$/u
const nondeterministicFields = new Set<string>(ADV_NONDETERMINISTIC_FIELDS)

function compareText(left: string, right: string) {
  if (left < right)
    return -1
  if (left > right)
    return 1
  return 0
}

function normalizeContractPath(path: string) {
  const slashPath = path.replaceAll('\\', '/')
  if (slashPath.startsWith('/') || WINDOWS_DRIVE_PATH_RE.test(slashPath))
    throw new TypeError(`Content revision paths must be project-relative: ${path}`)

  const segments = slashPath.split('/').filter(segment => segment && segment !== '.')
  if (segments.length === 0 || segments.includes('..'))
    throw new TypeError(`Invalid content revision path: ${path}`)

  return segments.join('/')
}

function normalizeSha256(value: string) {
  const normalized = value.toLowerCase()
  if (!SHA256_RE.test(normalized))
    throw new TypeError(`Invalid SHA-256 digest: ${value}`)
  return normalized
}

function toCanonicalJson(value: unknown, omittedFields: ReadonlySet<string>): CanonicalJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return value

  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new TypeError('Canonical JSON only accepts finite numbers')
    return value
  }

  if (Array.isArray(value))
    return value.map(item => toCanonicalJson(item, omittedFields))

  if (typeof value === 'object') {
    const source = value as Record<string, unknown>
    const result: Record<string, CanonicalJsonValue> = {}
    for (const key of Object.keys(source).sort(compareText)) {
      if (!omittedFields.has(key))
        result[key] = toCanonicalJson(source[key], omittedFields)
    }
    return result
  }

  throw new TypeError(`Unsupported canonical JSON value: ${typeof value}`)
}

export function createCanonicalContentManifest(input: ContentRevisionInput): CanonicalContentManifest {
  const seenPaths = new Set<string>()
  const projectFiles = input.projectFiles
    .map((file) => {
      const path = normalizeContractPath(file.path)
      if (seenPaths.has(path))
        throw new TypeError(`Duplicate content revision path: ${path}`)
      seenPaths.add(path)
      return {
        path,
        sha256: sha256(file.content),
      }
    })
    .sort((left, right) => compareText(left.path, right.path))

  const registeredAssets = input.registeredAssets
    .map(asset => ({
      id: asset.id,
      path: normalizeContractPath(asset.path),
      sha256: normalizeSha256(asset.sha256),
    }))
    .sort((left, right) =>
      compareText(left.id, right.id)
      || compareText(left.path, right.path)
      || compareText(left.sha256, right.sha256),
    )

  return {
    schemaVersion: ADV_CONTENT_REVISION_SCHEMA_VERSION,
    algorithm: ADV_CONTENT_REVISION_ALGORITHM,
    projectFiles,
    assetManifest: toCanonicalJson(input.assetManifest, nondeterministicFields),
    registeredAssets,
  }
}

export function serializeCanonicalContentManifest(manifest: CanonicalContentManifest) {
  return JSON.stringify(toCanonicalJson(manifest, new Set()))
}

export function calculateContentRevision(input: ContentRevisionInput) {
  return sha256(serializeCanonicalContentManifest(createCanonicalContentManifest(input)))
}

export const ADV_LAUNCH_SUPPORT = {
  schemaVersion: 1,
  node: ['22.x', '24.x'],
  operatingSystems: [
    {
      name: 'ubuntu',
      tier: 'full',
      checks: ['launch-journey'],
    },
    {
      name: 'macos',
      tier: 'smoke',
      checks: ['packed-install', 'cli', 'editor-lifecycle', 'build'],
    },
    {
      name: 'windows',
      tier: 'smoke',
      checks: ['packed-install', 'cli', 'editor-lifecycle', 'build'],
    },
  ],
  packageManagers: [
    {
      name: 'npm',
      executors: ['npm', 'npx'],
    },
    {
      name: 'pnpm',
      version: '10.x',
      executors: ['pnpm', 'pnpm dlx'],
    },
  ],
  browsers: {
    supported: ['chromium-stable'],
    unsupported: ['firefox', 'safari'],
  },
  templates: ['default', 'galgame'],
  packages: {
    entrypoints: ['advjs', '@advjs/editor', '@advjs/mcp-server'],
    dependencyClosure: [
      '@advjs/client',
      '@advjs/core',
      '@advjs/devtools',
      '@advjs/gui',
      '@advjs/parser',
      '@advjs/theme-default',
      '@advjs/types',
      '@advjs/unocss',
    ],
  },
  skills: {
    default: ['adv-create', 'adv-debug', 'adv-review', 'adv-art'],
    optional: ['adv-story', 'adv-adapt'],
    repositoryOnly: ['adv-hamster-demo'],
  },
  agentClients: ['codex', 'claude-code', 'cursor'],
} as const

export interface AdvCliMessage {
  code: string
  message: string
  details?: Record<string, unknown>
}

export interface AdvCliError extends AdvCliMessage {
  code: AdvErrorCode
}

export interface AdvCliEnvelope<TCommand extends AdvCliCommand = AdvCliCommand, TData = unknown> {
  schemaVersion: typeof ADV_CLI_SCHEMA_VERSION
  command: TCommand
  ok: boolean
  data: TData | null
  warnings: AdvCliMessage[]
  errors: AdvCliError[]
}
