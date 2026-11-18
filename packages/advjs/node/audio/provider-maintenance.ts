import type { AdvConfig, AdvVoiceSynthesisProvider, VoiceCleanupPlan, VoiceCleanupSelection, VoiceProviderMaintenancePort, VoiceResourceInfo } from '@advjs/types'
import { createHash, randomUUID } from 'node:crypto'
import { lstat, mkdir, readdir, readFile, realpath, rename, rm, statfs } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'pathe'
import { resolveAuthoringVoiceContext } from '../commands/voice'
import { withProjectWriteLock } from '../project/write-lock'
import { withVoiceProviderPermit } from './provider-permit'
import { readVoiceProviderState, setVoiceProviderEnabled } from './provider-state'

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
function inside(root: string, path: string) {
  const name = relative(root, path)
  return name === '' || (!isAbsolute(name) && name !== '..' && !name.startsWith('../'))
}
const coordinate = (path: string) => typeof path === 'string' && path && !isAbsolute(path) && !path.includes('\\') && !path.includes(':') && path.split('/').every(part => part && !['.', '..', '.git'].includes(part))

async function tree(path: string) {
  const hash = createHash('sha256')
  let bytes = 0
  let allocatedBytes = 0
  const queue = [path]
  for (let offset = 0; offset < queue.length;) {
    if (queue.length > 200_000)
      throw new Error('VOICE_RESOURCE_SCAN_LIMIT')
    const files = queue.slice(offset, offset + 32)
    const entries = await Promise.all(files.map(async file => ({ file, info: await lstat(file) })))
    // Bounded parallel metadata reads, deterministic fingerprint ordering.
    for (const { file, info } of entries) {
      hash.update(JSON.stringify([relative(path, file), info.ino, info.dev, info.size, info.mtimeMs, info.isSymbolicLink()]))
      if (info.isDirectory()) {
        const names = (await readdir(file)).sort()
        queue.push(...names.map(name => resolve(file, name)))
      }
      else {
        bytes += info.size
        if (info.nlink <= 1)
          allocatedBytes += info.blocks * 512
      }
    }
    offset += files.length
  }
  return { fingerprint: hash.digest('hex'), bytes, allocatedBytes }
}

/** Host-owned resource registry: the client sends IDs, never filesystem paths. */
export async function createVoiceProviderMaintenance(options: { root: string, config?: Partial<AdvConfig> }): Promise<VoiceProviderMaintenancePort> {
  const root = await realpath(options.root)
  const plans = new Map<string, { plan: VoiceCleanupPlan, fingerprints: Record<string, string>, state: string }>()
  async function configured(id?: string) {
    return resolveAuthoringVoiceContext({ root, config: options.config, provider: id, allowDisabled: true })
  }
  async function installation(provider: AdvVoiceSynthesisProvider) {
    const source = provider.installation
    if (!source)
      return undefined
    if (!isAbsolute(source.root) || (await lstat(source.root)).isSymbolicLink())
      throw new Error('VOICE_INSTALLATION_UNTRUSTED')
    const directory = await realpath(source.root)
    if (inside(root, directory) || (inside(directory, root) && !source.protectedPaths?.some(path => coordinate(path) && inside(resolve(directory, path), root))))
      throw new Error('VOICE_INSTALLATION_OVERLAPS_PROJECT')
    const markerPath = resolve(directory, '.advjs-voice-installation.json')
    if ((await lstat(markerPath)).isSymbolicLink())
      throw new Error('VOICE_INSTALLATION_UNTRUSTED')
    const marker = JSON.parse(await readFile(markerPath, 'utf8'))
    if (marker.schemaVersion !== 1 || marker.id !== source.id || marker.providerId !== provider.id || digest(marker.resources) !== digest(source.resources) || digest(marker.protectedPaths) !== digest(source.protectedPaths))
      throw new Error('VOICE_INSTALLATION_UNTRUSTED')
    if (!Array.isArray(source.protectedPaths) || !source.protectedPaths.length || !source.protectedPaths.every(coordinate) || new Set(source.resources.map(resource => resource.id)).size !== source.resources.length)
      throw new Error('VOICE_INSTALLATION_UNTRUSTED')
    for (const resource of source.resources) {
      if (!coordinate(resource.path) || !/^[a-z][\w.-]{0,127}$/u.test(resource.id) || !['cache', 'environment', 'model'].includes(resource.kind))
        throw new Error('VOICE_RESOURCE_UNTRUSTED')
      const target = resolve(directory, resource.path)
      for (const protectedPath of source.protectedPaths) {
        const protectedTarget = resolve(directory, protectedPath)
        if (inside(target, protectedTarget) || inside(protectedTarget, target))
          throw new Error('VOICE_RESOURCE_PROTECTED')
      }
      if (source.resources.some(other => other.id !== resource.id && (inside(target, resolve(directory, other.path)) || inside(resolve(directory, other.path), target))))
        throw new Error('VOICE_RESOURCE_OVERLAP')
    }
    return { ...source, root: directory }
  }
  async function inspect(provider: AdvVoiceSynthesisProvider) {
    const managed = await installation(provider)
    const resources: VoiceResourceInfo[] = []
    const fingerprints: Record<string, string> = {}
    if (managed) {
      for (const item of managed.resources) {
        const path = resolve(managed.root, item.path)
        const entry: VoiceResourceInfo = { id: item.id, label: item.label, kind: item.kind, location: path, bytes: 0, allocatedBytes: 0, sharedWith: item.sharedWith ?? [], available: false }
        try {
          if ((await lstat(path)).isSymbolicLink() || !inside(managed.root, await realpath(path)) || await realpath(path) !== path)
            throw new Error('VOICE_RESOURCE_LINK_CHANGED')
          const scanned = await tree(path)
          Object.assign(entry, { bytes: scanned.bytes, allocatedBytes: scanned.allocatedBytes, available: Boolean(managed.isRunning), ...(!managed.isRunning ? { blockedReason: '安装未登记占用检查，无法安全清理' } : {}) })
          fingerprints[item.id] = scanned.fingerprint
        }
        catch (error) {
          entry.blockedReason = (error as NodeJS.ErrnoException).code === 'ENOENT' ? '资源不存在' : '路径、链接或内容不能安全清理'
        }
        resources.push(entry)
      }
    }
    return { managed, resources, fingerprints, running: Boolean(await managed?.isRunning?.()) }
  }
  async function provider(id: string) {
    const selected = (await configured(id)).provider
    if (!('synthesize' in selected))
      throw new Error('VOICE_MAINTENANCE_UNSUPPORTED')
    return selected
  }
  function selection(input: VoiceCleanupSelection) {
    if (!input || typeof input.providerId !== 'string' || !Array.isArray(input.resourceIds) || input.resourceIds.some(id => typeof id !== 'string') || new Set(input.resourceIds).size !== input.resourceIds.length || typeof input.allowShared !== 'boolean' || Object.keys(input).some(key => !['providerId', 'resourceIds', 'allowShared'].includes(key)))
      throw new Error('VOICE_CLEANUP_INPUT_INVALID')
  }
  return {
    async read() {
      const loaded = await configured()
      const disabled = await readVoiceProviderState(root)
      const providers = []
      for (const item of loaded.providers) {
        if (!('synthesize' in item))
          continue
        const info = await inspect(item)
        providers.push({ id: item.id, enabled: !disabled.includes(item.id), managed: Boolean(info.managed), running: info.running, canStop: Boolean(info.managed?.stop), resources: info.resources })
      }
      return { providers }
    },
    async stop(id, signal) {
      const selected = await provider(id)
      const managed = await installation(selected)
      if (!managed?.stop)
        throw new Error('VOICE_SERVICE_NOT_MANAGED')
      await withVoiceProviderPermit(id, 1, signal ?? new AbortController().signal, async () => {
        signal?.throwIfAborted()
        await managed.stop!({ root, signal })
        if (await managed.isRunning?.())
          throw new Error('VOICE_SERVICE_STILL_RUNNING')
      })
    },
    async enable(id, signal) {
      await provider(id)
      signal?.throwIfAborted()
      await withProjectWriteLock(root, () => setVoiceProviderEnabled(root, id, true))
    },
    async plan(input, signal) {
      selection(input)
      signal?.throwIfAborted()
      const selected = await provider(input.providerId)
      const info = await inspect(selected)
      const resources = input.resourceIds.map((id) => {
        const resource = info.resources.find(item => item.id === id)
        if (!resource?.available)
          throw new Error('VOICE_RESOURCE_UNAVAILABLE')
        if (resource.sharedWith.length && !input.allowShared)
          throw new Error('VOICE_SHARED_RESOURCE_CONFIRMATION_REQUIRED')
        return resource
      })
      if (resources.length && info.running)
        throw new Error('VOICE_RESOURCES_IN_USE: Stop the managed service before reviewing removal')
      const id = randomUUID()
      const command = selected.packageName && /^(?:@[a-z\d._-]+\/)?[a-z\d._-]+$/u.test(selected.packageName) ? `pnpm remove ${selected.packageName}` : '使用项目包管理器移除对应供应商插件包'
      const plan: VoiceCleanupPlan = { ...input, id, hash: '', resources, expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(), totalBytes: resources.reduce((sum, resource) => sum + resource.bytes, 0), preserved: ['参考录音', '已生成及已登记配音', '音色库与对白账本', ...(info.managed?.protectedPaths ?? [])], packageRemovalCommand: command }
      plan.hash = digest(plan)
      if (plans.size >= 20)
        plans.delete(plans.keys().next().value!)
      plans.set(id, { plan, fingerprints: Object.fromEntries(input.resourceIds.map(id => [id, info.fingerprints[id]!])), state: digest(await readVoiceProviderState(root)) })
      return structuredClone(plan)
    },
    async execute(input, signal) {
      const saved = plans.get(input.id)
      if (!saved || saved.plan.hash !== input.hash || Date.parse(saved.plan.expiresAt) < Date.now())
        throw new Error('VOICE_CLEANUP_PLAN_EXPIRED')
      return withVoiceProviderPermit(saved.plan.providerId, 1, signal ?? new AbortController().signal, async () => withProjectWriteLock(root, async () => {
        signal?.throwIfAborted()
        const selected = await provider(saved.plan.providerId)
        const current = await inspect(selected)
        if ((current.running && saved.plan.resourceIds.length) || digest(await readVoiceProviderState(root)) !== saved.state || saved.plan.resourceIds.some(id => current.fingerprints[id] !== saved.fingerprints[id]))
          throw new Error('VOICE_CLEANUP_PLAN_STALE')
        plans.delete(input.id)
        const before = await statfs(current.managed?.root ?? root)
        const moved: Array<{ from: string, to: string }> = []
        const quarantine = saved.plan.resourceIds.length && current.managed ? resolve(current.managed.root, `.advjs-cleanup-${randomUUID()}`) : undefined
        if (saved.plan.resourceIds.length && (!current.managed || !quarantine))
          throw new Error('VOICE_INSTALLATION_UNTRUSTED')
        if (quarantine)
          await mkdir(quarantine, { mode: 0o700 })
        try {
          for (const id of saved.plan.resourceIds) {
            const resource = current.managed!.resources.find(resource => resource.id === id)!
            const from = resolve(current.managed!.root, resource.path)
            const to = resolve(quarantine!, id)
            await rename(from, to)
            moved.push({ from, to })
          }
          await setVoiceProviderEnabled(root, selected.id, false)
        }
        catch (error) {
          for (const item of moved.reverse())
            await rename(item.to, item.from)
          if (quarantine)
            await rm(quarantine, { recursive: true, force: true })
          throw error
        }
        if (quarantine)
          await rm(quarantine, { recursive: true, force: true })
        const after = await statfs(current.managed?.root ?? root)
        return { providerId: selected.id, disabled: true, removed: saved.plan.resourceIds, removedBytes: saved.plan.totalBytes, availableSpaceDelta: (after.bavail - before.bavail) * after.bsize, packageRemoved: false }
      }))
    },
  }
}
