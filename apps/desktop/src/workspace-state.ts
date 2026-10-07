import { createHash } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

export interface DesktopLayoutNode { name: string, type?: 'horizontal' | 'vertical', size?: number, min?: number, max?: number, children?: DesktopLayoutNode[] }
export interface DesktopFilePosition { lineNumber: number, column: number, scrollTop: number, scrollLeft: number }
export interface DesktopWorkspaceState {
  version: 1
  layout?: DesktopLayoutNode
  activeViews?: Partial<Record<'navigation' | 'main' | 'bottom' | 'inspector', string>>
  openedFile?: string
  positions?: Record<string, DesktopFilePosition>
}

function projectPath(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 4096 && !value.startsWith('/') && !value.includes('\\') && !value.includes(':') && !value.split('/').includes('..')
}
export function parseWorkspaceState(value: unknown): DesktopWorkspaceState {
  if (!value || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(value).length > 200_000)
    throw new Error('Invalid workspace state')
  const input = value as DesktopWorkspaceState
  if (input.version !== 1 || Object.keys(input).some(key => !['version', 'layout', 'activeViews', 'openedFile', 'positions'].includes(key)))
    throw new Error('Invalid workspace state')
  function layout(node: DesktopLayoutNode, depth = 0): DesktopLayoutNode {
    if (!node || depth > 8 || typeof node.name !== 'string' || node.name.length > 100 || (node.type !== undefined && !['horizontal', 'vertical'].includes(node.type)))
      throw new Error('Invalid workspace layout')
    for (const key of ['size', 'min', 'max'] as const) {
      if (node[key] !== undefined && (!Number.isFinite(node[key]) || node[key]! < 0 || node[key]! > 100))
        throw new Error('Invalid workspace layout size')
    }
    if (node.children !== undefined && (!Array.isArray(node.children) || node.children.length > 20))
      throw new Error('Invalid workspace layout children')
    return { name: node.name, type: node.type, size: node.size, min: node.min, max: node.max, children: node.children?.map(child => layout(child, depth + 1)) }
  }
  const state: DesktopWorkspaceState = { version: 1 }
  if (input.layout)
    state.layout = layout(input.layout)
  if (input.activeViews) {
    state.activeViews = {}
    for (const region of ['navigation', 'main', 'bottom', 'inspector'] as const) {
      const id = input.activeViews[region]
      if (id !== undefined && (typeof id !== 'string' || id.length > 200))
        throw new Error('Invalid active view')
      if (id)
        state.activeViews[region] = id
    }
  }
  if (input.openedFile !== undefined) {
    if (!projectPath(input.openedFile))
      throw new Error('Invalid opened file')
    state.openedFile = input.openedFile
  }
  if (input.positions) {
    if (typeof input.positions !== 'object' || Array.isArray(input.positions) || Object.keys(input.positions).length > 200)
      throw new Error('Invalid file positions')
    state.positions = {}
    for (const [path, position] of Object.entries(input.positions)) {
      if (!projectPath(path) || !position || !['lineNumber', 'column', 'scrollTop', 'scrollLeft'].every(key => Number.isFinite(position[key as keyof DesktopFilePosition]) && position[key as keyof DesktopFilePosition] >= 0))
        throw new Error('Invalid file position')
      Object.defineProperty(state.positions, path, { value: { lineNumber: Math.max(1, position.lineNumber), column: Math.max(1, position.column), scrollTop: position.scrollTop, scrollLeft: position.scrollLeft }, enumerable: true })
    }
  }
  return state
}

export function createWorkspaceStateStorage(directory: string) {
  const writes = new Map<string, Promise<void>>()
  const file = (path: string) => resolve(directory, `${createHash('sha256').update(path).digest('hex')}.json`)
  return {
    async read(path: string): Promise<DesktopWorkspaceState> {
      await writes.get(path)
      try {
        return parseWorkspaceState(JSON.parse(await readFile(file(path), 'utf8')))
      }
      catch { return { version: 1 } }
    },
    write(path: string, value: unknown) {
      const state = parseWorkspaceState(value)
      const write = (writes.get(path) ?? Promise.resolve()).catch(() => {}).then(async () => {
        await mkdir(directory, { recursive: true })
        const target = file(path)
        await writeFile(`${target}.tmp`, JSON.stringify(state))
        await rename(`${target}.tmp`, target)
      })
      writes.set(path, write)
      return write
    },
  }
}
