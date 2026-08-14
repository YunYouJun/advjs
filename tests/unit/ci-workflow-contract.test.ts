// @vitest-environment node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const root = resolve(import.meta.dirname, '../..')

interface WorkflowStep {
  run?: string
  uses?: string
  with?: Record<string, string>
}

interface WorkflowJob {
  'continue-on-error'?: boolean
  'env'?: Record<string, string>
  'if'?: string
  'needs'?: string[]
  'runs-on': string
  'strategy'?: {
    matrix?: Record<string, unknown[]>
  }
  'steps': WorkflowStep[]
}

interface Workflow {
  on: {
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
  const declaredVersion = setupNode?.with?.['node-version']
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
  it('runs dev and main validation through stable, pnpm-only jobs', () => {
    const workflows = ['ci', 'demo', 'docs'].map(readWorkflow)
    const ci = workflows[0]

    for (const workflow of workflows) {
      expect(workflow.on.push.branches).toEqual(['dev', 'main'])
      expect(workflow.on.pull_request.branches).toEqual(['dev', 'main'])

      for (const [jobName, job] of Object.entries(workflow.jobs)) {
        const commands = runCommands(job)
        if (jobName !== 'launch-required')
          expect(commands).toContain('pnpm install --frozen-lockfile')
        const npmCommands = commands.filter(command => /(?:^|\n)\s*(?:npm|npx)\s/u.test(command))
        expect(npmCommands).toEqual([])
        if (jobName !== 'launch-required') {
          expectCurrentActions(job)
          expectCurrentLts(job)
        }
      }
    }

    expect(Object.keys(ci.jobs)).toEqual([
      'build',
      'editor-pages-build',
      'unit',
      'typecheck',
      'lint',
      'editor-smoke',
      'packed-smoke',
      'e2e',
      'editor-e2e',
      'agent-install-smoke',
      'launch-journey',
      'launch-required',
    ])

    for (const jobName of ['build', 'unit', 'typecheck'] as const) {
      expect(ci.jobs[jobName]['runs-on']).toBe('ubuntu-latest')
      expect(ci.jobs[jobName].strategy).toBeUndefined()
    }

    for (const jobName of ['editor-smoke', 'packed-smoke'] as const) {
      expect(ci.jobs[jobName]['continue-on-error']).toBeUndefined()
      expect(ci.jobs[jobName].strategy?.matrix?.os).toEqual(['macos-latest', 'windows-latest'])
    }

    expect(runCommands(ci.jobs.build)).toContain('pnpm build')
    expect(runCommands(ci.jobs.unit)).toContain('pnpm vitest run tests/unit --reporter=default')
    expectCommandBefore(ci.jobs.unit, 'pnpm prepare:workspace unit', 'pnpm vitest run tests/unit --reporter=default')
    expect(runCommands(ci.jobs.typecheck)).toContain('pnpm typecheck')
    expectCommandBefore(ci.jobs.lint, 'pnpm prepare:workspace lint', 'pnpm lint')
    expect(runCommands(ci.jobs['editor-pages-build'])).toContain('pnpm editor:build')
    expectCommandBefore(ci.jobs['editor-smoke'], 'pnpm prepare:workspace editor', 'pnpm --filter @advjs/editor typecheck')
    expect(runCommands(ci.jobs['editor-smoke'])).toEqual(expect.arrayContaining([
      'pnpm --filter @advjs/editor typecheck',
      'pnpm --filter @advjs/editor build',
    ]))
    expect(runCommands(ci.jobs['packed-smoke'])).toEqual(expect.arrayContaining([
      'pnpm vitest run tests/launch/packed-build.test.ts --no-file-parallelism --reporter=default',
      'pnpm vitest run tests/launch/packed-install.test.ts --no-file-parallelism --reporter=default',
    ]))
    expect(runCommands(ci.jobs.e2e)).toEqual(expect.arrayContaining([
      'pnpm exec playwright install --with-deps chromium',
      'pnpm exec playwright test --project=chromium',
    ]))
    expectCommandBefore(ci.jobs.e2e, 'pnpm editor:build', 'pnpm exec playwright test --project=chromium')
    expectCommandBefore(ci.jobs['editor-e2e'], 'pnpm editor:build', 'pnpm exec playwright test tests/e2e/editor-local.spec.ts tests/e2e/editor-security.spec.ts --project=chromium')
    expect(ci.jobs['launch-journey']['continue-on-error']).toBeUndefined()
    expect(ci.jobs['launch-journey']['runs-on']).toBe('ubuntu-latest')
    expect(runCommands(ci.jobs['launch-journey'])).toContain('pnpm exec playwright install --with-deps chromium')
    expect(ci.jobs['launch-journey'].env.ADVJS_DOCS_JOURNEY_SKIP_BUILD).toBe('1')
    expectCommandBefore(ci.jobs['launch-journey'], 'pnpm prepare:workspace launch', 'pnpm test:launch:journey')
    expect(runCommands(ci.jobs['launch-journey'])).toContain('pnpm test:launch:journey')

    const required = ci.jobs['launch-required']
    expect(required.if).toBe('always()')
    expect(required.needs).toEqual([
      'build',
      'editor-pages-build',
      'unit',
      'typecheck',
      'lint',
      'editor-smoke',
      'packed-smoke',
      'e2e',
      'editor-e2e',
      'agent-install-smoke',
      'launch-journey',
    ])
    expect(runCommands(required).join('\n')).toContain('job.result !== "success"')
  })
})
