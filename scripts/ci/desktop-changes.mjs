import { execFile } from 'node:child_process'
import { appendFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const prefixes = [
  'apps/desktop/',
  'editor/',
  'packages/',
  'plugins/',
  'themes/',
  'patches/',
  'demo/starter/',
  'tests/unit/desktop/',
  'tests/launch/fixtures/golden-project/',
]
const files = new Set([
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'uno.config.ts',
  'scripts/prepare-workspace.mjs',
  'scripts/ci/desktop-changes.mjs',
  'scripts/ci/desktop-required.mjs',
  'scripts/release/desktop-artifacts.mjs',
  'scripts/release/run-command.mjs',
])

export function affectsDesktopPackage(path) {
  return files.has(path) || prefixes.some(prefix => path.startsWith(prefix))
    || /^tsconfig[^/]*\.json$/u.test(path)
    || /^\.github\/workflows\/(?:desktop[^/]*|release[^/]*)\.yml$/u.test(path)
}

export async function desktopPackagingChanged({ event, base, head, cwd = process.cwd(), run = execFileAsync }) {
  if (event === 'workflow_dispatch')
    return true
  // A new branch has no prior commit. Keep its initial package validation.
  if (event === 'push' && /^0{40}$/u.test(base || ''))
    return true
  if (!/^[a-f\d]{40}$/u.test(base || '') || !/^[a-f\d]{40}$/u.test(head || ''))
    throw new Error('Desktop change detection requires exact base and head commits')
  // The old side of a force push may no longer be reachable from the checkout.
  try {
    await run('git', ['cat-file', '-e', `${base}^{commit}`], { cwd })
  }
  catch {
    process.stderr.write('Desktop base commit is unavailable; running package validation.\n')
    return true
  }
  // PRs compare against their merge base; pushes compare the complete pushed range.
  const range = event === 'pull_request' ? `${base}...${head}` : `${base}..${head}`
  const { stdout } = await run('git', ['diff', '--name-only', '--no-renames', '-z', range], { cwd, maxBuffer: 10 * 1024 * 1024 })
  return stdout.split('\0').filter(Boolean).some(affectsDesktopPackage)
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const changed = await desktopPackagingChanged({ event: process.env.DESKTOP_EVENT, base: process.env.DESKTOP_BASE_SHA, head: process.env.DESKTOP_HEAD_SHA })
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, `package=${changed}\n`)
  process.stdout.write(`Desktop packaging changes: ${changed}\n`)
}
