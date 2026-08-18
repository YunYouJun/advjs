// @vitest-environment node

import type { BrowserProjectDirectory, BrowserProjectFile } from '../../editor/core/app/adapters/browser/project'
import { describe, expect, it, vi } from 'vitest'
import { compileEditorProject } from '../../editor/core/app/adapters/browser/project'
import { createBrowserProjectWorkspace } from '../../editor/core/app/adapters/browser/workspace'
import { createLocalBridgeAdapter } from '../../editor/core/app/adapters/local'
import { createLocalProjectWorkspace } from '../../editor/core/app/adapters/local/workspace'

interface WritableBrowserProjectFile extends BrowserProjectFile {
  createWritable: () => Promise<{
    close: () => Promise<void>
    write: (content: string | Blob) => Promise<void>
  }>
}

interface WritableBrowserProjectDirectory extends BrowserProjectDirectory {
  getDirectoryHandle: (name: string) => Promise<WritableBrowserProjectDirectory>
  getFileHandle: (name: string) => Promise<WritableBrowserProjectFile>
}

function createMemoryDirectory(name: string, files: Record<string, string>): WritableBrowserProjectDirectory {
  function directory(path: string, directoryName: string): WritableBrowserProjectDirectory {
    const prefix = path ? `${path}/` : ''

    return {
      kind: 'directory',
      name: directoryName,
      async getDirectoryHandle(childName) {
        const childPath = `${prefix}${childName}`
        if (!Object.keys(files).some(filePath => filePath.startsWith(`${childPath}/`)))
          throw new Error(`Directory not found: ${childPath}`)
        return directory(childPath, childName)
      },
      async getFileHandle(childName) {
        const childPath = `${prefix}${childName}`
        if (!(childPath in files))
          throw new Error(`File not found: ${childPath}`)
        return file(childPath, childName)
      },
      async* values() {
        const children = new Set<string>()
        for (const filePath of Object.keys(files)) {
          if (!filePath.startsWith(prefix))
            continue
          const child = filePath.slice(prefix.length).split('/')[0]
          if (child)
            children.add(child)
        }
        for (const childName of [...children].sort()) {
          const childPath = `${prefix}${childName}`
          yield childPath in files
            ? file(childPath, childName)
            : directory(childPath, childName)
        }
      },
    }
  }

  function file(path: string, fileName: string): WritableBrowserProjectFile {
    return {
      kind: 'file',
      name: fileName,
      async createWritable() {
        let next = files[path]
        return {
          async close() {
            files[path] = next
          },
          async write(content) {
            next = typeof content === 'string' ? content : await content.text()
          },
        }
      },
      async getFile() {
        return {
          size: files[path].length,
          text: async () => files[path],
        }
      },
    }
  }

  return directory('', name)
}

describe('editor project workspace', () => {
  it('loads and commits a browser project through one workspace interface', async () => {
    const root = createMemoryDirectory('rain-letter', {
      'adv.config.json': '{"id":"rain-letter","root":"adv"}\n',
      'adv/chapters/intro.adv.md': '# Intro\n',
    })
    const workspace = createBrowserProjectWorkspace(root)

    const opened = await workspace.snapshot()
    expect(opened).toMatchObject({
      kind: 'browser',
      name: 'rain-letter',
      project: {
        files: {
          'adv/chapters/intro.adv.md': '# Intro\n',
        },
      },
    })

    const committed = await workspace.commit([{
      kind: 'raw-text',
      path: 'adv/chapters/intro.adv.md',
      content: '# Revised intro\n',
    }])

    expect(committed.project.files['adv/chapters/intro.adv.md']).toBe('# Revised intro\n')
    expect((await workspace.snapshot()).project.files['adv/chapters/intro.adv.md']).toBe('# Revised intro\n')
  })

  it('loads and commits a bridge project through the same workspace interface', async () => {
    const files: Record<string, string> = {
      'adv.config.json': '{"id":"rain-letter","root":"adv"}\n',
      'adv/chapters/intro.adv.md': '# Intro\n',
    }
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input))
      if (url.pathname.endsWith('/project')) {
        const compilation = await compileEditorProject({ files, id: 'rain-letter' })
        return Response.json({
          files,
          result: compilation.compilation,
          root: '/tmp/rain-letter',
        })
      }
      if (init?.method === 'PUT') {
        files[url.searchParams.get('path')!] = String(init.body)
        return Response.json({ path: url.searchParams.get('path') })
      }
      return new Response(files[url.searchParams.get('path')!])
    })
    const workspace = createLocalProjectWorkspace(createLocalBridgeAdapter({
      fetch: fetcher,
      origin: 'http://127.0.0.1:3456',
      token: 'local-token',
    }))

    expect(await workspace.snapshot()).toMatchObject({
      kind: 'local',
      name: 'rain-letter',
      project: {
        files: {
          'adv/chapters/intro.adv.md': '# Intro\n',
        },
      },
    })

    const committed = await workspace.commit([{
      kind: 'raw-text',
      path: 'adv/chapters/intro.adv.md',
      content: '# Revised through bridge\n',
    }])

    expect(committed.project.files['adv/chapters/intro.adv.md']).toBe('# Revised through bridge\n')
  })

  it('reports bridge changes through the workspace subscription', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(': connected\n\n'))
        controller.enqueue(encoder.encode('event: change\ndata: {"event":"change","path":"adv/chapters/intro.adv.md"}\n\n'))
        controller.close()
      },
    })
    const workspace = createLocalProjectWorkspace(createLocalBridgeAdapter({
      fetch: vi.fn(async () => new Response(stream)),
      origin: 'http://127.0.0.1:3456',
      token: 'local-token',
    }))
    const changes: Array<{ event: string, path: string }> = []

    const subscription = workspace.subscribe?.(change => changes.push(change))
    await subscription?.done

    expect(changes).toEqual([{
      event: 'change',
      path: 'adv/chapters/intro.adv.md',
    }])
  })
})
