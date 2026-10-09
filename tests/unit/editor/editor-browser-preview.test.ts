// @vitest-environment node

import type { BrowserProjectDirectory } from '../../../editor/core/app/adapters/browser/project'
import type { ProjectWorkspace } from '../../../editor/core/app/workspaces/project'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { resolveBrowserPreviewConfig } from '../../../editor/core/app/adapters/browser/preview'
import { compileEditorProject } from '../../../editor/core/app/adapters/browser/project'
import { createBrowserProjectWorkspace } from '../../../editor/core/app/adapters/browser/workspace'
import starter from '../../../editor/core/app/templates/starter'
import { resolveSceneBackground } from '../../../packages/client/utils/scene'

const workspaces: ProjectWorkspace[] = []
afterEach(() => {
  for (const workspace of workspaces.splice(0)) workspace.dispose?.()
  vi.restoreAllMocks()
})

function directory(
  files: Record<string, File>,
  beforeRead?: (path: string, count: number) => Promise<File> | undefined,
): BrowserProjectDirectory {
  const reads = new Map<string, number>()
  function file(path: string) {
    return {
      kind: 'file' as const,
      name: path.split('/').at(-1)!,
      async getFile() {
        const count = (reads.get(path) ?? 0) + 1
        reads.set(path, count)
        return await beforeRead?.(path, count) ?? files[path]
      },
    }
  }
  function folder(path: string, name: string): BrowserProjectDirectory & {
    getDirectoryHandle: (name: string) => Promise<BrowserProjectDirectory>
    getFileHandle: (name: string) => Promise<ReturnType<typeof file>>
  } {
    const prefix = path ? `${path}/` : ''
    return {
      kind: 'directory',
      name,
      async getDirectoryHandle(child) {
        return folder(`${prefix}${child}`, child)
      },
      async getFileHandle(child) {
        const path = `${prefix}${child}`
        if (!files[path])
          throw new Error(`File not found: ${path}`)
        return file(path)
      },
      async* values() {
        const children = new Set(Object.keys(files).filter(path => path.startsWith(prefix)).map(path => path.slice(prefix.length).split('/')[0]))
        for (const child of children) {
          const path = `${prefix}${child}`
          yield files[path] ? file(path) : folder(path, child)
        }
      },
    }
  }
  return folder('', 'browser-preview')
}

function fileMap(source: Record<string, string>): Record<string, File> {
  return Object.fromEntries(Object.entries(source).map(([path, content]) => [path, new File([content], path.split('/').at(-1)!, { type: path.endsWith('.svg') ? 'image/svg+xml' : path.endsWith('.webp') ? 'image/webp' : 'text/plain' })]))
}

function starterFiles() {
  const files = fileMap(Object.fromEntries(starter.files.filter(file => !file.encoding).map(file => [file.name, file.content])))
  for (const item of starter.files.filter(file => file.encoding)) {
    files[item.name] = new File([Uint8Array.from(atob(item.content), character => character.charCodeAt(0))], item.name.split('/').at(-1)!, { type: 'image/webp' })
  }
  return files
}

function workspace(files: Record<string, File>, beforeRead?: Parameters<typeof directory>[1]) {
  const source = createBrowserProjectWorkspace(directory(files, beforeRead))
  workspaces.push(source)
  return source
}

function simpleFiles() {
  return fileMap({
    'adv.config.json': '{"root":"adv"}',
    'adv/chapters/intro.adv.md': '> Begin.\n',
    'adv/scenes/room.md': '---\nid: room\nname: Room\nsrc: /img/room.svg\n---\n',
    'public/img/room.svg': '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>',
  })
}

describe('browser project media preview', () => {
  it('loads Starter public backgrounds and avatars from workspace blobs while preserving authored sources and runtime values', async () => {
    const files = starterFiles()
    const snapshot = await workspace(files).snapshot()
    const model = snapshot.project
    expect(model.compilation.diagnostics).toEqual([])
    const room = model.previewConfig.scenes.find(scene => scene.id === 'demo-room')!
    expect(room.type).toBe('image')
    const src = resolveSceneBackground('/img/room.svg', model.previewConfig.scenes)
    expect(src).toMatch(/^blob:/u)
    expect(resolveSceneBackground('demo-room', model.previewConfig.scenes)).toBe(src)
    const image = await fetch(src)
    expect(image.headers.get('content-type')).toBe('image/svg+xml')
    expect(await image.text()).toBe(await files['public/img/room.svg'].text())

    const avatar = model.previewConfig.characters.find(character => character.id === 'guide')!.avatar!
    expect(avatar).toMatch(/^blob:/u)
    expect(new Uint8Array(await (await fetch(avatar)).arrayBuffer())).toEqual(new Uint8Array(await files['public/img/characters/xiaoyun.webp'].arrayBuffer()))
    expect(model.compilation.project.characters.find(character => character.id === 'guide')!.avatar).toBe('/img/characters/xiaoyun.webp')
    expect(model.compilation.project.scenes.find(scene => scene.id === 'demo-room')!.src).toBe('/img/room.svg')
    const operations = Object.values(model.compilation.project.program!.chapters.hello.nodes).flatMap(node => Array.isArray(node.data?.operations) ? node.data.operations : [])
    expect(operations).toContainEqual(expect.objectContaining({ type: 'background', url: '/img/room.svg' }))
    for (const chapter of model.previewConfig.chapters) {
      const response = await fetch(chapter.nodes[0].src)
      expect(await response.text()).toBe(await files[`adv/chapters/${chapter.id}.adv.md`].text())
    }
  })

  it('resolves a direct background URL even when no scene catalog entry declares it', async () => {
    const files = simpleFiles()
    delete files['adv/scenes/room.md']
    files['adv/chapters/intro.adv.md'] = new File(['```yaml\ntype: background\nurl: /img/room.svg\n```\n\n> Begin.\n'], 'intro.adv.md')
    const snapshot = await workspace(files).snapshot()
    expect(snapshot.project.compilation.project.scenes).toEqual([])
    const src = resolveSceneBackground('/img/room.svg', snapshot.project.previewConfig.scenes)
    expect(src).toMatch(/^blob:/u)
    expect(await (await fetch(src)).text()).toContain('<svg')
    expect(snapshot.project.files['adv/chapters/intro.adv.md']).toContain('url: /img/room.svg')
  })

  it('resolves local asset catalog scenes and preserves remote and embedded media', async () => {
    const files = simpleFiles()
    files['adv/assets.json'] = new File([JSON.stringify({ schemaVersion: 2, id: 'preview', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, assets: [{ id: 'background/library', kind: 'background', type: 'image', path: 'library.webp' }] })], 'assets.json')
    files['adv/assets/library.webp'] = new File(['local-library'], 'library.webp', { type: 'image/webp' })
    files['adv/scenes/library.md'] = new File(['---\nid: library\nassetId: background/library\n---\n'], 'library.md')
    files['adv/scenes/remote.md'] = new File(['---\nid: remote\nsrc: https://example.com/scene.webp\n---\n'], 'remote.md')
    files['adv/characters/remote.character.md'] = new File(['---\nid: remote\nname: Remote\navatar: https://example.com/avatar.webp\n---\n'], 'remote.character.md')
    const model = (await workspace(files).snapshot()).project
    expect(model.compilation.diagnostics).toEqual([])
    const src = resolveSceneBackground('library', model.previewConfig.scenes)
    expect(await (await fetch(src)).text()).toBe('local-library')
    expect(resolveSceneBackground('remote', model.previewConfig.scenes)).toBe('https://example.com/scene.webp')
    expect(model.previewConfig.characters.find(character => character.id === 'remote')!.avatar).toBe('https://example.com/avatar.webp')

    const assetUrl = vi.fn(async () => 'blob:unexpected')
    const direct = await compileEditorProject({ files: { 'adv.config.json': '{"root":"adv"}', 'adv/chapters/intro.adv.md': '> Begin.\n' } })
    direct.previewConfig.characters = ['data:image/svg+xml,<svg/>', 'blob:existing', '//example.com/avatar.webp', '../outside.webp', 'file:///outside.webp'].map((avatar, index) => ({ id: `media-${index}`, name: 'Media', avatar }))
    const config = await resolveBrowserPreviewConfig(direct, assetUrl)
    expect(config.characters.map(character => character.avatar)).toEqual(direct.previewConfig.characters.map(character => character.avatar))
    const remoteCatalog = await compileEditorProject({ files: {
      'adv.config.json': '{"root":"adv"}',
      'adv/chapters/intro.adv.md': '> Begin.\n',
      'adv/assets.json': JSON.stringify({ schemaVersion: 2, id: 'remote-preview', defaultProfile: 'production', profiles: { production: { provider: 'http', baseUrl: 'https://example.com/media/' } }, assets: [{ id: 'background/library', kind: 'background', type: 'image', objectKey: 'library.webp' }] }),
      'adv/scenes/library.md': '---\nid: library\nassetId: background/library\n---\n',
    } })
    expect(remoteCatalog.compilation.diagnostics).toEqual([])
    expect(resolveSceneBackground('library', (await resolveBrowserPreviewConfig(remoteCatalog, assetUrl)).scenes)).toBe('https://example.com/media/library.webp')
    expect(assetUrl).not.toHaveBeenCalled()
  })

  it('replaces preview URLs on refresh and releases preview and independent asset URLs on disposal', async () => {
    const files = simpleFiles()
    const source = workspace(files)
    const first = (await source.snapshot()).project.previewConfig
    const firstUrl = resolveSceneBackground('room', first.scenes)
    const independent = await source.assetUrl!('public/img/room.svg')
    files['public/img/room.svg'] = new File(['<svg xmlns="http://www.w3.org/2000/svg">updated</svg>'], 'room.svg', { type: 'image/svg+xml' })
    const secondUrl = resolveSceneBackground('room', (await source.snapshot()).project.previewConfig.scenes)
    expect(secondUrl).not.toBe(firstUrl)
    await expect(fetch(firstUrl)).rejects.toThrow()
    expect(await (await fetch(secondUrl)).text()).toContain('updated')
    expect(await (await fetch(independent)).text()).not.toContain('updated')
    source.dispose!()
    await expect(fetch(secondUrl)).rejects.toThrow()
    await expect(fetch(independent)).rejects.toThrow()
    await expect(source.assetUrl!('public/img/room.svg')).rejects.toThrow('disposed')
  })

  it('keeps a project editable when a declared local catalog image is missing', async () => {
    const files = fileMap({
      'adv.config.json': '{"root":"adv"}',
      'adv/chapters/intro.adv.md': '> An editable story.\n',
      'adv/assets.json': JSON.stringify({ schemaVersion: 2, id: 'missing-preview', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, assets: [{ id: 'background/missing', kind: 'background', type: 'image', path: 'missing.webp' }] }),
      'adv/scenes/missing.md': '---\nid: missing\nassetId: background/missing\n---\n',
    })
    const created = vi.spyOn(URL, 'createObjectURL')
    const snapshot = await workspace(files).snapshot()
    expect(snapshot.project.compilation.diagnostics).toEqual([])
    expect(snapshot.project.compilation.project.program).toBeDefined()
    expect(snapshot.project.files['adv/chapters/intro.adv.md']).toBe('> An editable story.\n')
    expect(snapshot.project.files['adv/scenes/missing.md']).toBe(await files['adv/scenes/missing.md'].text())
    expect(resolveSceneBackground('missing', snapshot.project.previewConfig.scenes)).toBe('adv/assets/missing.webp')
    expect(snapshot.project.compilation.project.scenes[0]).toMatchObject({ id: 'missing', assetId: 'background/missing' })
    expect(created).not.toHaveBeenCalled()
  })

  it.each([false, true])('opens mixed local and production catalog entries with local fallback=%s and preserves URL lifetimes', async (fallback) => {
    const files = fileMap({
      'adv.config.json': '{"root":"adv"}',
      'adv/chapters/intro.adv.md': '> An editable mixed-media story.\n',
      'adv/assets.json': JSON.stringify({
        schemaVersion: 2,
        id: 'mixed-preview',
        defaultProfile: 'production',
        profiles: {
          local: { provider: 'project', root: 'adv/assets', ...(fallback ? { fallback: 'production' } : {}) },
          production: { provider: 'http', baseUrl: 'https://example.com/media/' },
        },
        assets: [
          { id: 'local-room', kind: 'background', type: 'image', path: 'room.svg', objectKey: 'room.webp' },
          { id: 'remote-room', kind: 'background', type: 'image', objectKey: 'remote.webp' },
        ],
      }),
      'adv/scenes/local.md': '---\nid: local-room\nassetId: local-room\n---\n',
      'adv/scenes/remote.md': '---\nid: remote-room\nassetId: remote-room\n---\n',
      'adv/assets/room.svg': '<svg xmlns="http://www.w3.org/2000/svg">local room</svg>',
    })
    const source = workspace(files)
    const first = (await source.snapshot()).project
    expect(first.compilation.diagnostics).toEqual([])
    const localUrl = resolveSceneBackground('local-room', first.previewConfig.scenes)
    expect(localUrl).toMatch(/^blob:/u)
    expect(await (await fetch(localUrl)).text()).toContain('local room')
    expect(resolveSceneBackground('remote-room', first.previewConfig.scenes)).toBe('https://example.com/media/remote.webp')
    expect(first.compilation.project.assets!.defaultProfile).toBe('production')
    const second = (await source.snapshot()).project
    const nextLocalUrl = resolveSceneBackground('local-room', second.previewConfig.scenes)
    expect(nextLocalUrl).not.toBe(localUrl)
    await expect(fetch(localUrl)).rejects.toThrow()
    expect(await (await fetch(nextLocalUrl)).text()).toContain('local room')
    expect(resolveSceneBackground('remote-room', second.previewConfig.scenes)).toBe('https://example.com/media/remote.webp')
    source.dispose!()
    await expect(fetch(nextLocalUrl)).rejects.toThrow()
  })
  it('opens a project with an unknown scene asset reference so its compiler diagnostic can be repaired', async () => {
    const scene = '---\nid: room\nassetId: missing\nsrc: /img/fallback.svg\n---\n'
    const files = fileMap({
      'adv.config.json': '{"root":"adv"}',
      'adv/chapters/intro.adv.md': '> An editable story.\n',
      'adv/assets.json': JSON.stringify({ schemaVersion: 2, id: 'unknown-preview', defaultProfile: 'local', profiles: { local: { provider: 'project', root: 'adv/assets' } }, assets: [{ id: 'known', kind: 'background', type: 'image', path: 'known.webp' }] }),
      'adv/scenes/room.md': scene,
      'public/img/fallback.svg': '<svg xmlns="http://www.w3.org/2000/svg"/>',
    })
    const created = vi.spyOn(URL, 'createObjectURL')
    const snapshot = await workspace(files).snapshot()
    expect(snapshot.project.compilation.diagnostics).toContainEqual(expect.objectContaining({
      code: 'ADV_PROJECT_UNKNOWN_SCENE_ASSET',
      severity: 'error',
      path: 'adv/scenes/room.md',
    }))
    expect(snapshot.project.files['adv/scenes/room.md']).toBe(scene)
    expect(snapshot.project.files['adv/chapters/intro.adv.md']).toBe('> An editable story.\n')
    expect(snapshot.project.previewConfig.scenes.find(scene => scene.id === 'room')!.src).toBe('/img/fallback.svg')
    expect(snapshot.project.compilation.project.scenes[0].assetId).toBe('missing')
    expect(created).not.toHaveBeenCalled()
  })
  it('cancels a pending media read after the workspace is disposed without creating a late URL', async () => {
    const files = simpleFiles()
    let release!: (file: File) => void
    let started!: () => void
    const reading = new Promise<void>(resolve => started = resolve)
    const pendingFile = new Promise<File>(resolve => release = resolve)
    const source = workspace(files, (path, count) => {
      if (path === 'public/img/room.svg' && count === 2) {
        started()
        return pendingFile
      }
    })
    const createUrl = vi.spyOn(URL, 'createObjectURL')
    const pending = source.snapshot()
    const rejected = expect(pending).rejects.toThrow('cancelled')
    await reading
    source.dispose!()
    release(files['public/img/room.svg'])
    await rejected
    expect(createUrl).not.toHaveBeenCalled()
  })

  it('releases partially prepared URLs when another media file fails to read', async () => {
    const files = simpleFiles()
    files['adv/scenes/second.md'] = new File(['---\nid: second\nsrc: /img/second.webp\n---\n'], 'second.md')
    files['public/img/second.webp'] = new File(['second'], 'second.webp', { type: 'image/webp' })
    let fail!: (error: Error) => void
    const pendingFile = new Promise<File>((_resolve, reject) => fail = reject)
    const source = workspace(files, (path, count) => path === 'public/img/second.webp' && count === 2 ? pendingFile : undefined)
    const createUrl = vi.spyOn(URL, 'createObjectURL')
    const pending = source.snapshot()
    const rejected = expect(pending).rejects.toThrow('unreadable')
    await vi.waitFor(() => expect(createUrl).toHaveBeenCalled())
    const prepared = createUrl.mock.results[0].value as string
    expect(await (await fetch(prepared)).text()).toContain('<svg')
    fail(new Error('unreadable'))
    await rejected
    await expect(fetch(prepared)).rejects.toThrow()
  })
})
