#!/usr/bin/env node

import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { runCommand, runPnpm } from './release/run-command.mjs'

const repositoryRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))

export const WORKSPACE_PREPARATION_PROFILES = Object.freeze({
  editor: Object.freeze([
    Object.freeze(['pnpm', Object.freeze(['build'])]),
    Object.freeze(['pnpm', Object.freeze(['build:plugins'])]),
    Object.freeze(['pnpm', Object.freeze(['-C', 'editor/core', 'exec', 'nuxt', 'prepare'])]),
  ]),
  launch: Object.freeze([
    Object.freeze(['pnpm', Object.freeze(['build'])]),
    Object.freeze(['pnpm', Object.freeze(['build:plugins'])]),
    Object.freeze(['pnpm', Object.freeze(['-C', 'editor/core', 'build'])]),
  ]),
  lint: Object.freeze([
    Object.freeze(['pnpm', Object.freeze(['unocss:build'])]),
  ]),
  studio: Object.freeze([
    Object.freeze(['pnpm', Object.freeze(['build'])]),
    Object.freeze(['pnpm', Object.freeze(['build:plugins'])]),
  ]),
  unit: Object.freeze([
    Object.freeze(['pnpm', Object.freeze(['build'])]),
    Object.freeze(['pnpm', Object.freeze(['-C', 'editor/core', 'exec', 'nuxt', 'prepare'])]),
  ]),
})

export async function prepareWorkspace(profile, options = {}) {
  const commands = WORKSPACE_PREPARATION_PROFILES[profile]
  if (!commands)
    throw new Error(`Unknown workspace preparation profile: ${profile || '(missing)'}`)

  const root = resolve(options.root || repositoryRoot)
  const runner = options.runner || (async (command, args, commandOptions) => command === 'pnpm'
    ? await runPnpm(args, commandOptions)
    : await runCommand(command, args, commandOptions))
  for (const [command, args] of commands) {
    await runner(command, [...args], {
      cwd: root,
      stderr: 'inherit',
      stdout: 'inherit',
    })
  }
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : ''
if (invokedPath === import.meta.url) {
  try {
    await prepareWorkspace(process.argv[2])
  }
  catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack : error}\n`)
    process.exitCode = 1
  }
}
