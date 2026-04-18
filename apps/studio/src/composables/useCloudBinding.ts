import type cloudbase from '@cloudbase/js-sdk'
import type { StudioProject } from '../stores/useStudioStore'
import { ref } from 'vue'
import { useAuthStore } from '../stores/useAuthStore'

/**
 * CloudBase collection name for project cloud bindings.
 */
const COLLECTION = 'advjs_projects'

export interface CloudProjectRecord {
  /** CloudBase document _id */
  _id?: string
  /** Local projectId (slug) */
  projectId: string
  /** CloudBase user UID (owner) */
  ownerId: string
  /** Project display name */
  name: string
  /** Short description */
  description?: string
  /** Cover image URL or data URL */
  cover?: string
  /** Project source type */
  source?: string
  /** COS object key prefix */
  cosPrefix?: string
  /** Whether the project is published (visible in portfolio) */
  published: boolean
  /** Creation statistics snapshot */
  stats?: {
    chapters: number
    characters: number
    scenes: number
    locations: number
  }
  /** Created timestamp */
  createdAt: number
  /** Last updated timestamp */
  updatedAt: number
}

/**
 * Composable for binding local projects to CloudBase database records.
 *
 * Each bound project is stored as a document in the `advjs_projects` collection,
 * associated with the current user's UID. This enables:
 * - Cross-device project discovery
 * - Portfolio page (listing published projects)
 * - Future marketplace integration
 */
export function useCloudBinding() {
  const authStore = useAuthStore()
  const isBusy = ref(false)
  const error = ref<string | null>(null)

  /**
   * Get the database instance from CloudBase app.
   */
  function getDb(cloudApp: cloudbase.app.App) {
    return cloudApp.database()
  }

  /**
   * Bind a local project to the cloud (create or update).
   * Returns the cloud document _id.
   */
  async function bindProject(
    cloudApp: cloudbase.app.App,
    project: StudioProject,
    options?: { published?: boolean, stats?: CloudProjectRecord['stats'] },
  ): Promise<string | null> {
    const uid = authStore.userInfo.uid
    if (!uid) {
      error.value = 'Not logged in'
      return null
    }

    isBusy.value = true
    error.value = null

    try {
      const db = getDb(cloudApp)
      const collection = db.collection(COLLECTION)
      const now = Date.now()

      // Check if already bound
      const existing = await collection
        .where({ projectId: project.projectId, ownerId: uid })
        .get()

      const record: Omit<CloudProjectRecord, '_id'> = {
        projectId: project.projectId,
        ownerId: uid,
        name: project.name,
        description: project.description,
        cover: project.cover,
        source: project.source,
        cosPrefix: project.cosPrefix,
        published: options?.published ?? false,
        stats: options?.stats,
        createdAt: (existing.data?.[0] as CloudProjectRecord)?.createdAt || now,
        updatedAt: now,
      }

      if (existing.data && existing.data.length > 0) {
        // Update existing record
        const docId = (existing.data[0] as CloudProjectRecord)._id!
        await collection.doc(docId).update(record)
        return docId
      }
      else {
        // Create new record
        const result = await collection.add(record)
        return result.id as string
      }
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      return null
    }
    finally {
      isBusy.value = false
    }
  }

  /**
   * Unbind a project from the cloud.
   */
  async function unbindProject(
    cloudApp: cloudbase.app.App,
    projectId: string,
  ): Promise<boolean> {
    const uid = authStore.userInfo.uid
    if (!uid)
      return false

    isBusy.value = true
    error.value = null

    try {
      const db = getDb(cloudApp)
      const existing = await db.collection(COLLECTION)
        .where({ projectId, ownerId: uid })
        .get()

      if (existing.data && existing.data.length > 0) {
        await db.collection(COLLECTION)
          .doc((existing.data[0] as CloudProjectRecord)._id!)
          .remove()
      }
      return true
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      return false
    }
    finally {
      isBusy.value = false
    }
  }

  /**
   * Fetch all cloud-bound projects for the current user.
   */
  async function fetchMyProjects(
    cloudApp: cloudbase.app.App,
  ): Promise<CloudProjectRecord[]> {
    const uid = authStore.userInfo.uid
    if (!uid)
      return []

    isBusy.value = true
    error.value = null

    try {
      const db = getDb(cloudApp)
      const result = await db.collection(COLLECTION)
        .where({ ownerId: uid })
        .orderBy('updatedAt', 'desc')
        .limit(100)
        .get()

      return (result.data || []) as CloudProjectRecord[]
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      return []
    }
    finally {
      isBusy.value = false
    }
  }

  /**
   * Fetch published projects for a given user (for portfolio page).
   */
  async function fetchPublishedProjects(
    cloudApp: cloudbase.app.App,
    ownerId?: string,
  ): Promise<CloudProjectRecord[]> {
    const uid = ownerId || authStore.userInfo.uid
    if (!uid)
      return []

    isBusy.value = true
    error.value = null

    try {
      const db = getDb(cloudApp)
      const result = await db.collection(COLLECTION)
        .where({ ownerId: uid, published: true })
        .orderBy('updatedAt', 'desc')
        .limit(100)
        .get()

      return (result.data || []) as CloudProjectRecord[]
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      return []
    }
    finally {
      isBusy.value = false
    }
  }

  /**
   * Toggle the published state of a project.
   */
  async function togglePublished(
    cloudApp: cloudbase.app.App,
    projectId: string,
    published: boolean,
  ): Promise<boolean> {
    const uid = authStore.userInfo.uid
    if (!uid)
      return false

    try {
      const db = getDb(cloudApp)
      const existing = await db.collection(COLLECTION)
        .where({ projectId, ownerId: uid })
        .get()

      if (existing.data && existing.data.length > 0) {
        await db.collection(COLLECTION)
          .doc((existing.data[0] as CloudProjectRecord)._id!)
          .update({ published, updatedAt: Date.now() })
        return true
      }
      return false
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      return false
    }
  }

  return {
    isBusy,
    error,
    bindProject,
    unbindProject,
    fetchMyProjects,
    fetchPublishedProjects,
    togglePublished,
  }
}
