import type { Buffer } from 'node:buffer'
import type { CanonicalContentManifest } from '../cli/contracts'
import type { ArtifactReceipt, DeployProvider } from './index'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { serializeCanonicalContentManifest } from '../cli/contracts'
import { readTarGzip } from './archive'
import {
  assertSafeProviderResult,
  DeployProjectError,
  readDeploymentConfig,
  recordDeployment,
  writeImmutable,
} from './index'

interface ReleaseManifestFile {
  bytes: number
  path: string
  sha256: string
}

interface ReleaseManifest {
  contentRevision: string
  files: ReleaseManifestFile[]
  schemaVersion: 1
  sourceManifest: CanonicalContentManifest
}

export interface VerifyDeploymentArtifactOptions {
  archive: string
  receipt: string
}

export interface VerifiedDeploymentArtifact {
  archive: string
  archiveSha256: string
  contentRevision: string
  files: Array<ReleaseManifestFile & { content: Buffer }>
  receipt: ArtifactReceipt
  receiptPath: string
}

export interface DeployArtifactOptions extends VerifyDeploymentArtifactOptions {
  provider: DeployProvider
  root?: string
  verifyDeployment?: (url: string) => Promise<unknown>
}

const SHA256_RE = /^[a-f0-9]{64}$/u

function sha256(content: string | Uint8Array) {
  return createHash('sha256').update(content).digest('hex')
}

function validationError(message: string, cause?: unknown) {
  return new DeployProjectError('ADV_VALIDATION', message, cause === undefined ? undefined : { cause })
}

function parseArtifactReceipt(content: string): ArtifactReceipt {
  let value: unknown
  try {
    value = JSON.parse(content)
  }
  catch (error) {
    throw validationError('Artifact receipt is not valid JSON', error)
  }
  if (!value || typeof value !== 'object')
    throw validationError('Artifact receipt must be an object')
  const receipt = value as Partial<ArtifactReceipt>
  if (
    receipt.schemaVersion !== 1
    || typeof receipt.project !== 'string' || !receipt.project
    || typeof receipt.provider !== 'string' || !receipt.provider
    || typeof receipt.archive !== 'string' || !receipt.archive
    || typeof receipt.archiveSha256 !== 'string' || !SHA256_RE.test(receipt.archiveSha256)
    || typeof receipt.contentRevision !== 'string' || !SHA256_RE.test(receipt.contentRevision)
    || typeof receipt.manifestSha256 !== 'string' || !SHA256_RE.test(receipt.manifestSha256)
  ) {
    throw validationError('Artifact receipt does not match schema version 1')
  }
  return receipt as ArtifactReceipt
}

function parseReleaseManifest(content: Buffer): ReleaseManifest {
  let value: unknown
  try {
    value = JSON.parse(content.toString('utf8'))
  }
  catch (error) {
    throw validationError('Release manifest is not valid JSON', error)
  }
  if (!value || typeof value !== 'object')
    throw validationError('Release manifest must be an object')
  const manifest = value as Partial<ReleaseManifest>
  if (manifest.schemaVersion !== 1 || typeof manifest.contentRevision !== 'string' || !Array.isArray(manifest.files) || !manifest.sourceManifest)
    throw validationError('Release manifest does not match schema version 1')
  return manifest as ReleaseManifest
}

export async function verifyDeploymentArtifact(options: VerifyDeploymentArtifactOptions): Promise<VerifiedDeploymentArtifact> {
  const archive = resolve(options.archive)
  const receiptPath = resolve(options.receipt)
  const receiptContent = await readFile(receiptPath, 'utf8').catch((error) => {
    throw validationError('Could not read artifact receipt', error)
  })
  const receipt = parseArtifactReceipt(receiptContent)
  const archiveContent = await readFile(archive).catch((error) => {
    throw validationError('Could not read deployment archive', error)
  })
  const archiveSha256 = sha256(archiveContent)
  if (archiveSha256 !== receipt.archiveSha256)
    throw validationError('Deployment archive SHA-256 does not match the artifact receipt')

  let entries
  try {
    entries = readTarGzip(archiveContent)
  }
  catch (error) {
    throw validationError(`Deployment archive is invalid: ${error instanceof Error ? error.message : String(error)}`, error)
  }
  const entryMap = new Map(entries.map(entry => [entry.path, entry.content]))
  const manifestContent = entryMap.get('.advjs/release-manifest.json')
  if (!manifestContent)
    throw validationError('Deployment archive contains no release manifest')
  if (sha256(manifestContent) !== receipt.manifestSha256)
    throw validationError('Release manifest SHA-256 does not match the artifact receipt')
  const manifest = parseReleaseManifest(manifestContent)
  if (manifest.contentRevision !== receipt.contentRevision)
    throw validationError('Release manifest content revision does not match the artifact receipt')
  if (sha256(serializeCanonicalContentManifest(manifest.sourceManifest)) !== receipt.contentRevision)
    throw validationError('Release manifest canonical source does not match its content revision')

  const seen = new Set<string>()
  const files = manifest.files.map((file) => {
    if (
      !file || typeof file.path !== 'string' || !file.path
      || typeof file.bytes !== 'number' || !Number.isSafeInteger(file.bytes) || file.bytes < 0
      || typeof file.sha256 !== 'string' || !SHA256_RE.test(file.sha256)
      || seen.has(file.path)
    ) {
      throw validationError('Release manifest contains an invalid or duplicate file record')
    }
    seen.add(file.path)
    const content = entryMap.get(`dist/${file.path}`)
    if (!content)
      throw validationError(`Deployment archive is missing dist/${file.path}`)
    if (content.byteLength !== file.bytes || sha256(content) !== file.sha256)
      throw validationError(`Deployment archive file does not match its manifest: ${file.path}`)
    return { ...file, content }
  })
  if (entries.length !== files.length + 1)
    throw validationError('Deployment archive contains files that are not declared in the release manifest')

  return {
    archive,
    archiveSha256,
    contentRevision: receipt.contentRevision,
    files,
    receipt,
    receiptPath,
  }
}

export async function deployArtifact(options: DeployArtifactOptions) {
  const root = resolve(options.root || process.cwd())
  const artifact = await verifyDeploymentArtifact(options)
  if (artifact.receipt.provider !== options.provider.name)
    throw validationError(`Artifact receipt requires provider ${artifact.receipt.provider}, not ${options.provider.name}`)

  const canonicalReleasesRoot = join(root, '.advjs/releases')
  const canonicalArchive = join(canonicalReleasesRoot, `${artifact.contentRevision}.tar.gz`)
  const canonicalReceipt = join(canonicalReleasesRoot, `${artifact.contentRevision}.release.json`)
  await writeImmutable(canonicalArchive, await readFile(artifact.archive))
  await writeImmutable(canonicalReceipt, await readFile(artifact.receiptPath))

  const extractionRoot = await mkdtemp(join(tmpdir(), 'advjs-deploy-recovery-'))
  try {
    for (const file of artifact.files) {
      const destination = join(extractionRoot, file.path)
      await mkdir(dirname(destination), { recursive: true })
      await writeFile(destination, file.content, { flag: 'wx' })
    }
    const previousConfig = await readDeploymentConfig(root)
    let providerResult
    try {
      providerResult = await options.provider.deploy({
        artifactReceipt: artifact.receipt,
        contentRevision: artifact.contentRevision,
        directory: extractionRoot,
        previousConfig,
        project: artifact.receipt.project,
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
    const deployment = await recordDeployment({
      artifactReceipt: canonicalReceipt,
      artifactReceiptData: artifact.receipt,
      providerResult,
      root,
    })
    return {
      ...deployment,
      archiveSha256: artifact.archiveSha256,
      artifactReceipt: canonicalReceipt,
    }
  }
  finally {
    await rm(extractionRoot, { force: true, recursive: true })
  }
}
