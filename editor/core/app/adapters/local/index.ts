import type { AdvAgentIntegrationStatus, AdvGameConfig, AdvProjectCompileResult, AdvProjectFileMap } from '@advjs/types'
import type { BrowserProjectDirectory, BrowserProjectFile } from '../browser/project'
import { createAdvAssetCatalog } from '@advjs/assets'

export interface LocalEditorSession {
  origin: string
  token: string
}

export interface LocalBridgeProject {
  files: AdvProjectFileMap
  result: AdvProjectCompileResult
  root: string
}

export interface LocalBridgeChange {
  event: string
  path: string
}

export interface LocalBridgeWatch {
  done: Promise<void>
  stop: () => void
}

export interface LocalBridgeAdapterOptions extends LocalEditorSession {
  fetch?: typeof globalThis.fetch
}

export interface LocalFileHandle extends BrowserProjectFile {
  path: string
  createWritable: () => Promise<{
    close: () => Promise<void>
    write: (content: string | Blob) => Promise<void>
  }>
}

export interface LocalDirectoryHandle extends BrowserProjectDirectory {
  path: string
  getDirectoryHandle: (name: string) => Promise<LocalDirectoryHandle>
  getFileHandle: (name: string) => Promise<LocalFileHandle>
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '[::1]', '::1', 'localhost'])
const API_PREFIX = '/__advjs/api/'

export function parseLocalEditorSession(value: string): LocalEditorSession | undefined {
  try {
    const url = new URL(value)
    const token = new URLSearchParams(url.hash.slice(1)).get('advjs-token')
    if (!token || url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(url.hostname))
      return undefined
    return { origin: url.origin, token }
  }
  catch {
    return undefined
  }
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, 'en')
}

function joinPath(parent: string, name: string) {
  return parent ? `${parent}/${name}` : name
}

export function createLocalBridgeAdapter(options: LocalBridgeAdapterOptions) {
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis)
  const assetBlobUrls = new Set<string>()

  async function request(path: string, init: RequestInit = {}) {
    const response = await fetcher(`${options.origin}${API_PREFIX}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${options.token}`,
        ...init.headers,
      },
    })
    if (!response.ok) {
      const detail = await response.json().catch(() => undefined) as { error?: string } | undefined
      throw new Error(detail?.error ?? `Local Editor request failed (${response.status})`)
    }
    return response
  }

  async function loadProject() {
    return await (await request('project')).json() as LocalBridgeProject
  }

  async function loadCodexStatus() {
    return await (await request('agent/codex')).json() as AdvAgentIntegrationStatus
  }

  async function readFile(path: string) {
    return await (await request(`file?path=${encodeURIComponent(path)}`)).text()
  }

  async function readAssetBlobUrl(path: string) {
    const blob = await (await request(`asset?path=${encodeURIComponent(path)}`)).blob()
    const url = URL.createObjectURL(blob)
    assetBlobUrls.add(url)
    return url
  }

  async function resolvePreviewConfig(
    compilation: AdvProjectCompileResult,
    previewConfig: AdvGameConfig,
  ): Promise<AdvGameConfig> {
    for (const url of assetBlobUrls)
      URL.revokeObjectURL(url)
    assetBlobUrls.clear()
    const manifest = compilation.project.assets
    if (!manifest)
      return previewConfig
    const catalog = createAdvAssetCatalog(manifest, {
      profile: manifest.profiles.local ? 'local' : undefined,
      adapter: {
        async resolve(asset) {
          if (asset.provider === 'project')
            return await readAssetBlobUrl(asset.location)
          if (/^(?:https?:|blob:|data:)/u.test(asset.location))
            return asset.location
          if (!asset.baseUrl)
            throw new Error(`Asset profile "${asset.profile}" has no baseUrl`)
          return new URL(asset.location, asset.baseUrl).href
        },
      },
    })
    const projectScenes = new Map(compilation.project.scenes.map(scene => [scene.id, scene]))
    return {
      ...previewConfig,
      scenes: await Promise.all(previewConfig.scenes.map(async (scene) => {
        const assetId = projectScenes.get(scene.id)?.assetId
        if (!assetId)
          return scene
        const resolved = await catalog.resolve(assetId)
        return { ...scene, src: resolved.src }
      })),
    }
  }

  async function writeProjectFile(path: string, content: string) {
    return await (await request(`file?path=${encodeURIComponent(path)}`, {
      body: content,
      method: 'PUT',
    })).json()
  }

  function createDirectoryHandle(files: AdvProjectFileMap, name: string): LocalDirectoryHandle {
    const paths = Object.keys(files)

    function directory(path: string, directoryName: string): LocalDirectoryHandle {
      const childPrefix = path ? `${path}/` : ''
      const childNames = new Set<string>()
      for (const filePath of paths) {
        if (!filePath.startsWith(childPrefix))
          continue
        const child = filePath.slice(childPrefix.length).split('/')[0]
        if (child)
          childNames.add(child)
      }

      const handle: LocalDirectoryHandle = {
        kind: 'directory',
        name: directoryName,
        path,
        async getDirectoryHandle(childName) {
          const childPath = joinPath(path, childName)
          if (!paths.some(filePath => filePath.startsWith(`${childPath}/`)))
            throw new DOMException(`Directory not found: ${childPath}`, 'NotFoundError')
          return directory(childPath, childName)
        },
        async getFileHandle(childName) {
          const childPath = joinPath(path, childName)
          if (!(childPath in files))
            throw new DOMException(`File not found: ${childPath}`, 'NotFoundError')
          return file(childPath, childName)
        },
        async* values() {
          for (const childName of [...childNames].sort(compareText)) {
            const childPath = joinPath(path, childName)
            if (childPath in files)
              yield file(childPath, childName)
            else
              yield directory(childPath, childName)
          }
        },
      }
      return handle
    }

    function file(path: string, fileName: string): LocalFileHandle {
      return {
        kind: 'file',
        name: fileName,
        path,
        async createWritable() {
          let nextContent = files[path] ?? ''
          return {
            async close() {
              await writeProjectFile(path, nextContent)
              files[path] = nextContent
            },
            async write(content) {
              nextContent = typeof content === 'string' ? content : await content.text()
            },
          }
        },
        async getFile() {
          const content = await readFile(path)
          return new File([content], fileName, {
            lastModified: Date.now(),
            type: 'text/plain',
          })
        },
      }
    }

    return directory('', name)
  }

  function watch(onChange: (change: LocalBridgeChange) => void): LocalBridgeWatch {
    const controller = new AbortController()
    const done = (async () => {
      const response = await request('events', { signal: controller.signal })
      const reader = response.body?.getReader()
      if (!reader)
        return
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done)
          break
        buffer += decoder.decode(value, { stream: true }).replaceAll('\r\n', '\n')
        let boundary = buffer.indexOf('\n\n')
        while (boundary >= 0) {
          const block = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          const data = block
            .split('\n')
            .filter(line => line.startsWith('data:'))
            .map(line => line.slice('data:'.length).trimStart())
            .join('\n')
          if (data)
            onChange(JSON.parse(data) as LocalBridgeChange)
          boundary = buffer.indexOf('\n\n')
        }
      }
    })().catch((error) => {
      if (!controller.signal.aborted)
        throw error
    })
    return {
      done,
      stop: () => controller.abort(),
    }
  }

  return {
    createDirectoryHandle,
    loadCodexStatus,
    loadProject,
    origin: options.origin,
    readFile,
    resolvePreviewConfig,
    token: options.token,
    watch,
    writeFile: writeProjectFile,
  }
}

export type LocalBridgeAdapter = ReturnType<typeof createLocalBridgeAdapter>
