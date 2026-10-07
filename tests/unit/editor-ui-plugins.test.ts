import type { EditorPlugin, EditorProjectSnapshot, EditorRegion } from '@advjs/editor-sdk'
import type { App } from 'vue'
import type { EditorProjectModel } from '../../editor/core/app/adapters/browser/project'
import type { EditorHostServices, PluginRegistration } from '../../editor/core/app/extensions/registry'
import { editorText } from '@advjs/editor-sdk'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h, nextTick, onUnmounted, shallowRef } from 'vue'
import EditorCommandBar from '../../editor/core/app/components/extensions/EditorCommandBar.vue'
import EditorPluginManager from '../../editor/core/app/components/extensions/EditorPluginManager.vue'
import EditorRegionHost from '../../editor/core/app/components/extensions/EditorRegionHost.vue'
import { authoringCharacters } from '../../editor/core/app/composables/useAuthoringOverview'
import { contextPlugin, mergedContext } from '../../editor/core/app/extensions/builtin/context'
import { corePlugin } from '../../editor/core/app/extensions/builtin/core'
import { createEditorLayoutState, editorLayoutStateKey, restoreLayout } from '../../editor/core/app/extensions/layout-state'
import { createEditorExtensionHost, editorExtensionHostKey } from '../../editor/core/app/extensions/registry'
import { createEditorHostServices } from '../../editor/core/app/extensions/services'
import diagnosticsPlugin from '../../examples/editor-plugin-diagnostics/src'

const cleanups: Array<() => unknown> = []
let app: App | undefined
afterEach(async () => {
  app?.unmount()
  app = undefined
  for (const cleanup of cleanups.splice(0))
    await cleanup()
  document.body.innerHTML = ''
  localStorage.clear()
})

function fixture() {
  const project = shallowRef<EditorProjectSnapshot | null>({
    sessionId: 'a',
    revision: 1,
    name: 'Test story',
    files: { 'adv/glossary.md': '# 术语表\n\n天工' },
    diagnostics: [],
    counts: { chapters: 1, characters: 2, scenes: 1 },
  })
  const locale = shallowRef('en')
  const listeners = new Set<unknown>()
  const services: EditorHostServices = {
    locale,
    project: { current: project, refresh: vi.fn().mockResolvedValue(undefined), subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    } },
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    notifications: { info: vi.fn() },
  }
  return { project, locale, services, listeners }
}

function plugin(id = 'test.panel', overrides: Partial<EditorPlugin> = {}): EditorPlugin {
  return {
    id,
    version: '1.0.0',
    apiVersion: 1,
    title: { en: id },
    views: [{ id: 'view', region: 'bottom', title: { 'en': id, 'zh-CN': '测试面板' }, load: async () => ({ default: defineComponent({ setup: () => () => h('p', `${id} content`) }) }) }],
    ...overrides,
  }
}

function host(catalog: PluginRegistration[], services = fixture().services) {
  const result = createEditorExtensionHost(catalog, services)
  cleanups.push(() => result.dispose())
  return result
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

describe('editor extension lifecycle', () => {
  it('rejects conflicting IDs and isolates invalid contributions', async () => {
    expect(() => host([{ plugin: plugin(), source: 'bundled' }, { plugin: plugin(), source: 'bundled' }])).toThrow('Duplicate')
    const invalid = plugin('bad', { actions: [{ location: 'editor.toolbar', command: 'missing' }] })
    const registry = host([{ plugin: invalid, source: 'bundled' }, { plugin: plugin(), source: 'bundled' }])
    await registry.start()
    expect(registry.entries[0].status).toBe('error')
    expect(registry.views.value.map(view => view.key)).toEqual(['test.panel/view'])
  })

  it('rolls back activation resources and supports retry', async () => {
    const { services, listeners } = fixture()
    let fail = true
    const extension = plugin('retry', { activate(ctx) {
      ctx.project.subscribe(() => {})
      if (fail)
        throw new Error('Startup failed')
    } })
    const registry = host([{ plugin: extension, source: 'bundled' }], services)
    await registry.start()
    expect(listeners.size).toBe(0)
    expect(registry.views.value).toHaveLength(0)
    fail = false
    await registry.setEnabled('retry', true)
    expect(listeners.size).toBe(1)
    const signal = registry.entries[0].context!.signal
    const disabling = registry.setEnabled('retry', false)
    expect(signal.aborted).toBe(true)
    await disabling
    expect(listeners.size).toBe(0)
    await registry.setEnabled('retry', true)
    expect(listeners.size).toBe(1)
  })

  it('disposes late activation without republishing disabled views', async () => {
    const gate = deferred<() => void>()
    const cleanup = vi.fn()
    const registry = host([{ plugin: plugin('slow', { activate: () => gate.promise }), source: 'bundled' }])
    const starting = registry.start()
    await registry.setEnabled('slow', false)
    gate.resolve(cleanup)
    await starting
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(registry.views.value).toHaveLength(0)
    await registry.dispose()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('checks API and services before activation', async () => {
    const activate = vi.fn()
    const registry = createEditorExtensionHost([{ plugin: plugin('new', { apiVersion: 2 as 1, activate }), source: 'bundled' }], fixture().services)
    cleanups.push(() => registry.dispose())
    await registry.start()
    expect(activate).not.toHaveBeenCalled()
    expect(registry.entries[0].error).toContain('API version')
  })

  it('deduplicates commands and captures clipboard errors', async () => {
    const { services } = fixture()
    const gate = deferred<void>()
    vi.mocked(services.clipboard.writeText).mockReturnValueOnce(gate.promise)
    const registry = host([{ plugin: contextPlugin, source: 'builtin' }], services)
    await registry.start()
    const running = registry.execute('advjs.context/copy')
    await registry.execute('advjs.context/copy')
    expect(services.clipboard.writeText).toHaveBeenCalledTimes(1)
    expect(services.clipboard.writeText).toHaveBeenCalledWith('# Glossary\n\n# 术语表\n\n天工')
    gate.resolve()
    await running
    vi.mocked(services.clipboard.writeText).mockRejectedValueOnce(new Error('Clipboard denied'))
    await registry.execute('advjs.context/copy')
    expect(registry.commands['advjs.context/copy']).toEqual({ busy: false, error: 'Clipboard denied' })
  })

  it('releases command state on project switch and ignores the previous completion', async () => {
    const { services, project } = fixture()
    const previous = deferred<void>()
    const current = deferred<void>()
    const run = vi.fn()
      .mockImplementationOnce(async () => {
        await previous.promise
        throw new Error('Previous project failed')
      })
      .mockImplementationOnce(async () => {
        await current.promise
        throw new Error('Current project failed')
      })
    const registry = host([{ plugin: plugin('task', { commands: [{ id: 'run', title: { en: 'Run' }, run }] }), source: 'bundled' }], services)
    await registry.start()
    const oldExecution = registry.execute('task/run')
    project.value = { ...project.value!, revision: 2 }
    expect(registry.canExecute('task/run')).toBe(false)
    project.value = { ...project.value!, sessionId: 'b', revision: 1 }
    expect(registry.canExecute('task/run')).toBe(true)
    const newExecution = registry.execute('task/run')
    previous.resolve()
    await oldExecution
    expect(registry.commands['task/run']).toEqual({ busy: true, error: '' })
    current.resolve()
    await newExecution
    expect(registry.commands['task/run']).toEqual({ busy: false, error: 'Current project failed' })
  })
})

describe('project seam and restored state', () => {
  it.each(['browser', 'local'])('publishes immutable %s snapshots and excludes private handles', async (kind) => {
    const model = shallowRef({ files: { 'adv/world.md': '# World' }, compilation: { project: { chapters: [], characters: [], scenes: [] }, diagnostics: [] }, previewConfig: { secret: 'not-for-plugins' } } as unknown as EditorProjectModel)
    const workspace = shallowRef<object>({ kind, token: 'private' })
    const adapter = createEditorHostServices({ project: () => model.value, workspace: () => workspace.value, name: () => 'Example', locale: shallowRef('en'), refresh: async () => {}, writeClipboard: async () => {}, notify: () => {} })
    cleanups.push(adapter.dispose)
    const snapshot = adapter.services.project.current.value!
    expect(JSON.stringify(snapshot)).not.toContain('private')
    expect(snapshot).not.toHaveProperty('previewConfig')
    expect(Object.isFrozen(snapshot.files)).toBe(true)
    workspace.value = { kind }
    model.value = { ...model.value, files: { 'adv/world.md': '# Next' } }
    await nextTick()
    expect(adapter.services.project.current.value!.sessionId).not.toBe(snapshot.sessionId)
    expect(adapter.services.project.current.value!.files['adv/world.md']).toBe('# Next')
  })

  it('keeps legacy context semantics for root files, glossary and missing content', () => {
    const snapshot = fixture().project.value!
    expect(mergedContext({ ...snapshot, files: { 'glossary.md': 'Root glossary' } })).toBe('# Glossary\n\nRoot glossary')
    expect(mergedContext({ ...snapshot, files: {} })).toBe('')
    expect(editorText({ en: 'English' }, 'fr')).toBe('English')
  })

  it('migrates old active tabs and tolerates malformed layout storage', async () => {
    expect(restoreLayout(null, 'flow-editor').active.main).toBe('advjs.core/flow-editor')
    expect(restoreLayout({ version: 1, active: { main: 3, bottom: 'missing/view' } }).active).toEqual({ bottom: 'missing/view' })
    const registry = host([{ plugin: plugin(), source: 'bundled' }])
    await registry.start()
    const layout = createEditorLayoutState(localStorage)
    cleanups.push(layout.dispose)
    layout.select('bottom', 'missing/view')
    expect(layout.resolve('bottom', registry.views.value)).toBe('test.panel/view')
    expect(layout.state.active.bottom).toBe('missing/view')
    layout.reset()
    expect(layout.state.active).toEqual({})
  })

  it('restores disabled plugins without disabling core or discarding the selected view', async () => {
    const catalog: PluginRegistration[] = [
      { plugin: plugin('core'), source: 'builtin', required: true },
      { plugin: plugin('optional'), source: 'bundled' },
    ]
    const saved: string[][] = []
    const registry = createEditorExtensionHost(catalog, fixture().services, { persistDisabled: ids => saved.push(ids) })
    cleanups.push(() => registry.dispose())
    await registry.start()
    const layout = createEditorLayoutState(localStorage)
    cleanups.push(layout.dispose)
    layout.select('bottom', 'optional/view')
    await registry.setEnabled('optional', false)
    expect(layout.resolve('bottom', registry.views.value)).toBe('core/view')
    await registry.dispose()

    const restored = createEditorExtensionHost(catalog, fixture().services, { disabled: [...saved.at(-1)!, 'core'] })
    cleanups.push(() => restored.dispose())
    const restoredLayout = createEditorLayoutState(localStorage)
    cleanups.push(restoredLayout.dispose)
    await restored.start()
    expect(restored.views.value.map(view => view.key)).toEqual(['core/view'])
    await restored.setEnabled('optional', true)
    expect(restoredLayout.resolve('bottom', restored.views.value)).toBe('optional/view')
  })
})

describe('actual plugin panels', () => {
  async function mountRegion(catalog: PluginRegistration[], services = fixture().services, region: EditorRegion = 'bottom') {
    const registry = host(catalog, services)
    await registry.start()
    const layout = createEditorLayoutState()
    cleanups.push(layout.dispose)
    const container = document.createElement('div')
    document.body.append(container)
    app = createApp({ render: () => [h(EditorCommandBar, { toolbar: true }), h(EditorRegionHost, { region })] })
    app.provide(editorExtensionHostKey, registry)
    app.provide(editorLayoutStateKey, layout)
    app.mount(container)
    return { registry, layout, container }
  }

  it('shows the dashboard from the current SDK snapshot and shares host commands', async () => {
    const { services, project, locale } = fixture()
    locale.value = 'zh-CN'
    project.value = { ...project.value!, files: {
      'adv/world.md': '桃园世界',
      'adv/chapters/README.md': '| 章节 | 状态 |\n| --- | --- |\n| 起点 | ✅ |\n| 相遇 | 📝 |',
      'adv/characters/README.md': '| 名称 | 文件 | 定位 | 描述 |\n| --- | --- | --- | --- |\n| 刘备 | | 主角 | 桃园结义 |',
    } }
    const dashboard = { ...corePlugin, views: corePlugin.views.filter(view => view.id === 'dashboard') }
    const { container } = await mountRegion([{ plugin: dashboard, source: 'builtin' }], services, 'main')
    await vi.waitFor(() => expect(container.textContent).toContain('桃园结义'))
    expect(container.querySelector('progress')?.value).toBe(50)
    const copy = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('复制给 AI'))!
    copy.click()
    await vi.waitFor(() => expect(services.clipboard.writeText).toHaveBeenCalledTimes(1))
    project.value = { ...project.value!, sessionId: 'next', name: 'Another project', files: {} }
    await nextTick()
    expect(container.textContent).not.toContain('桃园结义')
    expect(container.textContent).toContain('Another project')
    expect(copy.disabled).toBe(true)
    project.value = null
    await nextTick()
    expect(container.textContent).toContain('打开项目以查看创作进度')
  })

  it('keeps empty table columns and skips localized character headers', () => {
    expect(authoringCharacters('| 名前 | ファイル | 役割 | 説明 |\n| :--- | --- | --- | ---: |\n| Alice | | Guide | First contact |')).toEqual([
      { name: 'Alice', role: 'Guide', description: 'First contact' },
    ])
  })

  it('lets users cancel pending activation and omits open-panel actions for command-only plugins', async () => {
    const gate = deferred<() => void>()
    const dispose = vi.fn()
    const activate = vi.fn().mockResolvedValueOnce(undefined).mockReturnValueOnce(gate.promise)
    const manager = plugin('manager', { views: [{ id: 'view', region: 'bottom', title: { en: 'Plugins' }, load: async () => ({ default: EditorPluginManager }) }] })
    const { registry, container } = await mountRegion([
      { plugin: manager, source: 'builtin', required: true },
      { plugin: plugin('slow', { views: [], activate }), source: 'bundled' },
    ])
    await vi.waitFor(() => expect(container.textContent).toContain('Enabled'))
    expect(container.textContent).not.toContain('Open panel')
    await registry.setEnabled('slow', false)
    const enabling = registry.setEnabled('slow', true)
    await nextTick()
    const cancel = container.querySelector<HTMLButtonElement>('[aria-label="Cancel activation slow"]')!
    expect(cancel.disabled).toBe(false)
    cancel.click()
    await vi.waitFor(() => expect(container.textContent).toContain('Disabled'))
    gate.resolve(dispose)
    await enabling
    expect(dispose).toHaveBeenCalledTimes(1)
    expect(registry.entries[1].status).toBe('disabled')
    expect(container.querySelector('[aria-label="Enable slow"]')).not.toBeNull()
  })

  it('renders the independent diagnostics package and executes its title action', async () => {
    const { services, locale, project } = fixture()
    project.value = { ...project.value!, diagnostics: [{ code: 'BROKEN_LINK', severity: 'error', message: 'Unknown chapter', path: 'adv/chapters/intro.adv.md', line: 8 }] }
    const { container } = await mountRegion([{ plugin: diagnosticsPlugin, source: 'bundled' }], services)
    await vi.waitFor(() => expect(container.textContent).toContain('Unknown chapter'))
    expect(container.textContent).toContain('adv/chapters/intro.adv.md:8')
    const button = [...container.querySelectorAll('button')].find(button => button.textContent?.includes('Check again'))!
    button.click()
    await vi.waitFor(() => expect(services.project.refresh).toHaveBeenCalledTimes(1))
    locale.value = 'zh-CN'
    await nextTick()
    expect(container.textContent).toContain('重新检查')
    expect(container.querySelector('[role=tab]')?.textContent).toContain('诊断')
  })

  it('renders context via the SDK, switches language and reflects a closed project', async () => {
    const { services, locale, project } = fixture()
    const { container } = await mountRegion([{ plugin: contextPlugin, source: 'builtin' }], services, 'inspector')
    await vi.waitFor(() => expect(container.textContent).toContain('Saved authoring material'))
    expect(container.textContent).toContain('Glossary')
    expect(container.textContent).not.toContain('[object Object]')
    locale.value = 'zh-CN'
    await nextTick()
    expect(container.textContent).toContain('创作上下文')
    expect(container.textContent).toContain('已保存的创作资料')
    project.value = null
    await nextTick()
    expect(container.textContent).toContain('打开项目以查看创作资料')
    expect([...container.querySelectorAll('button')].find(button => button.textContent?.includes('复制给 AI'))?.disabled).toBe(true)
  })

  it('falls back when disabled and unmounts cached views exactly once', async () => {
    const unmounted = vi.fn()
    const cached = plugin('a', { views: [{ id: 'view', region: 'bottom', title: { en: 'Cached' }, retention: 'keep-alive', load: async () => ({ default: defineComponent({ setup() {
      onUnmounted(unmounted)
      return () => h('p', 'Cached content')
    } }) }) }] })
    const { registry, layout, container } = await mountRegion([{ plugin: cached, source: 'bundled' }, { plugin: plugin('b'), source: 'bundled' }])
    await vi.waitFor(() => expect(container.textContent).toContain('Cached content'))
    layout.select('bottom', 'b/view')
    await nextTick()
    expect(unmounted).not.toHaveBeenCalled()
    await registry.setEnabled('a', false)
    expect(unmounted).toHaveBeenCalledTimes(1)
    await registry.setEnabled('b', false)
    expect(container.textContent).toContain('No panels available')
  })

  it('shows a failed loader and retries without breaking the region', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('Load failed')).mockResolvedValue({ default: defineComponent({ setup: () => () => h('p', 'Recovered') }) })
    const extension = plugin('retry', { views: [{ id: 'view', region: 'bottom', title: { en: 'Retry panel' }, load }] })
    const { container } = await mountRegion([{ plugin: extension, source: 'bundled' }])
    await vi.waitFor(() => expect(container.textContent).toContain('Load failed'))
    const retry = [...container.querySelectorAll('button')].find(button => button.textContent === 'Retry')!
    retry.click()
    await vi.waitFor(() => expect(container.textContent).toContain('Recovered'))
  })

  it('keeps a render failure inside its panel while other tabs work', async () => {
    const broken = plugin('broken', { views: [{ id: 'view', region: 'bottom', title: { en: 'Broken' }, load: async () => ({ default: defineComponent({ render() {
      throw new Error('Render failed')
    } }) }) }] })
    const { container, layout } = await mountRegion([{ plugin: broken, source: 'bundled' }, { plugin: plugin('other'), source: 'bundled' }])
    await vi.waitFor(() => expect(container.textContent).toContain('Render failed'))
    layout.select('bottom', 'other/view')
    await vi.waitFor(() => expect(container.textContent).toContain('other content'))
  })

  it('uses the same enabled command in the toolbar overflow menu', async () => {
    const { services, project } = fixture()
    const { container } = await mountRegion([{ plugin: diagnosticsPlugin, source: 'bundled' }], services)
    const trigger = container.querySelector<HTMLButtonElement>('[aria-label="Plugin commands"]')!
    trigger.click()
    await vi.waitFor(() => expect(document.querySelector('[role="menuitem"]')).not.toBeNull())
    const item = document.querySelector<HTMLElement>('[role="menuitem"]')!
    item.click()
    await vi.waitFor(() => expect(services.project.refresh).toHaveBeenCalledTimes(1))
    project.value = null
    await nextTick()
    trigger.click()
    await vi.waitFor(() => expect(document.querySelector('[role="menuitem"]')?.getAttribute('data-disabled')).not.toBeNull())
  })
})
