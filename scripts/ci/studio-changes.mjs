import { execFile } from 'node:child_process'
import { appendFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

// The native Studio job runs on the macOS runner with simulators, so it only
// runs for changes that can alter its results.
const nativePrefixes = [
  'apps/studio-ios/',
  // Bundled into engine.js. The engine tests check that every bundled source matches.
  'packages/assets/',
  'packages/audio/',
  'packages/core/',
  'packages/parser/',
  'packages/types/',
  'plugins/plugin-interactions/',
  // Golden cases: the CLI project loader and the projects they read.
  'packages/advjs/',
  'demo/flow/',
  'demo/hamster/',
  'demo/starter/',
  'examples/ai-contest/',
  'tests/fixtures/diagnostics/',
  'tests/launch/fixtures/golden-project/',
  'patches/',
]
// Web Studio's unit tests also cover its own code and every workspace package it uses.
const studioPrefixes = ['apps/studio/', 'packages/', 'plugins/', 'themes/']
const sharedFiles = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.json',
  'scripts/prepare-workspace.mjs',
  'scripts/ci/studio-changes.mjs',
  'scripts/ci/launch-required.mjs',
  '.github/workflows/ci.yml',
])

export function affectsNativeStudio(path) {
  return sharedFiles.has(path) || nativePrefixes.some(prefix => path.startsWith(prefix))
}

export function affectsStudio(path) {
  return affectsNativeStudio(path) || studioPrefixes.some(prefix => path.startsWith(prefix))
}

/** Which Studio jobs a push or pull request needs: `{ studio, native }`. */
export async function studioChanges({ event, base, head, cwd = process.cwd(), run = execFileAsync }) {
  const all = { studio: true, native: true }
  if (event === 'workflow_dispatch')
    return all
  // A new branch has no prior commit to compare with.
  if (event === 'push' && /^0{40}$/u.test(base || ''))
    return all
  if (!/^[a-f\d]{40}$/u.test(base || '') || !/^[a-f\d]{40}$/u.test(head || ''))
    throw new Error('Studio change detection requires exact base and head commits')
  // The old side of a force push may no longer be reachable from the checkout.
  try {
    await run('git', ['cat-file', '-e', `${base}^{commit}`], { cwd })
  }
  catch {
    process.stderr.write('Studio base commit is unavailable; running every Studio check.\n')
    return all
  }
  // PRs compare against their merge base; pushes compare the complete pushed range.
  const range = event === 'pull_request' ? `${base}...${head}` : `${base}..${head}`
  const { stdout } = await run('git', ['diff', '--name-only', '--no-renames', '-z', range], { cwd, maxBuffer: 10 * 1024 * 1024 })
  const paths = stdout.split('\0').filter(Boolean)
  return { studio: paths.some(affectsStudio), native: paths.some(affectsNativeStudio) }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const changes = await studioChanges({ event: process.env.STUDIO_EVENT, base: process.env.STUDIO_BASE_SHA, head: process.env.STUDIO_HEAD_SHA })
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, `studio=${changes.studio}\nnative=${changes.native}\n`)
  process.stdout.write(`Studio changes: ${changes.studio}; native Studio changes: ${changes.native}\n`)
}
