import type { AdvAssetEntry } from '@advjs/types'
import { ref } from 'vue'
import { useAuthStore } from '../stores/useAuthStore'
import { useStudioStore } from '../stores/useStudioStore'
import { createManagedAssetUploader } from '../utils/assetUpload'
import { loadStudioAssetCatalog, upsertStudioProjectAsset } from '../utils/projectAssets'
import { useCloudbaseApp } from './useCloudbase'
import { useProjectContent } from './useProjectContent'

function localAssetPath(path: string): string {
  return path.startsWith('adv/') ? path : `adv/assets/${path.replace(/^\//u, '')}`
}

/** Explicit local-first publishing path used by Studio asset cards. */
export function useManagedAssetStorage() {
  const cloudApp = useCloudbaseApp()
  const authStore = useAuthStore()
  const studioStore = useStudioStore()
  const projectContent = useProjectContent()
  const publishing = ref(new Set<string>())
  const uploader = createManagedAssetUploader({
    callFunction: options => cloudApp.callFunction(options) as Promise<{ result?: unknown }>,
  })

  async function publish(assetId: string): Promise<AdvAssetEntry> {
    if (!authStore.isLoggedIn)
      throw new Error('Login required')
    const fs = projectContent.getFs()
    if (!fs)
      throw new Error('Publishing requires a local project')
    const catalog = await loadStudioAssetCatalog(fs)
    if (!catalog)
      throw new Error('Asset catalog was not found')
    const asset = catalog.get(assetId)
    if (!asset?.path) {
      catalog.dispose()
      throw new Error(`Local source is missing for ${assetId}`)
    }

    publishing.value = new Set(publishing.value).add(assetId)
    try {
      const blob = await fs.readBlob(localAssetPath(asset.path))
      const file = asset.mimeType && !blob.type
        ? blob.slice(0, blob.size, asset.mimeType)
        : blob
      const uploaded = await uploader.upload({
        projectId: studioStore.currentProjectId,
        assetId,
        fileName: asset.path.split('/').pop() || `${assetId.split('/').pop()}.bin`,
        file,
        kind: asset.kind,
        type: asset.type,
      })
      const merged: AdvAssetEntry = { ...asset, ...uploaded, path: asset.path }
      await upsertStudioProjectAsset(fs, merged, { catalogId: studioStore.currentProjectId })
      return merged
    }
    finally {
      catalog.dispose()
      const next = new Set(publishing.value)
      next.delete(assetId)
      publishing.value = next
    }
  }

  function isPublishing(assetId: string | undefined): boolean {
    return Boolean(assetId && publishing.value.has(assetId))
  }

  return { publish, publishing, isPublishing }
}
