import type { AdvAssetEntry } from '@advjs/types'
import { createAdvAssetCatalog, planAdvAssetManifestUpsert } from '@advjs/assets'
import { defineStore } from 'pinia'

export const useProjectAssets = defineStore('editor:project-assets', () => {
  const projectStore = useProjectStore()
  const manifest = computed(() => projectStore.project?.compilation.project.assets)
  const audio = computed(() => manifest.value?.assets.filter(asset => asset.type === 'audio') ?? [])
  const error = ref('')
  function rootPath() {
    const config = JSON.parse(projectStore.project?.files['adv.config.json'] ?? '{}')
    return `${String(config.root ?? './adv').replace(/^\.\//u, '')}/assets.json`
  }
  async function upsert(asset: AdvAssetEntry, expectedFiles = projectStore.project?.files) {
    if (!expectedFiles)
      throw new Error('Open a project first')
    const plan = planAdvAssetManifestUpsert({ files: expectedFiles, rootPath: rootPath(), catalogId: manifest.value?.id ?? 'project', asset, replaceExisting: true })
    await projectStore.writeProjectFiles(Object.entries(plan.writes).map(([path, content]) => ({ path, content, expected: expectedFiles[path] ?? null })))
  }
  async function importFile(file: File, kind: AdvAssetEntry['kind'], characterId?: string) {
    const source = projectStore.workspace
    const files = projectStore.project?.files
    if (!source?.importAsset || !files)
      throw new Error('Open a writable project first')
    const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join('')
    const suffix = file.name.replace(/[^\p{L}\p{N}._-]/gu, '_')
    const id = `${kind}-${crypto.randomUUID()}`
    // A fresh path avoids collisions and never replaces another shared resource.
    const path = `imports/${id}-${suffix}`
    const diskPath = `adv/assets/${path}`
    await source.importAsset(diskPath, file)
    const asset: AdvAssetEntry = { id, kind, type: file.type.startsWith('audio/') || ['bgm', 'sfx', 'voice'].includes(kind) ? 'audio' : 'image', path, title: file.name, alt: '', sha256, bytes: file.size, mimeType: file.type, characterId }
    try {
      if (projectStore.workspace !== source)
        throw new Error('项目已切换，导入已取消')
      await upsert(asset, files)
    }
    catch (failure) {
      try {
        await source.removeImportedAsset?.(diskPath, file)
      }
      catch (cleanup) {
        throw new Error(`${String(failure)};
 imported file retained for recovery: ${diskPath};
 ${String(cleanup)}`)
      }
      throw failure
    }
    return { asset, src: `./${diskPath}` }
  }
  async function remove(asset: AdvAssetEntry) {
    const files = projectStore.project?.files
    if (!files)
      throw new Error('Open a project first')
    const path = rootPath()
    const root = JSON.parse(files[path])
    const paths = Array.isArray(root.includes) ? root.includes.map((include: string) => `${path.slice(0, path.lastIndexOf('/'))}/${include}`) : [path]
    const changes = paths.flatMap((filePath: string) => {
      const document = JSON.parse(files[filePath])
      if (!document.assets?.some((item: AdvAssetEntry) => item.id === asset.id))
        return []
      document.assets = document.assets.filter((item: AdvAssetEntry) => item.id !== asset.id)
      return [{ path: filePath, expected: files[filePath], content: `${JSON.stringify(document, null, 2)}\n` }]
    })
    await projectStore.writeProjectFiles(changes)
    // Binary files may still be referenced by scripts or other characters.
  }
  async function url(asset: AdvAssetEntry) {
    if (!manifest.value)
      throw new Error('Asset manifest is missing')
    const catalog = createAdvAssetCatalog(manifest.value, { profile: manifest.value.profiles.local ? 'local' : undefined, adapter: { resolve: async asset => asset.provider === 'project' ? await projectStore.projectAssetUrl(asset.location) : asset.baseUrl ? new URL(asset.location, asset.baseUrl).href : asset.location } })
    return (await catalog.resolve(asset.id)).src
  }
  async function media(asset: AdvAssetEntry) {
    if (!manifest.value)
      throw new Error('Asset manifest is missing')
    let revision = ''
    const catalog = createAdvAssetCatalog(manifest.value, { profile: manifest.value.profiles.local ? 'local' : undefined, adapter: { resolve: async (asset) => {
      if (asset.provider !== 'project') {
        const src = asset.baseUrl ? new URL(asset.location, asset.baseUrl).href : asset.location
        revision = src
        return src
      }
      const source = projectStore.workspace
      if (!source?.readAsset)
        throw new Error('Workspace cannot read media')
      const blob = await source.readAsset(asset.location)
      revision = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))].map(byte => byte.toString(16).padStart(2, '0')).join('')
      return URL.createObjectURL(blob)
    } } })
    return { src: (await catalog.resolve(asset.id)).src, revision }
  }
  return { manifest, audio, error, upsert, importFile, remove, url, media }
})
