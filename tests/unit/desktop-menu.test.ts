import type { MenuItemConstructorOptions } from 'electron'
import { describe, expect, it, vi } from 'vitest'
import { createNativeMenu } from '../../apps/desktop/src/menu'

function fixture(hasProject = true, locale: 'en' | 'zh-CN' = 'en') {
  const callbacks = { command: vi.fn(), create: vi.fn(), newWindow: vi.fn(), openCurrent: vi.fn(), open: vi.fn(), reconnect: vi.fn(), openRecent: vi.fn(), close: vi.fn(), reload: vi.fn(), openHelp: vi.fn() }
  const menu = createNativeMenu({ platform: 'darwin', hasProject, locale, templates: [{ id: 'rainy-letter', name: '雨夜来信' }], recent: [{ id: 'opaque-id', name: 'My Project' }], ...callbacks })
  function find(id: string, items = menu): MenuItemConstructorOptions | undefined {
    for (const item of items) {
      if (item.id === id)
        return item
      if (Array.isArray(item.submenu)) {
        const nested = find(id, item.submenu)
        if (nested)
          return nested
      }
    }
  }
  function click(id: string) {
    const item = find(id)!
    item.click!({} as never, undefined, {} as never)
  }
  return { menu, callbacks, find, click }
}

describe('desktop native menu', () => {
  it('opens preferences from Edit while retaining the application menu shortcut', () => {
    const { menu, find, click, callbacks } = fixture(false, 'zh-CN')
    const edit = menu.find(item => item.label === '编辑')!.submenu as MenuItemConstructorOptions[]
    expect(edit.some(item => item.id === 'desktop.edit-preferences')).toBe(true)
    expect(find('desktop.edit-preferences')?.label).toBe('偏好设置…')
    expect(find('desktop.preferences')?.accelerator).toBe('CmdOrCtrl+,')
    click('desktop.edit-preferences')
    expect(callbacks.command).toHaveBeenCalledWith('preferences')
  })

  it('routes authoring actions through finite commands and recent project IDs', () => {
    const { callbacks, click } = fixture()
    for (const action of ['save', 'characters', 'preferences', 'project-settings', 'workspace', 'about', 'codex-workflow', 'extensions', 'reset-layout', 'preview', 'stop-preview', 'export-directory', 'export-zip', 'project-switcher']) {
      click(`desktop.${action}`)
      expect(callbacks.command).toHaveBeenLastCalledWith(action)
    }
    click('desktop.open')
    click('desktop.create.rainy-letter')
    expect(callbacks.create).toHaveBeenCalledWith('rainy-letter')
    click('desktop.open-current')
    click('desktop.new-window')
    click('desktop.reconnect')
    click('desktop.close-project')
    click('desktop.reload')
    click('desktop.recent.opaque-id')
    expect(callbacks.open).toHaveBeenCalledOnce()
    expect(callbacks.openCurrent).toHaveBeenCalledOnce()
    expect(callbacks.newWindow).toHaveBeenCalledOnce()
    expect(callbacks.reconnect).toHaveBeenCalledOnce()
    expect(callbacks.close).toHaveBeenCalledOnce()
    expect(callbacks.reload).toHaveBeenCalledOnce()
    expect(callbacks.openRecent).toHaveBeenCalledWith('opaque-id')
  })

  it('disables project operations in an empty session but keeps preferences available', () => {
    const { find } = fixture(false)
    for (const action of ['save', 'reconnect', 'project-settings', 'close-project', 'preview', 'stop-preview', 'export-directory', 'export-zip'])
      expect(find(`desktop.${action}`)?.enabled).toBe(false)
    expect(find('desktop.preferences')?.enabled).not.toBe(false)
  })

  it('localizes custom labels, retains macOS roles and standard shortcuts', () => {
    const en = fixture()
    const zh = fixture(true, 'zh-CN')
    expect(en.find('desktop.open')?.label).toBe('Open Project…')
    expect(zh.find('desktop.open')?.label).toBe('打开项目…')
    expect(zh.find('desktop.preferences')?.accelerator).toBe('CmdOrCtrl+,')
    expect(zh.find('desktop.save')?.accelerator).toBe('CmdOrCtrl+S')
    expect((zh.menu[0]!.submenu as MenuItemConstructorOptions[]).some(item => item.role === 'services')).toBe(true)
    const edit = zh.menu.find(item => item.label === '编辑')!.submenu as MenuItemConstructorOptions[]
    expect(edit.filter(item => item.role).map(item => item.role)).toEqual(['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll'])
    zh.click('desktop.help.documentation')
    expect(zh.callbacks.openHelp).toHaveBeenCalledWith('https://docs.advjs.org')
  })
})
