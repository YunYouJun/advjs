import type { AdvBuildResult } from '../commands/build'
import type { CheckResult } from '../commands/check'
import { Buffer } from 'node:buffer'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, relative, resolve } from 'node:path'
import process from 'node:process'
import {
  calculateContentRevision,
  createCanonicalContentManifest,
  serializeCanonicalContentManifest,
} from '../cli/contracts'
import { advBuild } from '../commands/build'
import { runCheck } from '../commands/check'
import { loadProject } from '../project'
import { pathExists } from '../utils/fs'
import { sha256 } from '../utils/hash'
import { createDeterministicTarGzip } from './archive'

export type DeployErrorCode = 'ADV_AUTH' | 'ADV_BUILD' | 'ADV_DEPLOY' | 'ADV_NETWORK' | 'ADV_VALIDATION'

export interface DeployProviderInput {
  artifactReceipt: ArtifactReceipt
  contentRevision: string
  directory: string
  previousConfig?: DeploymentConfig
  project: string
}

export interface DeployProviderResult {
  accountId?: string
  deploymentId: string
  projectId?: string
  url: string
  [key: string]: unknown
}

export interface DeployProvider {
  name: string
  deploy: (input: DeployProviderInput) => Promise<DeployProviderResult>
}

export interface DeploymentConfig {
  accountId?: string
  project: string
  projectId?: string
  provider: string
  schemaVersion: 1
}

export interface ArtifactReceipt extends DeploymentConfig {
  archive: string
  archiveSha256: string
  contentRevision: string
  manifestSha256: string
}

export interface DeploymentArtifact {
  archive: string
  archiveSha256: string
  artifactReceipt: string
  contentRevision: string
  manifestSha256: string
  receipt: ArtifactReceipt
}

export interface CreateDeploymentArtifactOptions {
  outDir: string
  project: string
  provider: string
  root: string
}

export interface DeployProjectOptions {
  buildProject?: (root: string) => Promise<AdvBuildResult>
  checkProject?: (root: string) => Promise<Pick<CheckResult, 'issues' | 'passed'>>
  project: string
  provider: DeployProvider
  root?: string
  verifyDeployment?: (url: string) => Promise<unknown>
}

export interface RecordDeploymentOptions {
  artifactReceipt: string
  artifactReceiptData: ArtifactReceipt
  providerResult: DeployProviderResult
  root: string
}

export class DeployProjectError extends Error {
  constructor(public code: DeployErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'DeployProjectError'
  }
}

function stableJson(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(stableJson)
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, child]) => [key, stableJson(child)]))
  return value
}

function serializeJson(value: unknown) {
  return `${JSON.stringify(stableJson(value), null, 2)}\n`
}

export async function writeImmutable(path: string, content: string | Uint8Array) {
  const next = typeof content === 'string' ? Buffer.from(content) : Buffer.from(content)
  if (await pathExists(path)) {
    const current = await readFile(path)
    if (!current.equals(next))
      throw new DeployProjectError('ADV_DEPLOY', `Immutable deployment artifact already exists with different content: ${path}`)
    return
  }
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, next, { flag: 'wx' })
}

async function collectBuildFiles(outDir: string) {
  const files: Array<{ bytes: number, content: Buffer, path: string, sha256: string }> = []
  async function walk(directory: string): Promise<void> {
    for (const entry of (await readdir(directory, { withFileTypes: true })).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolutePath = join(directory, entry.name)
      if (entry.isDirectory()) {
        await walk(absolutePath)
      }
      else if (entry.isFile()) {
        const content = await readFile(absolutePath)
        files.push({
          bytes: content.byteLength,
          content,
          path: relative(outDir, absolutePath).replaceAll('\\', '/'),
          sha256: sha256(content),
        })
      }
    }
  }
  await walk(outDir)
  return files
}

function extractAssetContract(files: Record<string, string>) {
  const assetPath = Object.keys(files).find(path => path === 'assets.json' || path.endsWith('/assets.json'))
  if (!assetPath)
    return { assetManifest: {}, projectFiles: Object.entries(files).map(([path, content]) => ({ path, content })), registeredAssets: [] }
  let assetManifest: unknown
  try {
    assetManifest = JSON.parse(files[assetPath])
  }
  catch (error) {
    throw new DeployProjectError('ADV_VALIDATION', `Invalid asset manifest: ${error instanceof Error ? error.message : String(error)}`)
  }
  const assets = assetManifest && typeof assetManifest === 'object' && Array.isArray((assetManifest as { assets?: unknown[] }).assets)
    ? (assetManifest as { assets: Array<Record<string, unknown>> }).assets
    : []
  const registeredAssets = assets.flatMap((asset) => {
    const path = typeof asset.path === 'string'
      ? asset.path
      : typeof asset.file === 'string'
        ? asset.file
        : typeof asset.objectKey === 'string'
          ? asset.objectKey
          : undefined
    return typeof asset.id === 'string' && typeof asset.sha256 === 'string' && path
      ? [{ id: asset.id, path, sha256: asset.sha256 }]
      : []
  })
  return {
    assetManifest,
    projectFiles: Object.entries(files).filter(([path]) => path !== assetPath).map(([path, content]) => ({ path, content })),
    registeredAssets,
  }
}

export function safeDeploymentId(deploymentId: string) {
  if (!deploymentId)
    throw new DeployProjectError('ADV_DEPLOY', 'Provider returned an empty deployment ID')
  return `id-${Buffer.from(deploymentId, 'utf8').toString('base64url')}`
}

export async function createDeploymentArtifact(options: CreateDeploymentArtifactOptions): Promise<DeploymentArtifact> {
  const root = resolve(options.root)
  const outDir = resolve(options.outDir)
  const loaded = await loadProject({ root })
  const revisionInput = extractAssetContract(loaded.files)
  const sourceManifest = createCanonicalContentManifest(revisionInput)
  const contentRevision = calculateContentRevision(revisionInput)
  const buildFiles = await collectBuildFiles(outDir)
  const releaseManifest = {
    schemaVersion: 1,
    contentRevision,
    sourceManifest,
    files: buildFiles.map(({ bytes, path, sha256 }) => ({ bytes, path, sha256 })),
  }
  const manifestContent = serializeJson(releaseManifest)
  const manifestSha256 = sha256(manifestContent)
  if (sha256(serializeCanonicalContentManifest(sourceManifest)) !== contentRevision)
    throw new DeployProjectError('ADV_DEPLOY', 'Canonical content revision verification failed')
  const archiveContent = createDeterministicTarGzip([
    { content: Buffer.from(manifestContent), path: '.advjs/release-manifest.json' },
    ...buildFiles.map(file => ({ content: file.content, path: `dist/${file.path}` })),
  ])
  const archiveSha256 = sha256(archiveContent)
  const releasesRoot = join(root, '.advjs/releases')
  const archive = join(releasesRoot, `${contentRevision}.tar.gz`)
  const artifactReceipt = join(releasesRoot, `${contentRevision}.release.json`)
  const receipt: ArtifactReceipt = {
    archive: relative(root, archive).replaceAll('\\', '/'),
    archiveSha256,
    contentRevision,
    manifestSha256,
    project: options.project,
    provider: options.provider,
    schemaVersion: 1,
  }
  await writeImmutable(archive, archiveContent)
  await writeImmutable(artifactReceipt, serializeJson(receipt))
  return { archive, archiveSha256, artifactReceipt, contentRevision, manifestSha256, receipt }
}

export function assertSafeProviderResult(result: DeployProviderResult) {
  const visit = (value: unknown, path = 'result'): void => {
    if (!value || typeof value !== 'object')
      return
    for (const [key, child] of Object.entries(value)) {
      if (/token|secret|password|credential/iu.test(key))
        throw new DeployProjectError('ADV_DEPLOY', `Provider returned sensitive state at ${path}.${key}`)
      visit(child, `${path}.${key}`)
    }
  }
  visit(result)
  if (!result.deploymentId)
    throw new DeployProjectError('ADV_DEPLOY', 'Provider returned no deployment ID')
  let url: URL
  try {
    url = new URL(result.url)
  }
  catch {
    throw new DeployProjectError('ADV_DEPLOY', 'Provider returned an invalid deployment URL')
  }
  if (url.protocol !== 'https:')
    throw new DeployProjectError('ADV_DEPLOY', 'Provider deployment URL must use HTTPS')
}

export async function readDeploymentConfig(root: string) {
  const path = join(root, '.advjs/deploy.json')
  if (!await pathExists(path))
    return undefined
  return JSON.parse(await readFile(path, 'utf8')) as DeploymentConfig
}

export async function recordDeployment(options: RecordDeploymentOptions) {
  const root = resolve(options.root)
  const providerResult = options.providerResult
  const artifact = options.artifactReceiptData
  assertSafeProviderResult(providerResult)

  const deploymentConfig: DeploymentConfig = {
    ...(providerResult.accountId ? { accountId: providerResult.accountId } : {}),
    project: artifact.project,
    ...(providerResult.projectId ? { projectId: providerResult.projectId } : {}),
    provider: artifact.provider,
    schemaVersion: 1,
  }
  await mkdir(join(root, '.advjs'), { recursive: true })
  await writeFile(join(root, '.advjs/deploy.json'), serializeJson(deploymentConfig), 'utf8')

  const artifactReceiptSha256 = sha256(await readFile(options.artifactReceipt))
  const deploymentReceipt = {
    ...deploymentConfig,
    artifactReceipt: relative(root, options.artifactReceipt).replaceAll('\\', '/'),
    artifactReceiptSha256,
    contentRevision: artifact.contentRevision,
    deployedAt: new Date().toISOString(),
    deploymentId: providerResult.deploymentId,
    projectId: providerResult.projectId,
    url: providerResult.url,
  }
  const receipt = join(root, '.advjs/deployments', `${artifact.contentRevision}.${safeDeploymentId(providerResult.deploymentId)}.deployment.json`)
  await writeImmutable(receipt, serializeJson(deploymentReceipt))

  return {
    contentRevision: artifact.contentRevision,
    deploymentId: providerResult.deploymentId,
    project: artifact.project,
    provider: artifact.provider,
    receipt,
    url: providerResult.url,
  }
}

export async function deployProject(options: DeployProjectOptions) {
  const root = resolve(options.root || process.cwd())
  const checkProject = options.checkProject || (async (projectRoot: string) => await runCheck({ cwd: projectRoot }))
  const buildProject = options.buildProject || (async (projectRoot: string) => await advBuild({ userRoot: projectRoot }))
  const checked = await checkProject(root)
  if (!checked.passed) {
    throw new DeployProjectError(
      'ADV_VALIDATION',
      `Project validation failed: ${checked.issues[0]?.message || 'unknown validation error'}`,
    )
  }

  let built: AdvBuildResult
  try {
    built = await buildProject(root)
  }
  catch (error) {
    throw new DeployProjectError('ADV_BUILD', error instanceof Error ? error.message : String(error), { cause: error })
  }

  const artifact = await createDeploymentArtifact({
    outDir: built.outDir,
    project: options.project,
    provider: options.provider.name,
    root,
  })
  const previousConfig = await readDeploymentConfig(root)
  let providerResult: DeployProviderResult
  try {
    providerResult = await options.provider.deploy({
      artifactReceipt: artifact.receipt,
      contentRevision: artifact.contentRevision,
      directory: built.outDir,
      previousConfig,
      project: options.project,
    })
  }
  catch (error) {
    if (error instanceof DeployProjectError)
      throw error
    const code = error instanceof Error && 'code' in error && ['ADV_AUTH', 'ADV_DEPLOY', 'ADV_NETWORK'].includes(String(error.code))
      ? error.code as 'ADV_AUTH' | 'ADV_DEPLOY' | 'ADV_NETWORK'
      : 'ADV_DEPLOY'
    throw new DeployProjectError(code, error instanceof Error ? error.message : String(error), { cause: error })
  }
  assertSafeProviderResult(providerResult)
  const verifyDeployment = options.verifyDeployment || (async (url: string) => {
    const { verifyDeploymentUrl } = await import('./verify')
    return await verifyDeploymentUrl({ url })
  })
  await verifyDeployment(providerResult.url)
  return await recordDeployment({
    artifactReceipt: artifact.artifactReceipt,
    artifactReceiptData: artifact.receipt,
    providerResult,
    root,
  })
}

export * from './archive'
export * from './cloudflare'
export * from './recovery'
export * from './secrets'
export * from './verify'
