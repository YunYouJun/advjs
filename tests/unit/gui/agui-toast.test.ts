import type { App } from 'vue'
import { afterEach, describe, expect, it } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import AGUIToast from '../../../packages/gui/client/components/toast/AGUIToast.vue'

let app: App | undefined
afterEach(() => {
  app?.unmount()
  document.body.innerHTML = ''
})

async function mount() {
  let toast: InstanceType<typeof AGUIToast>
  const container = document.createElement('div')
  document.body.append(container)
  app = createApp({
    render: () => h(AGUIToast, { ref: (value) => { toast = value as InstanceType<typeof AGUIToast> } }),
  })
  app.mount(container)
  await nextTick()
  return toast!
}

describe('toast content lifecycle', () => {
  it('releases a closed entry when Presence unmounts without an animation', async () => {
    const toast = await mount()
    toast.add({ id: 'manual', title: 'Saved', duration: Infinity })
    await nextTick()
    await nextTick()
    document.querySelector<HTMLButtonElement>('.ToastRoot button')!.click()
    await nextTick()
    await nextTick()
    await nextTick()
    expect(document.querySelector('.ToastRoot')).toBeNull()
    expect(toast.toastList).toHaveLength(0)
    expect(document.querySelector('.ToastViewport')).toBeNull()
    toast.add({ id: 'manual', title: 'Saved again', duration: Infinity })
    await nextTick()
    expect(toast.toastList).toHaveLength(1)
  })

  it('keeps three unique entries and safely evicts before content mounts', async () => {
    const toast = await mount()
    for (let index = 0; index < 5; index++)
      toast.add({ id: String(index), title: `Saved ${index}`, duration: Infinity })
    toast.add({ id: '4', title: 'Duplicate', duration: Infinity })
    await nextTick()
    await nextTick()
    expect(toast.toastList.map(item => item.id)).toEqual(['2', '3', '4'])
    expect(document.querySelectorAll('.ToastRoot')).toHaveLength(3)
    app!.unmount()
    app = undefined
    await nextTick()
    expect(document.querySelector('.ToastRoot')).toBeNull()
  })
})
