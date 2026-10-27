import type { App } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineAsyncComponent, defineComponent, h, nextTick, onUnmounted, ref } from 'vue'
import AELazyDialog from '../../../editor/core/app/components/dialogs/AELazyDialog.vue'
import AGUIDialog from '../../../packages/gui/client/components/dialog/AGUIDialog.vue'

let app: App | undefined
afterEach(() => {
  app?.unmount()
  document.body.innerHTML = ''
})

function trackedDialog(unmounted: () => void) {
  return defineComponent({
    inheritAttrs: false,
    props: { open: Boolean },
    setup(props, { attrs }) {
      onUnmounted(unmounted)
      return () => h(AGUIDialog, { ...attrs, title: 'Preferences', open: props.open })
    },
  })
}

describe('lazy editor dialogs', () => {
  it('captures focus before loading and releases the feature after content unmounts', async () => {
    const open = ref(false)
    const container = document.createElement('div')
    document.body.append(container)
    const unmounted = vi.fn()
    const dialog = trackedDialog(unmounted)
    app = createApp({ render: () => h('div', [
      h('button', { id: 'origin' }, 'Preferences'),
      h(AELazyDialog, { 'dialog': dialog, 'title': 'Preferences', 'open': open.value, 'onUpdate:open': value => open.value = value }),
    ]) })
    app.mount(container)
    const origin = container.querySelector<HTMLButtonElement>('#origin')!
    origin.focus()
    open.value = true
    await vi.waitFor(() => expect(document.querySelector('[role=dialog]')).not.toBeNull())
    document.querySelector<HTMLButtonElement>('[role=dialog] button')!.click()
    await vi.waitFor(() => expect(document.querySelector('[role=dialog]')).toBeNull())
    await vi.waitFor(() => expect(document.activeElement).toBe(origin))
    expect(open.value).toBe(false)
    await vi.waitFor(() => expect(unmounted).toHaveBeenCalledOnce())
    open.value = true
    await vi.waitFor(() => expect(document.querySelector('[role=dialog]')).not.toBeNull())
  })

  it('safely closes while the async feature is still loading', async () => {
    const unmounted = vi.fn()
    const feature = trackedDialog(unmounted)
    let resolve!: (component: typeof feature) => void
    const dialog = defineAsyncComponent(() => new Promise<typeof feature>((done) => {
      resolve = done
    }))
    const open = ref(true)
    const container = document.createElement('div')
    document.body.append(container)
    app = createApp({ render: () => h(AELazyDialog, { dialog, title: 'Delayed', open: open.value }) })
    app.mount(container)
    open.value = false
    await nextTick()
    resolve(feature)
    await vi.waitFor(() => expect(unmounted).toHaveBeenCalledOnce())
    await vi.waitFor(() => expect(container.querySelector('[role=dialog]')).toBeNull())
    await nextTick()
    expect(document.querySelector('.agui-dialog-overlay')).toBeNull()
    expect(document.body.style.pointerEvents).not.toBe('none')
  })
})
