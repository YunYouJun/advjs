// @vitest-environment node

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const root = resolve(import.meta.dirname, '../..')

interface WorkflowStep {
  run?: string
}

interface WorkflowJob {
  'continue-on-error'?: boolean
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
        expect(npmCommands).toEqual(jobName === 'editor-pages-build' ? ['npm run editor:build'] : [])
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
      expect(ci.jobs[jobName].strategy?.matrix?.node).toEqual(['22', '24'])
    }

    for (const jobName of ['editor-smoke', 'packed-smoke'] as const) {
      expect(ci.jobs[jobName]['continue-on-error']).toBeUndefined()
      expect(ci.jobs[jobName].strategy?.matrix?.os).toEqual(['macos-latest', 'windows-latest'])
    }

    expect(runCommands(ci.jobs.build)).toContain('pnpm build')
    expect(runCommands(ci.jobs.unit)).toContain('pnpm vitest run tests/unit --reporter=default')
    expect(runCommands(ci.jobs.typecheck)).toContain('pnpm typecheck')
    expect(runCommands(ci.jobs['editor-smoke'])).toEqual(expect.arrayContaining([
      'pnpm --filter @advjs/editor typecheck',
      'pnpm --filter @advjs/editor build',
    ]))
    expect(runCommands(ci.jobs['packed-smoke'])).toContain(
      'pnpm vitest run tests/launch/packed-build.test.ts tests/launch/packed-install.test.ts --no-file-parallelism --reporter=default',
    )
    expect(runCommands(ci.jobs.e2e)).toEqual(expect.arrayContaining([
      'pnpm exec playwright install --with-deps chromium',
      'pnpm exec playwright test --project=chromium',
    ]))
    expect(ci.jobs['launch-journey']['continue-on-error']).toBeUndefined()
    expect(ci.jobs['launch-journey']['runs-on']).toBe('ubuntu-latest')
    expect(runCommands(ci.jobs['launch-journey'])).toContain('pnpm exec playwright install --with-deps chromium')
    expect(runCommands(ci.jobs['launch-journey'])).toContain('pnpm test:launch')

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
