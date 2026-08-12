import type { Argv } from 'yargs'
import { readFile } from 'node:fs/promises'
import { basename, relative, resolve } from 'node:path'
import process from 'node:process'
import { t } from './i18n'
import { createCliError, runCliCommand } from './output'

function normalizeProjectName(value: string) {
  return value
    .toLowerCase()
    .replace(/^@[^/]+\//u, '')
    .replace(/[^a-z0-9-]+/gu, '-')
    .replace(/-{2,}/gu, '-')
    .replace(/^-|-$/gu, '')
    .slice(0, 58)
    .replace(/-$/u, '')
}

export async function resolveDeploymentProjectName(root: string, explicit?: string) {
  if (explicit) {
    if (normalizeProjectName(explicit) !== explicit || explicit.length > 58)
      throw new TypeError('Cloudflare Pages project names must contain only lowercase letters, numbers, and hyphens (maximum 58 characters)')
    return explicit
  }

  let candidate = basename(root)
  try {
    const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')) as { name?: unknown }
    if (typeof packageJson.name === 'string')
      candidate = packageJson.name
  }
  catch {}
  const project = normalizeProjectName(candidate)
  if (!project)
    throw new TypeError('Could not derive a Cloudflare Pages project name; pass --project explicitly')
  return project
}

export function installDeployCommand(cli: Argv) {
  cli.command(
    'deploy',
    t('deploy.desc'),
    yargs => yargs
      .option('root', {
        type: 'string',
        describe: t('deploy.root_desc'),
      })
      .option('provider', {
        type: 'string',
        choices: ['cloudflare-pages'] as const,
        default: 'cloudflare-pages' as const,
        describe: t('deploy.provider_desc'),
      })
      .option('project', {
        type: 'string',
        describe: t('deploy.project_desc'),
      })
      .option('account-id', {
        type: 'string',
        describe: t('deploy.account_desc'),
      })
      .option('branch', {
        type: 'string',
        default: 'main',
        describe: t('deploy.branch_desc'),
      })
      .option('production-branch', {
        type: 'string',
        default: 'main',
        describe: t('deploy.production_branch_desc'),
      })
      .option('artifact', {
        type: 'string',
        describe: t('deploy.artifact_desc'),
      })
      .option('receipt', {
        type: 'string',
        describe: t('deploy.receipt_desc'),
      })
      .check((argv) => {
        if (Boolean(argv.artifact) !== Boolean(argv.receipt))
          throw new TypeError('--artifact and --receipt must be provided together')
        if (argv.artifact && argv.project)
          throw new TypeError('--project is read from the artifact receipt in recovery mode')
        return true
      })
      .strict()
      .help(),
    async (argv) => {
      const { createCloudflarePagesProvider, deployArtifact, deployProject, DeployProjectError } = await import('../deploy')
      const root = resolve(argv.root as string || process.cwd())
      const artifactMode = Boolean(argv.artifact)
      await runCliCommand({
        command: artifactMode ? 'deploy.artifact' : 'deploy',
        json: Boolean(argv.json),
        run: async () => {
          const provider = createCloudflarePagesProvider({
            accountId: argv.accountId as string | undefined,
            branch: argv.branch as string,
            login: !argv.json,
            productionBranch: argv.productionBranch as string,
          })
          const result = artifactMode
            ? await deployArtifact({
                archive: resolve(argv.artifact as string),
                provider,
                receipt: resolve(argv.receipt as string),
                root,
              })
            : await deployProject({
                project: await resolveDeploymentProjectName(root, argv.project as string | undefined),
                provider,
                root,
              })
          const data = {
            ...result,
            receipt: relative(root, result.receipt).replaceAll('\\', '/'),
            ...('artifactReceipt' in result && typeof result.artifactReceipt === 'string'
              ? { artifactReceipt: relative(root, result.artifactReceipt).replaceAll('\\', '/') }
              : {}),
          }
          if (!argv.json)
            console.log(`${t('deploy.complete')}: ${data.url}`)
          return data
        },
        mapError: error => error instanceof DeployProjectError
          ? createCliError(error.code, error)
          : createCliError(error instanceof TypeError ? 'ADV_USAGE' : 'ADV_DEPLOY', error),
      })
    },
  )
}
