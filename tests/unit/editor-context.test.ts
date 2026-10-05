import type { App } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, createApp, h, nextTick, ref } from 'vue'
import ContextDocument from '../../editor/core/app/components/panel/context/ContextDocument.vue'
import { useProjectContextStore } from '../../editor/core/app/stores/useProjectContextStore'
import AGUIButton from '../../packages/gui/client/components/button/AGUIButton.vue'

let app: App | undefined
const cleanups: Array<() => void> = []

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('ref', ref)
  vi.stubGlobal('useConsoleStore', () => ({ success: vi.fn(), error: vi.fn() }))
})
afterEach(() => {
  app?.unmount()
  app = undefined
  cleanups.splice(0).forEach(cleanup => cleanup())
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

function directory(files: Record<string, string>, fail = false): FileSystemDirectoryHandle {
  function handle(prefix = ''): FileSystemDirectoryHandle {
    return {
      name: 'test-project',
      kind: 'directory',
      async getDirectoryHandle(name: string) {
        if (fail)
          throw new DOMException('Denied', 'NotAllowedError')
        if (name === 'adv')
          return handle()
        if (!Object.keys(files).some(path => path.startsWith(`${prefix}${name}/`)))
          throw new DOMException('Missing', 'NotFoundError')
        return handle(`${prefix}${name}/`)
      },
      async getFileHandle(name: string) {
        if (!(`${prefix}${name}` in files))
          throw new DOMException('Missing', 'NotFoundError')
        return { getFile: async () => ({ text: async () => files[`${prefix}${name}`] }) }
      },
      async* values() {
        for (const path of Object.keys(files)) {
          const name = path.slice(prefix.length)
          if (path.startsWith(prefix) && !name.includes('/'))
            yield { kind: 'file', name }
        }
      },
    } as unknown as FileSystemDirectoryHandle
  }
  return handle()
}

function mount(component: Parameters<typeof h>[0], props: Record<string, unknown>) {
  const container = document.createElement('div')
  document.body.append(container)
  app = createApp({ render: () => h(component, props) })
  app.mount(container)
  return container
}

describe('context document', () => {
  it('renders readable headings and lists while escaping HTML and unsafe links', async () => {
    const container = mount(ContextDocument, {
      content: '# 世界观\n\n普通正文与 **强调**。\n\n- 项目一\n\n<script>alert(1)</script>\n\n[Unsafe](javascript:alert%281%29)\n\n[Docs](https://advjs.org)\n\n![Art](https://example.com/image.png)',
    })
    await vi.waitFor(() => expect(container.querySelector('h3')?.textContent).toBe('世界观'))
    expect(container.querySelector('li')?.textContent).toBe('项目一')
    expect(container.querySelector('strong')?.textContent).toBe('强调')
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelectorAll('a')).toHaveLength(1)
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://advjs.org')
    expect(container.textContent).toContain('<script>alert(1)</script>')
  })
})

describe('project context actions', () => {
  it('distinguishes missing files from a denied project and clears stale context visibility', async () => {
    const store = useProjectContextStore()
    expect(await store.loadContext(directory({ 'world.md': '# World' }))).toBe(true)
    expect(store.isLoaded).toBe(true)
    expect(await store.loadContext(directory({}, true))).toBe(false)
    expect(store.isLoaded).toBe(false)
    expect(await store.loadContext(directory({}))).toBe(true)
    expect(store.getMergedContext()).toBe('')
  })
})

describe('shared context actions', () => {
  it('prevents duplicate activation while loading without submitting a form', async () => {
    const loading = ref(false)
    const onClick = vi.fn()
    const container = document.createElement('div')
    document.body.append(container)
    const props = computed(() => ({ loading: loading.value, onClick }))
    app = createApp({ render: () => h(AGUIButton, props.value, () => 'Refresh') })
    app.mount(container)
    const button = container.querySelector('button')!
    expect(button.type).toBe('button')
    button.click()
    expect(onClick).toHaveBeenCalledTimes(1)
    loading.value = true
    await nextTick()
    expect(button.disabled).toBe(true)
    expect(button.getAttribute('aria-busy')).toBe('true')
    button.click()
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})
