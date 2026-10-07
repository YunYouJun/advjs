import type { BrowserWindow, Rectangle, WebContentsView } from 'electron'

export type PreviewMode = 'embedded' | 'window'
export type PreviewRunMode = 'live' | 'build'
export interface PreviewPresentation { mode: PreviewMode, active: boolean, runMode?: PreviewRunMode, vueDevtools?: boolean, updating?: boolean, error?: string }

export function parsePreviewMode(value: unknown): PreviewMode {
  if (value !== 'embedded' && value !== 'window')
    throw new Error('Invalid preview mode')
  return value
}

export function parsePreviewBounds(value: unknown): Rectangle | undefined {
  if (value === undefined || value === null)
    return undefined
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid preview bounds')
  const input = value as Rectangle
  if (Object.keys(input).some(key => !['x', 'y', 'width', 'height'].includes(key))
    || !['x', 'y', 'width', 'height'].every(key => Number.isFinite(input[key as keyof Rectangle]) && input[key as keyof Rectangle] >= 0 && input[key as keyof Rectangle] <= 20_000)) {
    throw new Error('Invalid preview bounds')
  }
  return { x: Math.round(input.x), y: Math.round(input.y), width: Math.round(input.width), height: Math.round(input.height) }
}

/** Move one sandboxed player view; switching presentation never reloads it. */
export function createPreviewPresentation(owner: BrowserWindow, onFocus: () => void) {
  let mode: PreviewMode = 'embedded'
  let bounds: Rectangle | undefined
  let window: BrowserWindow | undefined
  let view: WebContentsView | undefined
  let parent: BrowserWindow | undefined

  function detach() {
    if (view && parent && !parent.isDestroyed())
      parent.contentView.removeChildView(view)
    parent = undefined
  }
  function update() {
    if (!view || !window || owner.isDestroyed())
      return
    const nextParent = mode === 'window' ? window : bounds ? owner : undefined
    if (parent !== nextParent) {
      detach()
      if (nextParent) {
        nextParent.contentView.addChildView(view)
        parent = nextParent
      }
    }
    if (mode === 'window') {
      const [width, height] = window.getContentSize()
      view.setBounds({ x: 0, y: 0, width, height })
    }
    else if (bounds) {
      const [width, height] = owner.getContentSize()
      const x = Math.min(bounds.x, width)
      const y = Math.min(bounds.y, height)
      view.setBounds({ x, y, width: Math.max(0, Math.min(bounds.width, width - x)), height: Math.max(0, Math.min(bounds.height, height - y)) })
    }
    view.webContents.setAudioMuted(!nextParent)
    if (mode === 'embedded')
      window.hide()
  }
  owner.on('resize', update)
  return {
    attach(player: BrowserWindow, playerView: WebContentsView) {
      owner.removeListener('resize', update)
      owner.on('resize', update)
      window = player
      view = playerView
      player.on('resize', update)
      player.on('focus', onFocus)
      player.on('close', (event) => {
        event.preventDefault()
        mode = 'embedded'
        update()
        owner.webContents.send('desktop:event', { type: 'preview-in-editor' })
        owner.show()
        owner.focus()
      })
      update()
      if (mode === 'window')
        player.show()
    },
    setMode(value: unknown) {
      mode = parsePreviewMode(value)
      update()
      if (mode === 'window' && window) {
        window.show()
        window.focus()
      }
      else if (mode === 'embedded' && view) {
        owner.show()
        owner.focus()
      }
    },
    setBounds(value: unknown) {
      bounds = parsePreviewBounds(value)
      update()
    },
    async reload(origin: string) {
      if (view && !view.webContents.isDestroyed())
        await view.webContents.loadURL(origin)
    },
    release() {
      detach()
      if (view && !view.webContents.isDestroyed())
        view.webContents.close()
      view = undefined
      window = undefined
    },
    dispose() {
      owner.removeListener('resize', update)
      bounds = undefined
    },
    ownsWindow: (id: number) => window?.id === id,
    status: (): PreviewPresentation => ({ mode, active: !!view }),
  }
}
