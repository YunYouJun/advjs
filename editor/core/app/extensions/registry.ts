import type { EditorCommand, EditorPlugin, EditorPluginContext, EditorRegion, EditorService, EditorView } from '@advjs/editor-sdk'
import type { InjectionKey } from 'vue'
import { computed, inject, nextTick, reactive, shallowReactive, watch } from 'vue'

export interface PluginRegistration {
  plugin: EditorPlugin
  source: 'builtin' | 'bundled'
  required?: boolean
}

export interface PluginEntry extends PluginRegistration {
  status: 'disabled' | 'activating' | 'active' | 'error'
  error: string
  generation: number
  context?: EditorPluginContext
  abort?: () => void
  dispose?: () => void
}

export interface RegisteredView extends EditorView {
  key: string
  entry: PluginEntry
}

export type EditorHostServices = Omit<EditorPluginContext, 'signal' | 'onDispose'>

const regions: EditorRegion[] = ['navigation', 'main', 'bottom', 'inspector']
const shortId = /^[a-z][a-z0-9-]*$/u

function validate(plugin: EditorPlugin, available: readonly EditorService[]) {
  if (!/^[a-z][a-z0-9.-]*$/u.test(plugin.id) || !plugin.version || plugin.apiVersion !== 1)
    throw new Error(`Unsupported plugin identity or API version: ${plugin.id}`)
  for (const capability of plugin.requires ?? []) {
    if (!available.includes(capability))
      throw new Error(`Unavailable service: ${capability}`)
  }
  for (const items of [plugin.views ?? [], plugin.commands ?? []]) {
    const ids = new Set<string>()
    for (const item of items) {
      if (!shortId.test(item.id) || ids.has(item.id))
        throw new Error(`Invalid or duplicate contribution: ${plugin.id}/${item.id}`)
      ids.add(item.id)
    }
  }
  for (const view of plugin.views ?? []) {
    if (!regions.includes(view.region))
      throw new Error(`Unknown region: ${view.region}`)
  }
  for (const action of plugin.actions ?? []) {
    if (!plugin.commands?.some(command => command.id === action.command))
      throw new Error(`Missing command: ${action.command}`)
    const location = action.location
    if (location !== 'editor.toolbar' && !plugin.views?.some(view => view.id === location.view))
      throw new Error(`Missing view: ${location.view}`)
  }
}

export function createEditorExtensionHost(
  catalog: readonly PluginRegistration[],
  services: EditorHostServices,
  options: { disabled?: string[], available?: readonly EditorService[], persistDisabled?: (ids: string[]) => void } = {},
) {
  const ids = new Set<string>()
  const entries = catalog.map((registration) => {
    if (ids.has(registration.plugin.id))
      throw new Error(`Duplicate editor plugin: ${registration.plugin.id}`)
    ids.add(registration.plugin.id)
    return shallowReactive<PluginEntry>({ ...registration, status: 'disabled', error: '', generation: 0 })
  })
  const disabled = new Set(options.disabled ?? [])
  const commands = reactive<Record<string, { busy: boolean, error: string }>>({})
  let disposed = false
  const views = computed<RegisteredView[]>(() => entries.flatMap(entry => entry.status === 'active'
    ? (entry.plugin.views ?? []).map(view => ({ ...view, key: `${entry.plugin.id}/${view.id}`, entry }))
    : []).sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.key.localeCompare(b.key, 'en')))

  function scope(entry: PluginEntry) {
    const controller = new AbortController()
    const cleanups = new Set<() => void>()
    function onDispose(cleanup: () => void) {
      let called = false
      const once = () => {
        if (called)
          return
        called = true
        cleanups.delete(once)
        cleanup()
      }
      if (controller.signal.aborted)
        once()
      else
        cleanups.add(once)
      return once
    }
    function assertActive() {
      if (controller.signal.aborted)
        throw new Error('Plugin was disabled')
    }
    const context: EditorPluginContext = {
      locale: services.locale,
      signal: controller.signal,
      project: {
        current: services.project.current,
        async refresh() {
          assertActive()
          await services.project.refresh()
          assertActive()
        },
        subscribe(listener) {
          assertActive()
          return onDispose(services.project.subscribe((snapshot) => {
            if (!controller.signal.aborted) {
              try {
                listener(snapshot)
              }
              catch (error) { entry.error = String(error) }
            }
          }))
        },
      },
      clipboard: { async writeText(text) {
        assertActive()
        await services.clipboard.writeText(text)
        assertActive()
      } },
      notifications: { info(message) {
        if (!controller.signal.aborted)
          services.notifications.info(message)
      } },
      onDispose,
    }
    return {
      context,
      abort: () => controller.abort(),
      dispose() {
        controller.abort()
        for (const cleanup of [...cleanups]) {
          try {
            cleanup()
          }
          catch (error) { entry.error = String(error) }
        }
      },
    }
  }

  async function enable(entry: PluginEntry) {
    if (disposed || entry.status === 'active' || entry.status === 'activating')
      return
    const generation = ++entry.generation
    entry.status = 'activating'
    entry.error = ''
    const resource = scope(entry)
    entry.context = resource.context
    entry.abort = resource.abort
    entry.dispose = resource.dispose
    try {
      validate(entry.plugin, options.available ?? ['project.read', 'project.refresh', 'clipboard.write'])
      const cleanup = await entry.plugin.activate?.(resource.context)
      if (cleanup)
        resource.context.onDispose(cleanup)
      if (entry.generation !== generation || disposed)
        return
      entry.status = 'active'
    }
    catch (error) {
      resource.dispose()
      if (entry.generation !== generation || disposed)
        return
      entry.error = String(error)
      entry.status = 'error'
    }
  }

  async function disable(entry: PluginEntry) {
    ++entry.generation
    entry.status = 'disabled'
    entry.abort?.()
    entry.abort = undefined
    const dispose = entry.dispose
    entry.dispose = undefined
    entry.context = undefined
    for (const command of entry.plugin.commands ?? [])
      delete commands[`${entry.plugin.id}/${command.id}`]
    // Let Vue unmount all view instances before releasing activation resources.
    await nextTick()
    dispose?.()
  }

  function commandFor(key: string): { entry: PluginEntry, command: EditorCommand } | undefined {
    for (const entry of entries) {
      const command = entry.plugin.commands?.find(item => `${entry.plugin.id}/${item.id}` === key)
      if (command && entry.status === 'active')
        return { entry, command }
    }
  }

  function canExecute(key: string) {
    const item = commandFor(key)
    if (!item?.entry.context || commands[key]?.busy)
      return false
    try {
      return item.command.enabled?.(item.entry.context) ?? true
    }
    catch { return false }
  }

  async function execute(key: string) {
    const item = commandFor(key)
    if (!item?.entry.context || !canExecute(key))
      return
    const context = item.entry.context
    const session = services.project.current.value?.sessionId
    const state = reactive({ busy: true, error: '' })
    commands[key] = state
    try {
      await item.command.run(context)
    }
    catch (error) {
      if (commands[key] === state && item.entry.context === context && services.project.current.value?.sessionId === session)
        state.error = error instanceof Error ? error.message : String(error)
    }
    finally {
      if (commands[key] === state && item.entry.context === context)
        state.busy = false
    }
  }

  // A pending command from the previous project must not block the new session.
  // Its completion only owns the discarded state, never the next execution.
  const stop = watch(() => services.project.current.value?.sessionId, () => {
    for (const key of Object.keys(commands))
      delete commands[key]
  }, { flush: 'sync' })

  return {
    entries,
    views,
    commands,
    services,
    execute,
    canExecute,
    start: () => Promise.all(entries.filter(entry => entry.required || !disabled.has(entry.plugin.id)).map(enable)),
    async setEnabled(id: string, enabled: boolean) {
      const entry = entries.find(item => item.plugin.id === id)
      if (!entry || (!enabled && entry.required) || disposed)
        return
      enabled ? disabled.delete(id) : disabled.add(id)
      options.persistDisabled?.([...disabled])
      await (enabled ? enable(entry) : disable(entry))
    },
    async dispose() {
      if (disposed)
        return
      disposed = true
      stop()
      await Promise.all(entries.map(disable))
    },
  }
}

export type EditorExtensionHost = ReturnType<typeof createEditorExtensionHost>
export const editorExtensionHostKey: InjectionKey<EditorExtensionHost> = Symbol('editor.extension.host')
export function useEditorExtensionHost() {
  const host = inject(editorExtensionHostKey)
  if (!host)
    throw new Error('Editor extension host is unavailable')
  return host
}
