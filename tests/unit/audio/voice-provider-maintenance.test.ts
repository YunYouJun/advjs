// @vitest-environment node
import type { VoiceManagedInstallation } from '@advjs/types'
import { mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createVoiceProviderMaintenance } from '../../../packages/advjs/node/audio/provider-maintenance'
import { createNodeVoiceDesignHost } from '../../../packages/advjs/node/audio/voice-design'
import { runVoicePreview, runVoiceProviders } from '../../../packages/advjs/node/commands/voice'
import { createEditorVoiceJobsFixture } from '../../fixtures/audio/editor-voice-jobs'

async function fixture() {
  const source = await createEditorVoiceJobsFixture()
  const root = join(source.directory, 'installation')
  const resources: VoiceManagedInstallation['resources'] = [
    { id: 'cache', kind: 'cache', label: 'Cache', path: 'cache' },
    { id: 'environment', kind: 'environment', label: 'Python', path: '.venv' },
    { id: 'model', kind: 'model', label: 'Model', path: 'models/weights', sharedWith: ['another local tool'] },
  ]
  for (const path of ['cache', '.venv', 'models/weights', 'output'])
    await mkdir(join(root, path), { recursive: true })
  await writeFile(join(root, 'cache/temporary'), 'cached')
  await writeFile(join(root, '.venv/library'), 'rebuildable')
  await writeFile(join(root, 'models/weights/model.bin'), 'downloadable')
  await writeFile(join(root, 'output/reference.wav'), 'unique recording')
  await writeFile(join(root, 'output/generated.wav'), 'completed generated audio')
  let running = false
  const installation: VoiceManagedInstallation = { root, id: 'test-installation', resources, protectedPaths: ['output'], isRunning: async () => running, stop: async () => {
    running = false
  } }
  source.provider.installation = installation
  async function marker() {
    await writeFile(join(root, '.advjs-voice-installation.json'), JSON.stringify({ schemaVersion: 1, id: installation.id, providerId: source.provider.id, resources: installation.resources, protectedPaths: installation.protectedPaths }))
  }
  await marker()
  const service = await createVoiceProviderMaintenance({ root: source.root, config: source.config })
  const choose = (resourceIds: string[], allowShared = false) => ({ providerId: source.provider.id, resourceIds, allowShared })
  return { ...source, installation, marker, service, choose, setRunning: (value: boolean) => {
    running = value
  } }
}

describe('voice uninstall resource review', () => {
  it('reviews without mutations, removes only selected cache and preserves all recordings and generated audio', async () => {
    const f = await fixture()
    try {
      const initial = await f.service.read()
      expect(initial.providers[0]).toMatchObject({ enabled: true, managed: true, running: false })
      const plan = await f.service.plan(f.choose(['cache']))
      expect(await readFile(join(f.installation.root, 'cache/temporary'), 'utf8')).toBe('cached')
      expect(plan.preserved).toContain('已生成及已登记配音')
      const result = await f.service.execute({ id: plan.id, hash: plan.hash })
      expect(result).toMatchObject({ disabled: true, removed: ['cache'], removedBytes: 6, packageRemoved: false })
      expect(Number.isFinite(result.availableSpaceDelta)).toBe(true)
      await expect(stat(join(f.installation.root, 'cache'))).rejects.toMatchObject({ code: 'ENOENT' })
      expect(await readFile(join(f.installation.root, 'output/reference.wav'), 'utf8')).toBe('unique recording')
      expect(await readFile(join(f.installation.root, 'output/generated.wav'), 'utf8')).toBe('completed generated audio')
      expect((await stat(join(f.installation.root, '.venv'))).isDirectory()).toBe(true)
      expect((await stat(join(f.installation.root, 'models/weights'))).isDirectory()).toBe(true)
      await expect(runVoicePreview({ root: f.root, config: f.config, list: true })).rejects.toThrow('VOICE_PROVIDER_DISABLED')
      expect((await f.service.read()).providers[0]!.enabled).toBe(false)
      expect((await runVoiceProviders({ root: f.root, config: f.config })).providers).toEqual([])
      const design = await createNodeVoiceDesignHost({ root: f.root, config: f.config })
      try {
        expect((await design.read()).providers).toEqual([])
      }
      finally {
        await design.close()
      }
      f.config.authoring!.voice!.providers!.push({ ...f.provider, id: 'other-tts', installation: undefined })
      expect((await runVoiceProviders({ root: f.root, config: f.config })).providers.map(provider => provider.id)).toEqual(['other-tts'])
      expect(await runVoicePreview({ root: f.root, config: f.config, provider: 'other-tts', list: true })).toMatchObject({ provider: 'other-tts' })
      await f.service.enable(f.provider.id)
      expect(await runVoicePreview({ root: f.root, config: f.config, list: true })).toMatchObject({ provider: f.provider.id })
      await expect(f.service.execute({ id: plan.id, hash: plan.hash })).rejects.toThrow('PLAN_EXPIRED')
    }
    finally { await rm(f.directory, { recursive: true, force: true }) }
  })
  it('requires stopping active resources and explicit shared-resource review', async () => {
    const f = await fixture()
    try {
      f.setRunning(true)
      await expect(f.service.plan(f.choose(['environment']))).rejects.toThrow('IN_USE')
      await f.service.stop(f.provider.id)
      await expect(f.service.plan(f.choose(['model']))).rejects.toThrow('SHARED_RESOURCE_CONFIRMATION_REQUIRED')
      const plan = await f.service.plan(f.choose(['model'], true))
      await f.service.execute({ id: plan.id, hash: plan.hash })
      await expect(stat(join(f.installation.root, 'models/weights'))).rejects.toMatchObject({ code: 'ENOENT' })
      expect(await readFile(join(f.installation.root, 'output/generated.wav'), 'utf8')).toBe('completed generated audio')
    }
    finally { await rm(f.directory, { recursive: true, force: true }) }
  })
  it('rejects stale resource bytes and a service restarted after review', async () => {
    const f = await fixture()
    try {
      const plan = await f.service.plan(f.choose(['cache']))
      await writeFile(join(f.installation.root, 'cache/temporary'), 'changed')
      await expect(f.service.execute({ id: plan.id, hash: plan.hash })).rejects.toThrow('PLAN_STALE')
      const next = await f.service.plan(f.choose(['environment']))
      f.setRunning(true)
      await expect(f.service.execute({ id: next.id, hash: next.hash })).rejects.toThrow('PLAN_STALE')
      expect((await f.service.read()).providers[0]!.enabled).toBe(true)
    }
    finally { await rm(f.directory, { recursive: true, force: true }) }
  })
  it('refuses top-level links and never follows nested interpreter links when removing an environment', async () => {
    const f = await fixture()
    try {
      await symlink(join(f.installation.root, 'output/reference.wav'), join(f.installation.root, '.venv/python'))
      const plan = await f.service.plan(f.choose(['environment']))
      await f.service.execute({ id: plan.id, hash: plan.hash })
      expect(await readFile(join(f.installation.root, 'output/reference.wav'), 'utf8')).toBe('unique recording')
      await rm(join(f.installation.root, 'cache'), { recursive: true })
      await symlink(join(f.installation.root, 'output'), join(f.installation.root, 'cache'))
      expect((await f.service.read()).providers[0]!.resources.find(item => item.id === 'cache')!.available).toBe(false)
      await expect(f.service.plan(f.choose(['cache']))).rejects.toThrow('UNAVAILABLE')
    }
    finally { await rm(f.directory, { recursive: true, force: true }) }
  })
  it('refuses untrusted markers, protected content, project overlap and arbitrary IDs', async () => {
    const f = await fixture()
    try {
      await expect(f.service.plan(f.choose(['../../output']))).rejects.toThrow('UNAVAILABLE')
      await writeFile(join(f.installation.root, '.advjs-voice-installation.json'), '{}')
      await expect(f.service.read()).rejects.toThrow('UNTRUSTED')
      f.installation.resources[0]!.path = 'output'
      await f.marker()
      await expect(f.service.read()).rejects.toThrow('PROTECTED')
      f.installation.root = f.root
      await expect(f.service.read()).rejects.toThrow('OVERLAPS_PROJECT')
    }
    finally { await rm(f.directory, { recursive: true, force: true }) }
  })
})
