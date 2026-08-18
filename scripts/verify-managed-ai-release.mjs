#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const EXPECTED_FIXTURE_SHA256 = '49e09a599a19c3c20e6e0afee1e3a6d9883cb0f77774302a150dab5c21477b86'
const TEXT_EXTENSIONS = new Set(['.css', '.html', '.js', '.json', '.map', '.mjs', '.txt'])
const requireBuilds = process.argv.includes('--require-builds')
const advjsRoot = resolve(process.env.ADVJS_REPO_ROOT || dirname(fileURLToPath(import.meta.url)), '..')
const yunlefunRoot = resolve(process.env.YUNLEFUN_REPO_ROOT || resolve(advjsRoot, '../../YunLeFun/www.yunle.fun'))
const apiRoot = resolve(process.env.YUNLEFUN_API_ROOT || resolve(advjsRoot, '../../YunLeFun/api'))
const adminRoot = resolve(process.env.YUNLEFUN_ADMIN_REPO_ROOT || resolve(advjsRoot, '../admin'))

const fixtures = [
  resolve(advjsRoot, 'packages/agent/src/contracts/fixtures/agent-runtime-v1.json'),
  resolve(yunlefunRoot, 'tests/fixtures/ai-runtime/agent-runtime-v1.json'),
  resolve(apiRoot, 'packages/ai-runtime-advjs/src/contracts/fixtures/agent-runtime-v1.json'),
  resolve(adminRoot, 'tests/fixtures/agent-runtime-v1.json'),
]

const buildRoots = [
  resolve(advjsRoot, 'apps/studio/dist'),
  resolve(apiRoot, 'services/ai-runtime/dist'),
  resolve(adminRoot, '.output/public'),
]

const actualSecretPatterns = [
  ['OpenAI-compatible secret', /\bsk-[\w-]{20,}\b/g],
  ['Tencent secret id', /\bAKID[A-Za-z0-9]{13,}\b/g],
  ['JWT-like bearer token', /\beyJ[\w-]{12,}\.[\w-]{12,}\.[\w-]{12,}\b/g],
  ['private key material', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
]

const forbiddenPublicBuildText = [
  'ByokDevAgentRuntime',
  'advjs-studio-ai-settings',
  'api.deepseek.com',
  'api.openai.com',
  'api.siliconflow.cn',
  'openrouter.ai/api',
  'sso-access-token-fixture',
  'provider-secret-fixture',
  'private streamed draft',
]

function fail(message) {
  throw new Error(message)
}

function sha256(content) {
  return createHash('sha256').update(content).digest('hex')
}

function listTextFiles(path) {
  if (!existsSync(path))
    return []
  if (!statSync(path).isDirectory())
    return TEXT_EXTENSIONS.has(extname(path)) ? [path] : []
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const child = resolve(path, entry.name)
    return entry.isDirectory() ? listTextFiles(child) : (TEXT_EXTENSIONS.has(extname(child)) ? [child] : [])
  })
}

function assertNoMatches(files, patterns) {
  const violations = []
  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    for (const [label, pattern] of patterns) {
      pattern.lastIndex = 0
      if (pattern.test(content))
        violations.push(`${file}: ${label}`)
    }
  }
  if (violations.length)
    fail(`Sensitive data scan failed:\n${violations.map(item => `- ${item}`).join('\n')}`)
}

for (const fixture of fixtures) {
  if (!existsSync(fixture))
    fail(`Shared contract fixture is missing: ${fixture}`)
}

const retiredRuntimeRoot = resolve(yunlefunRoot, 'services/advjs-ai-runtime')
if (existsSync(retiredRuntimeRoot))
  fail(`Retired www Runtime must remain absent: ${retiredRuntimeRoot}`)

const platformHandlerFile = resolve(apiRoot, 'services/ai-runtime/src/handler.ts')
const compatibilityFile = resolve(apiRoot, 'packages/ai-runtime-advjs/src/compatibility/v1.ts')
for (const file of [platformHandlerFile, compatibilityFile]) {
  if (!existsSync(file))
    fail(`Shared platform Runtime source is missing: ${file}`)
}
const platformHandler = readFileSync(platformHandlerFile, 'utf8')
const compatibility = readFileSync(compatibilityFile, 'utf8')
for (const route of ['\\/v1\\/tasks', 'cancel|events']) {
  if (!platformHandler.includes(route))
    fail(`Shared platform Runtime is missing the ADV.JS v1 route marker: ${route}`)
}
for (const marker of ['toV1Cursor', 'toV2Cursor', 'proposal.ready']) {
  if (!compatibility.includes(marker))
    fail(`ADV.JS compatibility adapter is missing: ${marker}`)
}

const fixtureBuffers = fixtures.map(file => readFileSync(file))
const fixtureHashes = fixtureBuffers.map(sha256)
if (!fixtureHashes.every(hash => hash === EXPECTED_FIXTURE_SHA256)) {
  fail([
    'Agent Runtime v1 fixture drift detected:',
    ...fixtures.map((file, index) => `- ${file}: ${fixtureHashes[index]}`),
  ].join('\n'))
}
if (!fixtureBuffers.every(buffer => buffer.equals(fixtureBuffers[0])))
  fail('Agent Runtime v1 fixtures are not byte-identical')

const fixtureText = fixtureBuffers[0].toString('utf8')
if (!fixtureText.includes('project_fixture_001') || !fixtureText.includes('task_fixture_001'))
  fail('Shared fixture must use the documented synthetic project and task id')
if (/\b1[3-9]\d{9}\b/.test(fixtureText) || /[\w.%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(fixtureText))
  fail('Shared fixture contains phone or email shaped PII')

const existingBuildRoots = buildRoots.filter(existsSync)
if (requireBuilds && existingBuildRoots.length !== buildRoots.length) {
  fail(`Build output is required but missing:\n${buildRoots.filter(path => !existsSync(path)).map(path => `- ${path}`).join('\n')}`)
}
const buildFiles = existingBuildRoots.flatMap(listTextFiles)
assertNoMatches([...fixtures, ...buildFiles], actualSecretPatterns)

const publicBuildViolations = []
for (const root of [buildRoots[0], buildRoots[2]].filter(existsSync)) {
  for (const file of listTextFiles(root)) {
    const content = readFileSync(file, 'utf8')
    for (const text of forbiddenPublicBuildText) {
      if (content.includes(text))
        publicBuildViolations.push(`${file}: ${text}`)
    }
  }
}
if (publicBuildViolations.length)
  fail(`Public build leakage scan failed:\n${publicBuildViolations.map(item => `- ${item}`).join('\n')}`)

console.log([
  'Managed AI release artifacts verified.',
  'runtime owner: YunLeFun/api services/ai-runtime',
  'legacy www Runtime retired: yes',
  `fixture sha256: ${EXPECTED_FIXTURE_SHA256}`,
  `build roots scanned: ${existingBuildRoots.length}/${buildRoots.length}`,
  `text build artifacts scanned: ${buildFiles.length}`,
  'network calls: 0',
  'cloud writes: 0',
].join('\n'))
