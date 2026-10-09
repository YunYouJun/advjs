import type { BrowserWindow, WebContentsView } from 'electron'
import { EventEmitter } from 'node:events'
import { expect, it, vi } from 'vitest'
import { createPreviewPresentation, parsePreviewBounds, parsePreviewMode } from '../../../apps/desktop/src/preview-presentation'

it('only accepts the two finite preview presentations', () => {
  expect(parsePreviewMode('embedded')).toBe('embedded')
  expect(parsePreviewMode('window')).toBe('window')
  for (const value of [undefined, 'url', { url: 'https://example.com' }])
    expect(() => parsePreviewMode(value)).toThrow('Invalid preview mode')
})

it('accepts finite panel rectangles and hides on absence, rejecting extra or unsafe values', () => {
  expect(parsePreviewBounds(undefined)).toBeUndefined()
  expect(parsePreviewBounds(null)).toBeUndefined()
  expect(parsePreviewBounds({ x: 1.2, y: 28.4, width: 320.6, height: 600 })).toEqual({ x: 1, y: 28, width: 321, height: 600 })
  for (const value of [{}, [], { x: -1, y: 0, width: 320, height: 600 }, { x: 0, y: 0, width: Number.NaN, height: 600 }, { x: 0, y: 0, width: 320, height: 20_001 }, { x: 0, y: 0, width: 320, height: 600, url: 'https://example.com' }])
    expect(() => parsePreviewBounds(value)).toThrow('Invalid preview bounds')
})

it('retains one native player across hidden panels and windows, mutes hidden audio, and releases it once', async () => {
  function window(id: number) {
    return Object.assign(new EventEmitter(), {
      id,
      isDestroyed: () => false,
      getContentSize: () => [800, 600],
      contentView: { addChildView: vi.fn(), removeChildView: vi.fn() },
      webContents: { send: vi.fn() },
      show: vi.fn(),
      hide: vi.fn(),
      focus: vi.fn(),
    })
  }
  const owner = window(1)
  const player = window(2)
  const view = { setBounds: vi.fn(), webContents: { isDestroyed: () => false, setAudioMuted: vi.fn(), close: vi.fn(), loadURL: vi.fn() } }
  const presentation = createPreviewPresentation(owner as unknown as BrowserWindow, vi.fn())
  presentation.setBounds({ x: 0, y: 30, width: 320, height: 500 })
  presentation.attach(player as unknown as BrowserWindow, view as unknown as WebContentsView)
  expect(owner.contentView.addChildView).toHaveBeenCalledWith(view)
  expect(view.webContents.setAudioMuted).toHaveBeenLastCalledWith(false)
  presentation.setBounds(undefined)
  expect(owner.contentView.removeChildView).toHaveBeenCalledWith(view)
  expect(view.webContents.setAudioMuted).toHaveBeenLastCalledWith(true)
  expect(presentation.status().active).toBe(true)
  presentation.setMode('window')
  expect(player.contentView.addChildView).toHaveBeenCalledWith(view)
  expect(view.webContents.setAudioMuted).toHaveBeenLastCalledWith(false)
  const preventDefault = vi.fn()
  player.emit('close', { preventDefault })
  expect(preventDefault).toHaveBeenCalledOnce()
  expect(presentation.status().mode).toBe('embedded')
  expect(view.webContents.setAudioMuted).toHaveBeenLastCalledWith(true)
  presentation.setBounds({ x: 0, y: 30, width: 600, height: 500 })
  expect(owner.contentView.addChildView).toHaveBeenCalledTimes(2)
  expect(view.webContents.loadURL).not.toHaveBeenCalled()
  presentation.release()
  presentation.release()
  expect(view.webContents.close).toHaveBeenCalledOnce()
  presentation.dispose()
  expect(owner.listenerCount('resize')).toBe(0)
  expect(presentation.status().active).toBe(false)
})
