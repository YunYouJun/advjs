// @vitest-environment node

import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import addFormats from 'ajv-formats'
import Ajv2020 from 'ajv/dist/2020.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import cliOutputSchema from '../launch/contracts/cli-output.schema.json'

interface CliResult {
  exitCode: number
  stderr: string
  stdout: string
}

const repositoryRoot = resolve(import.meta.dirname, '../..')
const cliEntry = resolve(repositoryRoot, 'packages/advjs/node/cli/index.ts')
const tsxCli = fileURLToPath(import.meta.resolve('tsx/cli'))
const ajv = new Ajv2020({ allErrors: true, strict: true })
addFormats(ajv)
ajv.addSchema(cliOutputSchema)
const validateEnvelope = ajv.getSchema(`${cliOutputSchema.$id}#/$defs/envelope`)!

let temporaryRoot = ''

function runCli(args: string[], cwd: string): Promise<CliResult> {
  return new Promise((resolveResult, reject) => {
    const environment = {
      ...process.env,
      FORCE_COLOR: '0',
      NODE_ENV: 'production',
      NO_COLOR: '1',
    }
    delete environment.VITEST
    delete environment.VITEST_MODE
    delete environment.VITEST_POOL_ID
    delete environment.VITEST_WORKER_ID
    const child = spawn(process.execPath, [tsxCli, cliEntry, ...args], {
      cwd,
      env: environment,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => stdout += chunk)
    child.stderr.on('data', chunk => stderr += chunk)
    child.once('error', reject)
    child.once('close', code => resolveResult({ exitCode: code ?? 1, stderr, stdout }))
  })
}

function parseOnlyEnvelope(result: CliResult) {
  const lines = result.stdout.trim().split('\n')
  expect(lines, result.stdout).toHaveLength(1)
  const envelope = JSON.parse(lines[0])
  expect(validateEnvelope(envelope), ajv.errorsText(validateEnvelope.errors)).toBe(true)
  return envelope
}

function expectSchemaDefinition(name: 'buildData' | 'checkData' | 'initData', value: unknown) {
  const validate = ajv.getSchema(`${cliOutputSchema.$id}#/$defs/${name}`)!
  expect(validate(value), ajv.errorsText(validate.errors)).toBe(true)
}

beforeAll(async () => {
  temporaryRoot = await mkdtemp(join(tmpdir(), 'advjs-cli-json-'))
  await symlink(join(repositoryRoot, 'node_modules'), join(temporaryRoot, 'node_modules'), 'junction')
})

afterAll(async () => {
  if (temporaryRoot)
    await rm(temporaryRoot, { force: true, recursive: true })
})

describe('adv CLI JSON output', () => {
  it('returns a structured init result without stdout log noise', async () => {
    const projectRoot = join(temporaryRoot, 'init-success-project')
    const initResult = await runCli([
      'init',
      projectRoot,
      '--template',
      'default',
      '--name',
      'json-project',
      '--json',
    ], temporaryRoot)
    expect(initResult.exitCode).toBe(0)
    const initEnvelope = parseOnlyEnvelope(initResult)
    expect(initEnvelope).toMatchObject({ command: 'init', ok: true, warnings: [], errors: [] })
    expect(initEnvelope.data).toMatchObject({ root: projectRoot, template: 'default' })
    expect(initEnvelope.data.files).toEqual([...initEnvelope.data.files].sort())
    expectSchemaDefinition('initData', initEnvelope.data)
  })

  it('returns structured check diagnostics without stdout log noise', async () => {
    const projectRoot = join(temporaryRoot, 'check-success-project')
    await runCli(['init', projectRoot, '--template', 'default'], temporaryRoot)
    const checkResult = await runCli(['check', '--json'], projectRoot)
    expect(checkResult.exitCode).toBe(0)
    const checkEnvelope = parseOnlyEnvelope(checkResult)
    expect(checkEnvelope).toMatchObject({
      command: 'check',
      ok: true,
      data: { root: await realpath(projectRoot), diagnostics: [] },
      warnings: [],
      errors: [],
    })
    expectSchemaDefinition('checkData', checkEnvelope.data)
  }, 20_000)

  it('returns a structured build asset summary without stdout log noise', async () => {
    const projectRoot = join(temporaryRoot, 'build-success-project')
    await runCli(['init', projectRoot, '--template', 'default'], temporaryRoot)
    const buildResult = await runCli(['build', '--json'], projectRoot)
    expect(buildResult.exitCode, buildResult.stderr).toBe(0)
    const buildEnvelope = parseOnlyEnvelope(buildResult)
    expect(buildEnvelope).toMatchObject({
      command: 'build',
      ok: true,
      data: {
        root: await realpath(projectRoot),
        outDir: join(await realpath(projectRoot), 'dist'),
      },
      warnings: [],
      errors: [],
    })
    expect(buildEnvelope.data.assets.map((asset: { path: string }) => asset.path)).toEqual(
      [...buildEnvelope.data.assets.map((asset: { path: string }) => asset.path)].sort(),
    )
    expect(buildEnvelope.data.assets).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'index.html', bytes: expect.any(Number), sha256: expect.stringMatching(/^[a-f0-9]{64}$/u) }),
      expect.objectContaining({ path: '_redirects', bytes: expect.any(Number), sha256: expect.stringMatching(/^[a-f0-9]{64}$/u) }),
    ]))
    expectSchemaDefinition('buildData', buildEnvelope.data)
  }, 60_000)

  it('keeps the default human-readable output when --json is absent', async () => {
    const projectRoot = join(temporaryRoot, 'human-output-project')
    const result = await runCli(['init', projectRoot, '--template', 'default'], temporaryRoot)
    expect(result.exitCode).toBe(0)
    expect((await stat(join(projectRoot, 'adv.config.json'))).isFile()).toBe(true)
    expect(() => JSON.parse(result.stdout)).toThrow()
  })

  it('maps usage and validation failures to stable codes and non-zero exits', async () => {
    const usageResult = await runCli(['init', '--unknown-option', '--json'], temporaryRoot)
    expect(usageResult.exitCode).not.toBe(0)
    expect(parseOnlyEnvelope(usageResult)).toMatchObject({
      command: 'init',
      ok: false,
      data: null,
      errors: [{ code: 'ADV_USAGE' }],
    })

    const projectRoot = join(temporaryRoot, 'validation-project')
    await runCli(['init', projectRoot, '--json'], temporaryRoot)
    const validationResult = await runCli(['init', projectRoot, '--json'], temporaryRoot)
    expect(validationResult.exitCode).not.toBe(0)
    expect(parseOnlyEnvelope(validationResult)).toMatchObject({
      command: 'init',
      ok: false,
      data: null,
      errors: [{ code: 'ADV_VALIDATION' }],
    })
  }, 20_000)

  it('maps command build failures and unexpected internal failures separately', async () => {
    const invalidBuildRoot = join(temporaryRoot, 'invalid-build-project')
    const invalidCheckRoot = join(temporaryRoot, 'invalid-check-project')
    await Promise.all([
      mkdir(invalidBuildRoot, { recursive: true }),
      mkdir(invalidCheckRoot, { recursive: true }),
    ])
    await Promise.all([
      writeFile(join(invalidBuildRoot, 'adv.config.json'), '{ invalid json', 'utf8'),
      writeFile(join(invalidCheckRoot, 'adv.config.json'), '{ invalid json', 'utf8'),
    ])

    const buildResult = await runCli(['build', '--json'], invalidBuildRoot)
    expect(buildResult.exitCode).not.toBe(0)
    expect(parseOnlyEnvelope(buildResult)).toMatchObject({ errors: [{ code: 'ADV_BUILD' }] })

    const checkResult = await runCli(['check', '--json'], invalidCheckRoot)
    expect(checkResult.exitCode).not.toBe(0)
    expect(parseOnlyEnvelope(checkResult)).toMatchObject({ errors: [{ code: 'ADV_INTERNAL' }] })
  })
})
