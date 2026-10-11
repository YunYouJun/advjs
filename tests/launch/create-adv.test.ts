// @vitest-environment node

import { mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { delimiter, join, relative, resolve } from 'node:path'
import process from 'node:process'
import { execa } from 'execa'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createPackageManifest, parsePnpmJsonOutput, readTarEntries } from '../../scripts/release/package-manifest.mjs'
import { runCommand, runPnpm } from '../../scripts/release/run-command.mjs'
import { writeLaunchWorkspaceConfig } from './helpers/registry'

const root = resolve(import.meta.dirname, '../..')
let temporaryRoot = ''
let bin = ''
let packs = ''

async function run(args: string[], cwd = temporaryRoot) {
  // Exercise normal CLI output, rather than consola's silent test environment.
  return runCommand(process.execPath, [bin, ...args], { cwd, env: { NODE_ENV: 'production', TEST: 'false', NODE_PATH: undefined }, timeout: 30_000 })
}

async function stopPreview(pid: number | undefined) {
  // pnpm starts Vite as a child: stop the whole owned process tree so its
  // inherited stdout cannot keep the test waiting after pnpm exits.
  if (pid) {
    if (process.platform === 'win32') {
      await execa('taskkill', ['/pid', String(pid), '/T', '/F']).catch(() => undefined)
    }
    else {
      try {
        process.kill(-pid, 'SIGTERM')
      }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ESRCH')
          throw error
      }
    }
  }
}

async function verifyPreview(directory: string) {
  const npmExecPath = process.env.npm_execpath
  const args = ['run', 'preview', '--host', '127.0.0.1', '--port', '0']
  const options = { cwd: directory, detached: process.platform !== 'win32', env: { NO_COLOR: '1', FORCE_COLOR: '0' } }
  const preview = npmExecPath && /\.(?:c|m)?js$/u.test(npmExecPath)
    ? execa(process.execPath, [npmExecPath, ...args], options)
    : execa('pnpm', args, options)
  const completion = preview.catch(() => undefined)
  try {
    const url = await new Promise<string>((resolveUrl, reject) => {
      let output = ''
      const timeout = setTimeout(() => reject(new Error(`Preview did not start: ${output}`)), 30_000)
      void completion.then(() => {
        clearTimeout(timeout)
        reject(new Error(`Preview exited before becoming ready: ${output}`))
      })
      preview.stdout?.on('data', (chunk) => {
        output += chunk.toString()
        const url = output.match(/http:\/\/127\.0\.0\.1:\d+\//u)?.[0]
        if (url) {
          clearTimeout(timeout)
          resolveUrl(url)
        }
      })
      preview.stderr?.on('data', (chunk) => {
        output += chunk.toString()
      })
    })
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    expect(response.status).toBe(200)
    expect(await response.text()).toContain('<html')
  }
  finally {
    await stopPreview(preview.pid)
    await completion
  }
}

beforeAll(async () => {
  // macOS aliases /var to /private/var; compare canonical paths for isolation.
  temporaryRoot = await realpath(await mkdtemp(join(tmpdir(), 'create-adv-packed-')))
  packs = join(temporaryRoot, 'packs')
  await mkdir(packs)
  const result = await runPnpm(['-C', 'packages/create-adv', 'pack', '--pack-destination', packs, '--json'], { cwd: root })
  const tarball = parsePnpmJsonOutput(result.stdout).filename
  const entries = readTarEntries(await readFile(tarball))
  for (const file of ['bin/index.mjs', 'dist/index.mjs', 'templates/template-adv/package.json', 'templates/template-plugin/_gitignore'])
    expect(entries.has(`package/${file}`), file).toBe(true)
  const installRoot = join(temporaryRoot, 'cli')
  await mkdir(installRoot)
  await writeFile(join(installRoot, 'package.json'), JSON.stringify({ private: true, dependencies: { 'create-adv': `file:${tarball}` } }))
  await writeLaunchWorkspaceConfig(installRoot)
  await runPnpm(['install', '--no-frozen-lockfile'], { cwd: installRoot })
  bin = join(installRoot, 'node_modules/create-adv/bin/index.mjs')
  expect(relative(temporaryRoot, await realpath(bin))).not.toMatch(/^\.\./u)
}, 120_000)

afterAll(async () => {
  if (temporaryRoot)
    await rm(temporaryRoot, { recursive: true, force: true })
}, 120_000)

describe('packed create-adv', () => {
  it('prints help/version without prompting or creating a project', async () => {
    expect((await run(['--help'])).stdout).toContain('--template')
    const pkg = JSON.parse(await readFile(join(root, 'packages/create-adv/package.json'), 'utf8'))
    expect((await run(['--version'])).stdout.trim()).toBe(pkg.version)
  })

  it('prints the version without CI log prefixes', async () => {
    const pkg = JSON.parse(await readFile(join(root, 'packages/create-adv/package.json'), 'utf8'))
    const result = await runCommand(process.execPath, [bin, '--version'], {
      cwd: temporaryRoot,
      env: { CI: '1', NODE_ENV: 'production', TEST: 'false', NODE_PATH: undefined },
      timeout: 30_000,
    })
    expect(result.stdout.trim()).toBe(pkg.version)
  })

  it('honors template aliases, nested paths, and normalized package names', async () => {
    const directory = join(temporaryRoot, 'Nested Path', 'My Plugin')
    await run([directory, '-t', 'plugin', '-y'])
    const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
    expect(pkg.name).toBe('my-plugin')
    expect(pkg.scripts.build).toBe('unbuild')
    expect((await stat(join(directory, '.gitignore'))).isFile()).toBe(true)
    expect((await stat(join(directory, 'src/plugin.ts'))).isFile()).toBe(true)
  })

  it('preserves numeric directory names without coercion', async () => {
    await run(['001', '--yes'])
    expect(JSON.parse(await readFile(join(temporaryRoot, '001/package.json'), 'utf8')).name).toBe('001')
    await expect(stat(join(temporaryRoot, '1'))).rejects.toThrow()
  })

  it('rejects unattended remote themes before mutation or helper execution', async () => {
    const directory = join(temporaryRoot, 'remote-theme')
    const mocks = join(temporaryRoot, 'mock-bin')
    const invoked = join(temporaryRoot, 'helper-invoked')
    await mkdir(mocks)
    const mockScript = `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(invoked)}, 'invoked'); process.exitCode = 42;`
    await writeFile(join(mocks, 'npx.mjs'), mockScript)
    if (process.platform === 'win32')
      await writeFile(join(mocks, 'npx.cmd'), `@"${process.execPath}" "%~dp0\\npx.mjs" %*\r\n`)
    else
      await writeFile(join(mocks, 'npx'), `#!/usr/bin/env node\n${mockScript}`, { mode: 0o755 })
    const options = {
      cwd: temporaryRoot,
      env: { NODE_ENV: 'production', TEST: 'false', PATH: `${mocks}${delimiter}${process.env.PATH || ''}` },
      timeout: 30_000,
    }
    const args = [bin, directory, '--template', 'theme', '--yes']
    await expect(runCommand(process.execPath, args, options)).rejects.toThrow('does not support --yes')
    await expect(stat(directory)).rejects.toThrow()
    await mkdir(directory)
    await writeFile(join(directory, 'keep.txt'), 'keep')
    await expect(runCommand(process.execPath, args, options)).rejects.toThrow('does not support --yes')
    expect(await readFile(join(directory, 'keep.txt'), 'utf8')).toBe('keep')
    await expect(stat(invoked)).rejects.toThrow()
  })

  it('supports the current directory and preserves .git', async () => {
    const directory = join(temporaryRoot, 'current')
    await mkdir(join(directory, '.git'), { recursive: true })
    await writeFile(join(directory, '.git/keep'), 'keep')
    await run(['.', '--yes'], directory)
    expect(JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')).name).toBe('current')
    expect(await readFile(join(directory, '.git/keep'), 'utf8')).toBe('keep')
  })

  it('fails safely for invalid templates, files, and nonempty directories', async () => {
    await expect(run(['invalid', '-t', 'missing', '-y'])).rejects.toThrow('Unknown template')
    const directory = join(temporaryRoot, 'occupied')
    await mkdir(directory)
    await writeFile(join(directory, 'package.json'), 'do not replace')
    await expect(run([directory, '-y'])).rejects.toThrow('not empty')
    expect(await readFile(join(directory, 'package.json'), 'utf8')).toBe('do not replace')
    await expect(run([join(directory, 'package.json'), '-y'])).rejects.toThrow('not a directory')
  })

  it('installs and builds a generated game and plugin outside the monorepo', async () => {
    const manifest = await createPackageManifest({
      root,
      outputDirectory: packs,
      build: process.env.ADVJS_PACKED_INSTALL_SKIP_BUILD !== '1',
    })
    const overrides = Object.fromEntries(manifest.packages.map(pkg => [pkg.name, `file:${join(packs, pkg.tarball!)}`]))
    for (const template of ['adv', 'plugin']) {
      const directory = join(temporaryRoot, `build-${template}`)
      await run([directory, '--template', template, '--yes'])
      const pkg = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8'))
      const engine = JSON.parse(await readFile(join(root, 'packages/advjs/package.json'), 'utf8'))
      expect(Object.values(pkg.devDependencies)).toContain(`^${engine.version}`)
      expect(JSON.stringify(pkg)).not.toContain('$ADVJS_VERSION')
      await writeLaunchWorkspaceConfig(directory, overrides)
      await runPnpm(['install', '--no-frozen-lockfile'], { cwd: directory, timeout: 180_000 })
      expect(relative(directory, await realpath(join(directory, 'node_modules/.pnpm')))).not.toMatch(/^\.\./u)
      if (template === 'adv')
        await runPnpm(['run', 'check'], { cwd: directory, timeout: 120_000 })
      await runPnpm(['run', 'build'], { cwd: directory, timeout: 120_000 })
      expect((await stat(join(directory, template === 'adv' ? 'dist/index.html' : 'dist/index.mjs'))).isFile()).toBe(true)
      if (template === 'adv')
        await verifyPreview(directory)
    }
  }, 900_000)
})
