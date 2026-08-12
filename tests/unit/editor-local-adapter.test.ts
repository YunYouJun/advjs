import { describe, expect, it, vi } from 'vitest'
import {
  createLocalBridgeAdapter,
  parseLocalEditorSession,
} from '../../editor/core/app/adapters/local'

describe('editor local bridge adapter', () => {
  it('discovers a token from the launch fragment without putting it in requests', () => {
    expect(parseLocalEditorSession('http://127.0.0.1:3456/#advjs-token=secret-value')).toEqual({
      origin: 'http://127.0.0.1:3456',
      token: 'secret-value',
    })
    expect(parseLocalEditorSession('https://editor.advjs.org/')).toBeUndefined()
    expect(parseLocalEditorSession('http://example.com/#advjs-token=secret')).toBeUndefined()
  })

  it('authenticates project/file requests and exposes virtual file handles', async () => {
    const files = {
      'adv.config.json': '{"root":"./adv"}\n',
      'adv/chapters/intro.adv.md': '# Intro\n',
    }
    const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input))
      expect(init?.headers).toMatchObject({ authorization: 'Bearer local-token' })
      expect(url.hash).toBe('')
      if (url.pathname.endsWith('/project'))
        return Response.json({ files, result: { diagnostics: [], project: {} }, root: '/tmp/game' })
      if (init?.method === 'PUT')
        return Response.json({ path: url.searchParams.get('path') })
      return new Response(files[url.searchParams.get('path') as keyof typeof files])
    })
    const adapter = createLocalBridgeAdapter({
      fetch: fetcher,
      origin: 'http://127.0.0.1:3456',
      token: 'local-token',
    })

    expect(await adapter.loadProject()).toMatchObject({ root: '/tmp/game', files })
    const root = adapter.createDirectoryHandle(files, 'game')
    const adv = await root.getDirectoryHandle('adv')
    const chapters = await adv.getDirectoryHandle('chapters')
    const intro = await chapters.getFileHandle('intro.adv.md')
    expect(await (await intro.getFile()).text()).toBe('# Intro\n')

    const writable = await intro.createWritable()
    await writable.write('# Changed\n')
    await writable.close()
    expect(fetcher).toHaveBeenCalledWith(
      expect.stringContaining('path=adv%2Fchapters%2Fintro.adv.md'),
      expect.objectContaining({ body: '# Changed\n', method: 'PUT' }),
    )
  })

  it('decodes authenticated watcher events', async () => {
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(': connected\n\n'))
        controller.enqueue(encoder.encode('event: change\ndata: {"event":"change","path":"adv/chapters/intro.adv.md"}\n\n'))
        controller.close()
      },
    })
    const adapter = createLocalBridgeAdapter({
      fetch: vi.fn(async () => new Response(stream)),
      origin: 'http://127.0.0.1:3456',
      token: 'local-token',
    })
    const changes: Array<{ event: string, path: string }> = []

    await adapter.watch(change => changes.push(change)).done
    expect(changes).toEqual([{ event: 'change', path: 'adv/chapters/intro.adv.md' }])
  })
})
