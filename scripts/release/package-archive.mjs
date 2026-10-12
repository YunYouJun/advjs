import { gunzipSync } from 'node:zlib'
import { LAUNCH_VERSION, PACKAGE_REPOSITORY } from './package-specs.mjs'

const PUBLIC_DEPENDENCY_FIELDS = ['dependencies', 'optionalDependencies', 'peerDependencies']
const FORBIDDEN_PACKED_SPEC = /^(?:workspace:|file:|link:)|(?:^|[/\\])node_modules(?:[/\\]|$)/u

export function validatePackageRepository(manifest) {
  const url = typeof manifest.repository === 'string' ? manifest.repository : manifest.repository?.url
  const repository = typeof url === 'string' ? url.replace(/^git\+/u, '').replace(/\/$/u, '').replace(/\.git$/u, '') : undefined
  if (repository !== PACKAGE_REPOSITORY)
    throw new Error(`${manifest.name} repository must match ${PACKAGE_REPOSITORY}`)
}

function parseTarSize(header) {
  const value = header.subarray(124, 136).toString('utf8').replace(/\0.*$/u, '').trim()
  return value ? Number.parseInt(value, 8) : 0
}

export function readTarEntries(tarball) {
  const archive = gunzipSync(tarball)
  const entries = new Map()
  let offset = 0

  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0))
      break
    const name = header.subarray(0, 100).toString('utf8').replace(/\0.*$/u, '')
    const prefix = header.subarray(345, 500).toString('utf8').replace(/\0.*$/u, '')
    const path = prefix ? `${prefix}/${name}` : name
    const size = parseTarSize(header)
    const bodyStart = offset + 512
    entries.set(path, archive.subarray(bodyStart, bodyStart + size))
    offset = bodyStart + Math.ceil(size / 512) * 512
  }

  return entries
}

export function inspectPackedTarball(tarball, spec) {
  const entries = readTarEntries(tarball)
  const packageJson = entries.get('package/package.json')
  if (!packageJson)
    throw new Error(`${spec.name} tarball does not contain package/package.json`)
  const manifest = JSON.parse(packageJson.toString('utf8'))

  if (manifest.name !== spec.name || manifest.version !== LAUNCH_VERSION)
    throw new Error(`${spec.name} tarball identity does not match the workspace manifest`)
  for (const file of spec.requiredFiles) {
    if (!entries.has(`package/${file}`))
      throw new Error(`${spec.name} tarball is missing required file ${file}`)
  }
  validatePackageRepository(manifest)
  for (const field of PUBLIC_DEPENDENCY_FIELDS) {
    for (const [dependency, version] of Object.entries(manifest[field] || {})) {
      if (typeof version !== 'string' || FORBIDDEN_PACKED_SPEC.test(version))
        throw new Error(`${spec.name} leaked non-registry dependency ${dependency}@${version}`)
    }
  }

  return { entries, manifest }
}
