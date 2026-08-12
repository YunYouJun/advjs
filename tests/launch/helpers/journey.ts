import { mkdir, mkdtemp, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'

export type LaunchPackageSource
  = | { kind: 'tarball', value: string }
    | { kind: 'registry', value: string }

export interface LaunchJourneyOptions {
  packageSource: LaunchPackageSource
  artifactsDirectory?: string
}

export interface LaunchJourneyArtifactPaths {
  directory: string
  commandLog: string
  editorLog: string
  projectDiff: string
  buildSummary: string
  browserTrace: string
  report: string
}

export interface LaunchJourney {
  artifacts: LaunchJourneyArtifactPaths
  packageSource: LaunchPackageSource
  workspaceRoot: string
  run: (executors: LaunchJourneyExecutors) => Promise<LaunchJourneyReport>
}

export const LAUNCH_JOURNEY_STAGE_IDS = [
  'install',
  'agent-mcp',
  'check',
  'editor',
  'build',
  'deploy',
  'verify-url',
] as const

export type LaunchJourneyStageId = typeof LAUNCH_JOURNEY_STAGE_IDS[number]

export interface LaunchJourneyContext {
  artifacts: LaunchJourneyArtifactPaths
  packageSource: LaunchPackageSource
  workspaceRoot: string
}

export interface LaunchJourneyStageResult {
  summary: string
}

export type LaunchJourneyStageExecutor = (context: LaunchJourneyContext) => Promise<LaunchJourneyStageResult>
export type LaunchJourneyExecutors = Partial<Record<LaunchJourneyStageId, LaunchJourneyStageExecutor>>

export type LaunchJourneyStageReport
  = | { id: LaunchJourneyStageId, status: 'passed', summary: string }
    | { id: LaunchJourneyStageId, status: 'failed', error: string }
    | { id: LaunchJourneyStageId, status: 'blocked', reason: string }

export interface LaunchJourneyReport {
  status: 'passed' | 'failed'
  stages: LaunchJourneyStageReport[]
}

const REGISTRY_SPEC_RE = /^(?:@[\w.-]+\/)?[\w.-]+@\w[\w.-]*$/iu

async function validatePackageSource(source: LaunchPackageSource) {
  if (source.kind === 'registry' && REGISTRY_SPEC_RE.test(source.value))
    return source

  if (source.kind === 'tarball') {
    const tarball = resolve(source.value)
    if (tarball.endsWith('.tgz') && (await stat(tarball).catch(() => undefined))?.isFile())
      return { ...source, value: tarball }
  }

  throw new TypeError('Launch journey requires a packed tarball or registry package source')
}

export async function createLaunchJourney(options: LaunchJourneyOptions): Promise<LaunchJourney> {
  const packageSource = await validatePackageSource(options.packageSource)
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'advjs-launch-'))
  const artifactsDirectory = resolve(
    options.artifactsDirectory
    ?? process.env.ADV_LAUNCH_ARTIFACTS_DIR
    ?? join(workspaceRoot, 'artifacts'),
  )
  const artifacts: LaunchJourneyArtifactPaths = {
    directory: artifactsDirectory,
    commandLog: join(artifactsDirectory, 'commands.log'),
    editorLog: join(artifactsDirectory, 'editor.log'),
    projectDiff: join(artifactsDirectory, 'project.diff'),
    buildSummary: join(artifactsDirectory, 'build-summary.json'),
    browserTrace: join(artifactsDirectory, 'browser-trace.zip'),
    report: join(artifactsDirectory, 'journey-report.json'),
  }
  await mkdir(artifactsDirectory, { recursive: true })
  const context = { artifacts, packageSource, workspaceRoot }

  return {
    artifacts,
    packageSource,
    workspaceRoot,
    async run(executors) {
      const stages: LaunchJourneyStageReport[] = []
      let failed = false

      for (const id of LAUNCH_JOURNEY_STAGE_IDS) {
        const execute = executors[id]
        if (failed) {
          stages.push({ id, status: 'blocked', reason: 'An earlier launch stage failed' })
          continue
        }
        if (!execute) {
          failed = true
          stages.push({ id, status: 'failed', error: `Missing required launch executor: ${id}` })
          continue
        }

        try {
          const result = await execute(context)
          stages.push({ id, status: 'passed', summary: result.summary })
        }
        catch (error) {
          failed = true
          stages.push({
            id,
            status: 'failed',
            error: error instanceof Error ? error.message : String(error),
          })
        }
      }

      const report: LaunchJourneyReport = {
        status: failed ? 'failed' : 'passed',
        stages,
      }
      await writeFile(artifacts.report, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
      return report
    },
  }
}
