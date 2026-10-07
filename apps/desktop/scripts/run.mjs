import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { runCommand, runPnpm } from '../../../scripts/release/run-command.mjs'
import { parseDesktopOptions, resolveDesktopTarget } from './config.mjs'
import { prepareDevelopmentExecutable } from './dev.mjs'

const root = resolve(import.meta.dirname, '..')
const repository = resolve(root, '../..')

export async function needsDesktopBuild(repositoryRoot = repository) {
  const outputs = [
    'packages/advjs/dist/node/index.mjs',
    'packages/core/dist/index.mjs',
    'packages/parser/dist/index.mjs',
    'editor/core/dist/index.html',
  ]
  for (const output of outputs) {
    try {
      if (!(await stat(resolve(repositoryRoot, output))).isFile())
        return true
    }
    catch (error) {
      if (error.code !== 'ENOENT')
        throw error
      return true
    }
  }
  return false
}

export async function runDesktop(command, args = [], dependencies = {}) {
  if (!['dev', 'build', 'package', 'make'].includes(command))
    throw new Error(`Unknown desktop command: ${command}`)
  const options = parseDesktopOptions(args)
  const target = resolveDesktopTarget(options, dependencies.host || process)
  const pnpm = dependencies.runPnpm || runPnpm
  const run = dependencies.runCommand || runCommand
  const missing = dependencies.needsBuild || needsDesktopBuild
  const settings = { cwd: repository, stdout: 'inherit', stderr: 'inherit' }
  if (command !== 'dev' || options.rebuild || await missing()) {
    // This preparation already builds the engine, packages and Editor plugins.
    await pnpm(['prepare:workspace', 'editor'], settings)
    await pnpm(['-C', 'editor/core', 'build'], { ...settings, env: { ADVJS_EDITOR_MODE: 'local' } })
  }
  await run(process.execPath, [resolve(root, 'scripts/build.mjs')], settings)
  if (command === 'dev') {
    const electron = await (dependencies.developmentExecutable || prepareDevelopmentExecutable)()
    await run(electron, [root], settings)
  }
  else if (command === 'package' || command === 'make') {
    await run(process.execPath, [resolve(root, 'scripts/stage.mjs')], settings)
    await run(process.execPath, [resolve(root, 'scripts/forge.mjs'), command, `--platform=${target.platform}`, `--arch=${target.arch}`], settings)
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  await runDesktop(process.argv[2], process.argv.slice(3))
}
