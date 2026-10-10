import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
// eslint-disable-next-line test/no-import-node-test
import test from 'node:test'
import { runForge } from './forge.mjs'
import progress from './progress.cjs'

test('packaging progress is structured and completes callback-style hooks once', () => {
  const messages = []
  const completed = []
  const hook = progress.packagerProgressHook('copied-runtime-resources', message => messages.push(message))
  const result = hook('C:\\build path', '44.4.5', 'win32', 'x64', (...args) => completed.push(args))
  assert.equal(result, undefined)
  assert.deepEqual(completed, [[]])
  assert.deepEqual(JSON.parse(messages[0].slice('[desktop:forge] '.length)), {
    stage: 'copied-runtime-resources',
    buildPath: 'C:\\build path',
    electronVersion: '44.4.5',
    platform: 'win32',
    arch: 'x64',
  })
})

test('a diagnostic write error cannot leave a Packager hook pending', () => {
  const failure = new Error('output closed')
  const completed = []
  const hook = progress.packagerProgressHook('created-asar', () => {
    throw failure
  })
  assert.doesNotThrow(() => hook('/build', '44.4.5', 'linux', 'x64', error => completed.push(error)))
  assert.deepEqual(completed, [failure])
})

test('Forge logs loading and completion without enabling interactive prompts', async () => {
  for (const command of ['package', 'make']) {
    const calls = []
    const stages = []
    await runForge(command, ['--platform=win32', '--arch=x64'], {
      host: { platform: 'win32', arch: 'x64' },
      environment: {},
      report: stage => stages.push(stage),
      loadForge: async () => ({ api: { [command]: async options => calls.push(options) } }),
    })
    assert.deepEqual(stages, ['loading-forge', 'starting-forge', 'completed-forge'])
    assert.equal(calls.length, 1)
    assert.equal(calls[0].interactive, false)
    assert.equal(calls[0].platform, 'win32')
    assert.equal(calls[0].arch, 'x64')
  }
})

test('Windows CI enables only Packager diagnostics before importing Forge', async () => {
  for (const platform of ['win32', 'linux']) {
    const environment = { CI: 'true', DEBUG: 'existing:*' }
    await runForge('package', [], {
      host: { platform, arch: 'x64' },
      environment,
      report: () => {},
      loadForge: async () => {
        assert.equal(environment.DEBUG, platform === 'win32' ? 'existing:*,electron-packager' : 'existing:*')
        return { api: { package: async () => {} } }
      },
    })
  }
})

test('Forge failures propagate without a misleading completion event', async () => {
  const stages = []
  await assert.rejects(runForge('make', [], {
    host: { platform: 'linux', arch: 'x64' },
    report: stage => stages.push(stage),
    loadForge: async () => ({ api: { make: async () => { throw new Error('packaging failed') } } }),
  }), /packaging failed/)
  assert.deepEqual(stages, ['loading-forge', 'starting-forge'])
  await assert.rejects(runForge('publish'), /Unknown Forge command/)
})

test('diagnostic hooks keep packaging, runtime resources and the ZIP maker enabled', () => {
  const require = createRequire(import.meta.url)
  const config = require('../forge.config.cjs')
  for (const name of ['beforeAsar', 'afterAsar', 'beforeCopyExtraResources', 'afterCopyExtraResources', 'afterComplete'])
    assert.equal(config.packagerConfig[name].length, 1)
  assert.equal(config.packagerConfig.asar, true)
  assert.ok(config.packagerConfig.extraResource.some(path => path.endsWith('runtime')))
  assert.equal(typeof config.hooks.packageAfterCopy, 'function')
  assert.equal(typeof config.hooks.preMake, 'function')
  assert.equal(typeof config.hooks.postMake, 'function')
  assert.deepEqual(config.makers[0].platforms, ['darwin', 'win32', 'linux'])
})
