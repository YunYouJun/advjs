import assert from 'node:assert/strict'
import fs from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { resolve, sep, win32 } from 'node:path'
import process from 'node:process'
// These packaging checks run directly in Node on every native release runner.
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'
import { assertDesktopVersion, desktopArtifactName, parseDesktopOptions, resolveDesktopTarget } from './config.mjs'
import { needsDesktopBuild, runDesktop } from './run.mjs'
import { stageRuntime } from './runtime.mjs'

test('release versions and artifact names reject malformed tags and paths', () => {
  for (const version of ['0.1.5', '1.2.3-beta.1', '1.2.3+build.5']) {
    assert.equal(assertDesktopVersion(version), version)
    assert.equal(desktopArtifactName(version, 'darwin', 'arm64'), `advjs-desktop-${version}-darwin-arm64.zip`)
  }
  for (const version of ['', 'v1.2.3', 'desktop-v1.2.3', '../1.2.3', '1.2', '01.2.3', '1.2.3-beta.01', '1.2.3\n', undefined])
    assert.throws(() => assertDesktopVersion(version), /Invalid desktop version/)
})

test('explicit targets require native dependencies from the matching host', () => {
  for (const [platform, arch] of [['darwin', 'arm64'], ['darwin', 'x64'], ['win32', 'x64'], ['linux', 'x64']])
    assert.deepEqual(resolveDesktopTarget({ platform, arch }, { platform, arch }), { platform, arch })
  assert.throws(() => resolveDesktopTarget({ arch: 'x64' }, { platform: 'darwin', arch: 'arm64' }), /matching native runner/)
  assert.throws(() => resolveDesktopTarget({ platform: 'win32' }, { platform: 'linux', arch: 'x64' }), /matching native runner/)
  assert.throws(() => resolveDesktopTarget({}, { platform: 'linux', arch: 'arm64' }), /Unsupported desktop target/)
  assert.deepEqual(parseDesktopOptions(['--', '--platform', 'darwin', '--arch=arm64', '--rebuild']), { platform: 'darwin', arch: 'arm64', rebuild: true })
  assert.throws(() => parseDesktopOptions(['--arch']), /Missing value/)
  assert.throws(() => parseDesktopOptions(['--publish']), /Unknown desktop option/)
})

test('dev builds prerequisites only when missing or explicitly requested', async () => {
  for (const [missing, args, expected] of [[false, [], 0], [true, [], 2], [false, ['--rebuild'], 2]]) {
    const calls = []
    const commands = []
    await runDesktop('dev', args, {
      host: { platform: 'darwin', arch: 'arm64' },
      needsBuild: async () => missing,
      runPnpm: async (args, options) => calls.push({ args, options }),
      developmentExecutable: async () => 'advjs-editor-dev',
      runCommand: async (command, args) => commands.push({ command, args }),
    })
    assert.equal(calls.length, expected)
    assert.equal(commands.at(-1).command, 'advjs-editor-dev')
    assert.equal(commands.at(-1).args.length, 1)
    if (expected) {
      assert.deepEqual(calls[0].args, ['prepare:workspace', 'editor'])
      assert.equal(calls[1].options.env.ADVJS_EDITOR_MODE, 'local')
    }
  }
})

test('dev detects missing clean-checkout artifacts without spawning a build', async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), 'advjs-build-state-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  assert.equal(await needsDesktopBuild(root), true)
  for (const file of ['packages/advjs/dist/node/index.mjs', 'packages/core/dist/index.mjs', 'packages/parser/dist/index.mjs', 'editor/core/dist/index.html']) {
    await mkdir(resolve(root, file, '..'), { recursive: true })
    await writeFile(resolve(root, file), '')
  }
  assert.equal(await needsDesktopBuild(root), false)
})

test('Windows packaging runs Forge inside the staged app without changing build or staging cwd', async () => {
  const root = resolve(import.meta.dirname, '..')
  const repository = resolve(root, '../..')
  for (const command of ['package', 'make']) {
    const builds = []
    const calls = []
    await runDesktop(command, ['--platform=win32', '--arch=x64'], {
      host: { platform: 'win32', arch: 'x64' },
      runPnpm: async (args, options) => builds.push({ args, options }),
      runCommand: async (executable, args, options) => calls.push({ executable, args, options }),
    })
    assert.equal(builds.length, 2)
    assert.ok(builds.every(call => call.options.cwd === repository))
    assert.deepEqual(calls.map(call => call.args[0]), ['build.mjs', 'stage.mjs', 'forge.mjs'].map(file => resolve(root, 'scripts', file)))
    assert.deepEqual(calls.map(call => call.options.cwd), [repository, repository, resolve(root, '.build/app')])
    assert.deepEqual(calls[2].args.slice(1), [command, '--platform=win32', '--arch=x64'])
    assert.equal(calls[2].options.stdout, 'inherit')
    assert.equal(calls[2].options.stderr, 'inherit')
  }
})

test('staged cwd bounds the Windows Forge cleanup glob instead of walking workspace dependencies', async (context) => {
  const root = await mkdtemp(resolve(tmpdir(), 'advjs-forge-cwd-'))
  context.after(() => rm(root, { recursive: true, force: true }))
  const staged = resolve(root, 'apps/desktop/.build/app')
  const unrelated = resolve(root, 'node_modules/unrelated/nested')
  await mkdir(resolve(staged, 'dist'), { recursive: true })
  await mkdir(unrelated, { recursive: true })
  await writeFile(resolve(staged, 'dist/main.mjs'), '')
  const require = createRequire(import.meta.url)
  const forgeRequire = createRequire(require.resolve('@electron-forge/core'))
  const glob = forgeRequire('fast-glob')
  // Forge 7 constructs this pattern with path.join. Backslashes make its
  // search base '.', so it walks cwd but does not match the intended .bin
  // entries. Our staged app intentionally has no node_modules or .bin files;
  // the independently staged runtime is not subject to this cleanup.
  const pattern = win32.join('C:\\Temp\\electron-packager\\resources\\app', '**/.bin/**/*')
  async function scannedDirectories(cwd) {
    const visited = []
    const matches = await glob(pattern, {
      cwd,
      fs: {
        readdir(path, ...args) {
          visited.push(resolve(String(path)))
          fs.readdir(path, ...args)
        },
      },
    })
    assert.deepEqual(matches, [])
    return visited
  }
  assert.ok((await scannedDirectories(root)).includes(unrelated))
  const visited = await scannedDirectories(staged)
  assert.ok(visited.length > 0)
  assert.ok(visited.every(path => path === staged || path.startsWith(`${staged}${sep}`)))
  assert.ok(!visited.includes(unrelated))
  assert.ok(!(await readdir(staged)).includes('node_modules'))
})

test('runtime survives relocation with duplicate versions, peer variants, sibling shadowing and cycles', async (context) => {
  const folder = await mkdtemp(resolve(tmpdir(), 'advjs-runtime-test-'))
  context.after(() => rm(folder, { recursive: true, force: true }))
  const source = resolve(folder, 'source')
  const project = resolve(source, 'project')
  const packages = new Map()
  async function pkg(id, name, version, code, dependencies = {}, peers = {}) {
    const path = resolve(source, 'packages', id)
    packages.set(id, path)
    await mkdir(path, { recursive: true })
    await writeFile(resolve(path, 'package.json'), JSON.stringify({ name, version, main: 'index.cjs', dependencies, peerDependencies: peers }))
    await writeFile(resolve(path, 'index.cjs'), code)
  }
  async function link(from, name, id) {
    const path = resolve(from, 'node_modules', name)
    await mkdir(resolve(path, '..'), { recursive: true })
    await symlink(packages.get(id), path, process.platform === 'win32' ? 'junction' : 'dir')
  }
  await pkg('app', 'app', '1.0.0', 'module.exports = [require("seed"), require("left"), require("right"), require("a").value()]', { seed: '*', left: '*', right: '*', a: '*' })
  await pkg('seed', 'seed', '1.0.0', 'module.exports = require("plugin")', { plugin: '*' })
  await pkg('left', 'left', '1.0.0', 'module.exports = [require("plugin"), require("bridge")]', { plugin: '*', bridge: '*' })
  await pkg('right', 'right', '1.0.0', 'module.exports = require("plugin")', { plugin: '*' })
  await pkg('bridge', 'bridge', '1.0.0', 'module.exports = require("plugin")', { plugin: '*' })
  await pkg('plugin1', 'plugin', '1.0.0', 'module.exports = "plugin1:" + require("peer")', {}, { peer: '*' })
  await pkg('plugin2', 'plugin', '1.0.0', 'module.exports = "plugin1:" + require("peer")', {}, { peer: '*' })
  await pkg('plugin3', 'plugin', '2.0.0', 'module.exports = "plugin2:" + require("peer")', {}, { peer: '*' })
  await pkg('peer1', 'peer', '1.0.0', 'module.exports = "peer1"')
  await pkg('peer2', 'peer', '2.0.0', 'module.exports = "peer2"')
  await pkg('a', 'a', '1.0.0', 'exports.name = "a"; exports.value = () => require("b").value()', { b: '*' })
  await pkg('b', 'b', '1.0.0', 'exports.value = () => require("a").name + "b"', { a: '*' })
  await link(project, 'app', 'app')
  for (const [from, name, id] of [
    ['app', 'seed', 'seed'],
    ['app', 'left', 'left'],
    ['app', 'right', 'right'],
    ['app', 'a', 'a'],
    ['seed', 'plugin', 'plugin1'],
    ['left', 'plugin', 'plugin2'],
    ['left', 'bridge', 'bridge'],
    ['right', 'plugin', 'plugin3'],
    ['bridge', 'plugin', 'plugin1'],
    ['plugin1', 'peer', 'peer1'],
    ['plugin2', 'peer', 'peer2'],
    ['plugin3', 'peer', 'peer1'],
    ['a', 'b', 'b'],
    ['b', 'a', 'a'],
  ])
    await link(packages.get(from), name, id)
  // A nested ignored directory must not leak into the packaged source tree.
  await mkdir(resolve(packages.get('app'), '.git'), { recursive: true })
  await writeFile(resolve(packages.get('app'), '.git/secret'), 'excluded')
  const before = createRequire(resolve(project, 'probe.cjs'))('app')
  assert.deepEqual(before, ['plugin1:peer1', ['plugin1:peer2', 'plugin1:peer1'], 'plugin2:peer1', 'ab'])
  const staged = resolve(folder, 'stage')
  const result = await stageRuntime({ name: 'app', from: project, destination: staged })
  assert.equal(result.packages, packages.size)
  assert.ok(result.copies >= result.packages)
  const relocated = resolve(folder, '移出 仓库')
  await rename(staged, relocated)
  await rm(source, { recursive: true, force: true })
  assert.deepEqual(createRequire(resolve(relocated, 'probe.cjs'))('app'), before)
  assert.ok(!(await readdir(resolve(relocated, 'node_modules/app'))).includes('.git'))
  async function noLinks(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      assert.equal(entry.isSymbolicLink(), false)
      if (entry.isDirectory())
        await noLinks(resolve(directory, entry.name))
    }
  }
  await noLinks(relocated)
  assert.equal(JSON.parse(await readFile(resolve(relocated, 'node_modules/plugin/package.json'), 'utf8')).version, '1.0.0')
})
