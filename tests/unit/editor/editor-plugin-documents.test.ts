import { describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { createEditorDocumentRegistry } from '../../../editor/core/app/extensions/documents'
import { createEditorExtensionHost } from '../../../editor/core/app/extensions/registry'

function fixture() {
  const documents = createEditorDocumentRegistry()
  const current = shallowRef(null)
  const services = { locale: shallowRef('en'), project: { current, refresh: async () => {}, subscribe: () => () => {} }, clipboard: { writeText: async () => {} }, notifications: { info: () => {} }, documents }
  return { documents, current, services }
}
describe('sDK plugin document saving', () => {
  it('shares save ownership across concurrent callers and requires all edits to be durably saved', async () => {
    const { documents } = fixture()
    const dirty = shallowRef(true)
    let release!: () => void
    const save = vi.fn(async () => {
      await new Promise<void>((done) => {
        release = done
      })
      dirty.value = false
      return true
    })
    const unregister = documents.register('test.plugin', 'chapter', { dirty, save })
    expect(documents.dirty.value).toBe(true)
    const first = documents.saveAll()
    const second = documents.saveAll()
    expect(first).toBe(second)
    release()
    expect(await first).toBe(true)
    expect(save).toHaveBeenCalledTimes(1)
    dirty.value = true
    save.mockResolvedValueOnce(false)
    expect(await documents.saveAll()).toBe(false)
    expect(documents.dirty.value).toBe(true)
    save.mockResolvedValueOnce(true)
    expect(await documents.saveAll()).toBe(false)
    save.mockRejectedValueOnce(new Error('Conflict'))
    await expect(documents.saveAll()).rejects.toThrow('Conflict')
    expect(documents.hasDirty('test.plugin')).toBe(true)
    unregister()
    expect(documents.dirty.value).toBe(false)
  })
  it('registers through the SDK, blocks dirty plugin disposal and retains preferences until a successful disable', async () => {
    const { documents, services } = fixture()
    const dirty = shallowRef(true)
    const persistDisabled = vi.fn()
    const registry = createEditorExtensionHost([{ source: 'bundled', plugin: { id: 'test.plugin', version: '1', apiVersion: 1, title: { en: 'Test' }, requires: ['documents.register'], activate(ctx) {
      ctx.documents!.register('chapter', { dirty, save: async () => {
        dirty.value = false
        return true
      } })
    } } }], services, { persistDisabled })
    await registry.start()
    expect(registry.entries[0]?.status).toBe('active')
    await registry.setEnabled('test.plugin', false)
    expect(registry.entries[0]?.status).toBe('active')
    expect(registry.entries[0]?.error).toContain('unsaved')
    expect(persistDisabled).not.toHaveBeenCalled()
    expect(await documents.saveAll()).toBe(true)
    await registry.setEnabled('test.plugin', false)
    expect(registry.entries[0]?.status).toBe('disabled')
    expect(persistDisabled).toHaveBeenCalledWith(['test.plugin'])
    expect(await documents.saveAll()).toBe(true)
    await registry.dispose()
  })
  it('does not release dirty ownership on a changed registration while saving', async () => {
    const { documents } = fixture()
    let release!: () => void
    const remove = documents.register('a', 'chapter', { dirty: shallowRef(true), save: () => new Promise<boolean>((done) => {
      release = () => done(true)
    }) })
    const pending = documents.saveAll()
    remove()
    documents.register('a', 'chapter', { dirty: shallowRef(true), save: async () => false })
    release()
    expect(await pending).toBe(false)
  })
})
