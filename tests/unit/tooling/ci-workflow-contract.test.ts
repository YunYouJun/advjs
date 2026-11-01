// @vitest-environment node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'
import { LAUNCH_CHECKS } from '../../../scripts/ci/launch-required.mjs'
import { WORKSPACE_PREPARATION_PROFILES } from '../../../scripts/prepare-workspace.mjs'
import { buildLaunchPackages } from '../../../scripts/release/package-manifest.mjs'

const root = resolve(import.meta.dirname, '../../..')

interface WorkflowStep {
  env?: Record<string, string>
  if?: string
  run?: string
  uses?: string
  with?: Record<string, unknown>
}

interface WorkflowJob {
  'continue-on-error'?: boolean
  'env'?: Record<string, string>
  'if'?: string
  'needs'?: string | string[]
  'runs-on': string
  'timeout-minutes'?: number
  'strategy'?: {
    matrix?: Record<string, unknown[]>
  }
  'steps': WorkflowStep[]
}

interface Workflow {
  on: {
    workflow_dispatch?: {
      inputs?: Record<string, { description?: string, type: string, default: string, options: string[] }>
    }
    push: { branches: string[] }
    pull_request: { branches: string[] }
  }
  jobs: Record<string, WorkflowJob>
}

function readWorkflow(name: string) {
  return parse(readFileSync(resolve(root, `.github/workflows/${name}.yml`), 'utf8')) as Workflow
}

function runCommands(job: WorkflowJob) {
  return job.steps.flatMap(step => step.run ? [step.run] : [])
}

function expectCommandBefore(job: WorkflowJob, prerequisite: string, command: string) {
  const commands = runCommands(job)
  expect(commands, `${prerequisite} must run before ${command}`).toEqual(expect.arrayContaining([
    prerequisite,
    command,
  ]))
  expect(commands.indexOf(prerequisite)).toBeLessThan(commands.indexOf(command))
}

function expectCurrentLts(job: WorkflowJob) {
  const setupNode = job.steps.find(step => step.uses?.startsWith('actions/setup-node@'))
  expect(setupNode, 'job must configure Node.js').toBeDefined()
  expect(setupNode?.uses).toBe('actions/setup-node@v7')
  const declaredVersion = String(setupNode?.with?.['node-version'])
  const resolvedVersion = declaredVersion?.includes('env.NODE_VERSION')
    ? job.env?.NODE_VERSION
    : declaredVersion
  expect(resolvedVersion).toBe('lts/*')
}

function expectCurrentActions(job: WorkflowJob) {
  expect(job.steps.some(step => step.uses === 'actions/checkout@v7')).toBe(true)
  expect(job.steps.some(step => step.uses === 'pnpm/action-setup@v6')).toBe(true)
  for (const step of job.steps) {
    if (step.uses?.startsWith('actions/upload-artifact@'))
      expect(step.uses).toBe('actions/upload-artifact@v7')
  }
}

describe('github Actions launch baseline', () => {
  it('keeps every root browser suite in one unfiltered Chromium run', () => {
    const ci = readWorkflow('ci')
    const browserCommands = Object.values(ci.jobs).flatMap(runCommands).filter(command => command.startsWith('pnpm exec playwright test'))
    // No allowlist or exclusion regex can silently omit new Editor/player suites.
    expect(browserCommands).toEqual(['pnpm exec playwright test --project=chromium'])
    const browser = ci.jobs.browser
    expectCommandBefore(browser, 'pnpm editor:build', browserCommands[0])
    expect(runCommands(browser)).toContain('test -f editor/core/dist/index.html')
    expectCommandBefore(browser, 'pnpm editor:build', 'pnpm test:launch:journey')
    expect(browser.env?.ADVJS_DOCS_JOURNEY_SKIP_BUILD).toBe('1')
    expect(runCommands(browser)).toContain('pnpm exec playwright install --with-deps --only-shell chromium')
    expect(browser.steps.filter(step => step.uses === 'actions/upload-artifact@v7').map(step => step.with?.name)).toEqual([
      'playwright-report',
      'editor-migration-evidence',
      `launch-journey-$${'{'}{ github.run_id }}`,
    ])
  })

  it('builds once for root types, lint and units, with real audio processing tools', () => {
    const quality = readWorkflow('ci').jobs.quality
    expect(quality['runs-on']).toBe('ubuntu-latest')
    expect(quality.strategy).toBeUndefined()
    const preparation = 'pnpm prepare:workspace unit'
    // This profile includes all package builds (including UnoCSS) and Nuxt types.
    expect(WORKSPACE_PREPARATION_PROFILES.unit).toEqual([
      ['pnpm', ['build']],
      ['pnpm', ['-C', 'editor/core', 'exec', 'nuxt', 'prepare']],
    ])
    for (const command of ['pnpm typecheck', 'pnpm lint', 'pnpm exec tsc -p tests/tsconfig.game-theme.json --noEmit', 'pnpm vitest run tests/unit --reporter=default'])
      expectCommandBefore(quality, preparation, command)
    const installAudio = runCommands(quality).find(command => command.includes('apt-get install --yes --no-install-recommends ffmpeg'))!
    expect(installAudio).toContain('sudo apt-get update')
    expect(installAudio).toContain('ffmpeg -version')
    expect(installAudio).toContain('ffprobe -version')
    expectCommandBefore(quality, installAudio, 'pnpm vitest run tests/unit --reporter=default')
  })

  it('checks Editor sources and all installed-package flows on macOS and Windows', async () => {
    const platform = readWorkflow('ci').jobs['platform-smoke']
    expect(platform.strategy?.matrix?.os).toEqual(['macos-latest', 'windows-latest'])
    expect(platform['continue-on-error']).toBeUndefined()
    expectCommandBefore(platform, 'pnpm prepare:workspace editor', 'pnpm --filter @advjs/editor typecheck')
    const packedBuild = 'pnpm vitest run tests/launch/packed-build.test.ts --no-file-parallelism --reporter=default'
    expectCommandBefore(platform, 'pnpm --filter @advjs/editor typecheck', 'pnpm --filter @advjs/editor build')
    expectCommandBefore(platform, 'pnpm --filter @advjs/editor build', packedBuild)
    // Local standalone packing still builds Editor last unless CI supplies fresh outputs.
    const builds: string[][] = []
    await buildLaunchPackages(root, { runner: async (_root: string, args: string[]) => builds.push(args) })
    expect(builds.at(-1)).toEqual(['-C', 'editor/core', 'build'])
    const packedSource = readFileSync(resolve(root, 'tests/launch/packed-build.test.ts'), 'utf8')
    expect(packedSource).toContain('await createPackageManifest({')
    expect(packedSource).toContain('build: process.env.ADVJS_PACKED_INSTALL_SKIP_BUILD !== \'1\'')
    expect(platform.env?.ADVJS_PACKED_INSTALL_SKIP_BUILD).toBeUndefined()
    expect(platform.steps.find(step => step.run === packedBuild)?.env?.ADVJS_PACKED_INSTALL_SKIP_BUILD).toBe('1')
    for (const test of ['packed-install', 'create-adv']) {
      const command = `pnpm vitest run tests/launch/${test}.test.ts --no-file-parallelism --reporter=default`
      expectCommandBefore(platform, packedBuild, command)
      expect(platform.steps.find(step => step.run === command)?.env?.ADVJS_PACKED_INSTALL_SKIP_BUILD).toBe('1')
    }
  })

  it('builds native inputs on Linux and restores only this run before all iOS tests', () => {
    const ci = readWorkflow('ci')
    const studio = ci.jobs['studio-unit']
    expect(studio['runs-on']).toBe('ubuntu-latest')
    expectCommandBefore(studio, 'pnpm prepare:workspace studio-ios', 'pnpm -C apps/studio exec vitest run')
    expectCommandBefore(studio, 'pnpm -C apps/studio-ios build:engine', 'pnpm -C apps/studio-ios test:engine')
    const golden = 'pnpm -C apps/studio-ios golden && pnpm -C apps/studio-ios build:samples'
    expectCommandBefore(studio, 'pnpm -C apps/studio-ios test:engine', golden)
    const upload = studio.steps.find(step => step.with?.name === 'studio-ios-inputs')!
    expect(studio.steps.indexOf(upload)).toBeGreaterThan(studio.steps.findIndex(step => step.run === golden))
    expect(upload.if).toBe('needs.studio-changes.outputs.native == \'true\'')
    expect(upload.with?.['if-no-files-found']).toBe('error')
    expect(String(upload.with?.path).trim().split('\n')).toEqual([
      'apps/studio-ios/engine/dist/engine.report.json',
      'apps/studio-ios/engine/dist/golden/summary.json',
      'apps/studio-ios/Packages/StudioKit/Sources/StudioKit/EngineBundle/',
      'apps/studio-ios/Packages/StudioKit/Tests/StudioKitTests/Golden/',
      'apps/studio-ios/StudioApp/Samples/',
    ])
    const native = ci.jobs['studio-ios']
    expect(native.needs).toEqual(['studio-changes', 'studio-unit'])
    expect(native.if).toBe('needs.studio-changes.outputs.native == \'true\'')
    expect(native['runs-on']).toBe(`$${'{'}{ inputs.native-runner == 'xcode-27' && 'xcode-27' || 'macos-26' }}`)
    const download = native.steps.find(step => step.uses === 'actions/download-artifact@v8')!
    // No token, repository or run-id override: download from this workflow run.
    expect(download.with).toEqual({ name: 'studio-ios-inputs', path: 'apps/studio-ios' })
    const commands = runCommands(native)
    expect(commands.some(command => command.includes('pnpm ') || command.includes('swift test'))).toBe(false)
    const xcodeTests = commands.filter(command => command.startsWith('xcodebuild test'))
    expect(xcodeTests).toHaveLength(4)
    expect(xcodeTests).toEqual(expect.arrayContaining([
      expect.stringMatching(/-scheme StudioKit .*--only iphone/u),
      expect.stringMatching(/--only iphone.* -only-testing:StudioAppTests /u),
      expect.stringMatching(/--only iphone.* -only-testing:StudioAppUITests /u),
      expect.stringMatching(/--only ipad.* -only-testing:StudioAppUITests\/IPadLayoutUITests /u),
    ]))
    for (const command of xcodeTests) {
      expect(command).toContain('-parallel-testing-enabled NO')
      expect(native.steps.indexOf(download)).toBeLessThan(native.steps.findIndex(step => step.run === command))
    }
  })

  it('uses the stable Apple pool by default while retaining explicit preview validation', () => {
    const ci = readWorkflow('ci')
    const native = ci.jobs['studio-ios']
    expect(ci.on.workflow_dispatch?.inputs?.['native-runner']).toEqual({
      description: 'Native Apple test image (preview images may queue longer)',
      type: 'choice',
      default: 'macos-26',
      options: ['macos-26', 'xcode-27'],
    })
    expect(native.env?.DEVELOPER_DIR).toBe(`$${'{'}{ inputs.native-runner == 'xcode-27' && '/Applications/Xcode_27.1.app/Contents/Developer' || '/Applications/Xcode_26.6.app/Contents/Developer' }}`)
    const inspection = runCommands(native).find(command => command.includes('xcodebuild -version'))!
    expect(inspection).toContain('xcrun --sdk iphonesimulator --show-sdk-version')
    expect(inspection).toContain('xcrun simctl list runtimes')
    expectCommandBefore(native, inspection, 'node apps/studio-ios/scripts/simulator-destinations.mjs --only iphone --boot')
    // A retry must replace its partial result artifact without colliding with it.
    const results = native.steps.find(step => step.with?.name === 'studio-ios')!
    expect(results.with?.overwrite).toBe(true)
  })

  it('runs iPhone and iPad coverage with only the active simulator booted', () => {
    const native = readWorkflow('ci').jobs['studio-ios']
    const commands = runCommands(native)
    const phoneBoot = 'node apps/studio-ios/scripts/simulator-destinations.mjs --only iphone --boot'
    const phoneShutdown = 'node apps/studio-ios/scripts/simulator-destinations.mjs --only iphone --shutdown'
    const padBoot = 'node apps/studio-ios/scripts/simulator-destinations.mjs --only ipad --boot'
    const phoneUI = commands.find(command => command.includes('-only-testing:StudioAppUITests '))!
    const padUI = commands.find(command => command.includes('-only-testing:StudioAppUITests/IPadLayoutUITests '))!
    expectCommandBefore(native, phoneBoot, phoneUI)
    expectCommandBefore(native, phoneUI, phoneShutdown)
    expectCommandBefore(native, phoneShutdown, padBoot)
    expectCommandBefore(native, padBoot, padUI)
    expect(commands).not.toContain('node apps/studio-ios/scripts/simulator-destinations.mjs --boot')
  })

  it('keeps Pages production builds and packed Agent installation checks', () => {
    const ci = readWorkflow('ci')
    expectCommandBefore(ci.jobs['studio-pages-build'], 'pnpm install --frozen-lockfile', 'pnpm studio:build')
    expect(runCommands(ci.jobs['studio-pages-build'])).toContain('test -f apps/studio/dist/index.html && test -f apps/studio/dist/sw.js')
    expectCommandBefore(ci.jobs['vrm-pages-build'], 'pnpm install --frozen-lockfile', 'pnpm run build:advjs && pnpm plugins:build && pnpm run vrm:build')
    expect(runCommands(ci.jobs['vrm-pages-build'])).toContain('test -f editor/vrm/dist/index.html && test -f editor/vrm/dist/sw.js')
    expect(runCommands(ci.jobs['agent-install-smoke'])).toContain('pnpm vitest run tests/launch/agent-install-smoke.test.ts --reporter=default')
  })

  it('preserves frozen installs and the fail-closed aggregate for dev and main', () => {
    const workflows = ['ci', 'demo', 'docs'].map(readWorkflow)
    const ci = workflows[0]
    for (const workflow of workflows) {
      expect(workflow.on.push.branches).toEqual(['dev', 'main'])
      expect(workflow.on.pull_request.branches).toEqual(['dev', 'main'])
      for (const [jobName, job] of Object.entries(workflow.jobs)) {
        const commands = runCommands(job)
        const installs = !['launch-required', 'studio-changes', 'studio-ios'].includes(jobName)
        if (installs) {
          expect(commands).toContain('pnpm install --frozen-lockfile')
          expectCurrentActions(job)
          expectCurrentLts(job)
        }
        expect(commands.filter(command => /(?:^|\n)\s*(?:npm|npx)\s/u.test(command))).toEqual([])
        expect(job['continue-on-error']).toBeUndefined()
      }
    }
    const required = ci.jobs['launch-required']
    expect(required.if).toBe('always()')
    expect(required.needs).toEqual(Object.keys(LAUNCH_CHECKS))
    expect(Object.keys(ci.jobs).filter(name => name !== 'launch-required')).toEqual(required.needs)
    expect(runCommands(required)).toEqual(['node scripts/ci/launch-required.mjs'])
    for (const name of ['studio-unit', 'studio-pages-build']) {
      expect(ci.jobs[name].needs).toBe('studio-changes')
      expect(ci.jobs[name].if).toBe('needs.studio-changes.outputs.studio == \'true\'')
    }
    const expandedJobs = Object.values(ci.jobs).reduce((count, job) => count + (job.strategy?.matrix?.os.length || 1), 0)
    expect(expandedJobs).toBeLessThanOrEqual(11)
  })
})
