import type cloudbase from '@cloudbase/js-sdk'
import { storeToRefs } from 'pinia'
import { computed, onUnmounted, ref, watch } from 'vue'
import { IndexeddbPersistence } from 'y-indexeddb'
import * as Y from 'yjs'
import { useAuthStore } from '../stores/useAuthStore'
import { useCollabStore } from '../stores/useCollabStore'
import { useStudioStore } from '../stores/useStudioStore'
import { YCloudbaseProvider } from '../utils/y-cloudbase'
import { useCloudbaseApp } from './useCloudbase'
import { useCollabSync } from './useCollabSync'

export type CollabDocType = 'chapter' | 'character' | 'scene' | 'location'

/**
 * Composable for managing a collaborative editing session.
 *
 * Connects the Yjs document to CloudBase via y-cloudbase provider,
 * and exposes Y.Text instances for shared text editing.
 */
export function useCollabRoom() {
  const authStore = useAuthStore()
  const collabStore = useCollabStore()
  const studioStore = useStudioStore()
  const {
    currentRoom,
    onlineUsers,
    connectionState,
    error,
    isBusy,
    isInRoom,
    isOwner,
    myRole,
  } = storeToRefs(collabStore)

  let cloudApp: cloudbase.app.App | null = null
  try {
    cloudApp = useCloudbaseApp()
  }
  catch {
    // CloudBase not available
  }

  // Yjs state
  const ydoc = ref<Y.Doc | null>(null)
  const provider = ref<YCloudbaseProvider | null>(null)
  let idbPersistence: IndexeddbPersistence | null = null
  const isSynced = ref(false)
  const isAvailable = computed(() => !!cloudApp && authStore.isLoggedIn && !!studioStore.currentProject)

  // State sync bridge (character states, world clock, chat messages)
  const collabSync = useCollabSync()

  /**
   * Start a collaborative session for the current project.
   * Creates a Yjs document, loads local cache via y-indexeddb first,
   * then connects to CloudBase via y-cloudbase provider.
   * Viewers are prevented from writing local changes.
   */
  async function startSession() {
    if (!cloudApp || !authStore.isLoggedIn || !currentRoom.value?._id)
      return

    stopSession()

    // Create Yjs document
    const doc = new Y.Doc()
    ydoc.value = doc

    const roomId = currentRoom.value._id
    const isViewer = myRole.value === 'viewer'

    // 1. Load local cache first (y-indexeddb)
    try {
      idbPersistence = new IndexeddbPersistence(`advjs-collab-${roomId}`, doc)
      await idbPersistence.whenSynced
    }
    catch {
      // IndexedDB not available — continue without offline cache
    }

    // 2. Connect to remote provider
    const p = new YCloudbaseProvider(doc, {
      cloudApp,
      roomId,
      clientId: authStore.userId || 'anonymous',
      displayName: authStore.displayName,
    })

    p.on('synced', () => {
      isSynced.value = true
      // Auto-start state sync (skip for viewers — read-only)
      if (!isViewer)
        collabSync.startSync(getSharedMap, getSharedArray)
    })

    p.on('status', ([{ status }]: [{ status: string }]) => {
      if (status === 'disconnected') {
        isSynced.value = false
        collabSync.stopSync()
      }
    })

    provider.value = p
    await p.connect()
  }

  /**
   * Stop the collaborative session.
   */
  function stopSession() {
    collabSync.stopSync()
    provider.value?.destroy()
    provider.value = null
    idbPersistence?.destroy()
    idbPersistence = null
    ydoc.value?.destroy()
    ydoc.value = null
    isSynced.value = false
  }

  /**
   * Get or create a shared Y.Text for a file path.
   * Each file is mapped to a unique Y.Text keyed by its relative path.
   */
  function getSharedText(filePath: string): Y.Text | null {
    if (!ydoc.value)
      return null
    return ydoc.value.getText(`file:${filePath}`)
  }

  /**
   * Get or create a shared Y.Map for structured data.
   */
  function getSharedMap(key: string): Y.Map<any> | null {
    if (!ydoc.value)
      return null
    return ydoc.value.getMap(key)
  }

  /**
   * Get or create a shared Y.Array (e.g., for chat messages).
   */
  function getSharedArray(key: string): Y.Array<any> | null {
    if (!ydoc.value)
      return null
    return ydoc.value.getArray(key)
  }

  /**
   * Join a collaboration room for the current project.
   */
  async function joinRoom() {
    if (!cloudApp || !authStore.isLoggedIn || !studioStore.currentProject)
      return false

    const projectId = studioStore.currentProjectId
    await collabStore.connect(cloudApp, projectId)

    if (isInRoom.value) {
      await startSession()
      return true
    }
    return false
  }

  /**
   * Create a new collaboration room for the current project.
   */
  async function createAndJoinRoom(name?: string) {
    if (!cloudApp || !authStore.isLoggedIn || !studioStore.currentProject)
      return false

    const projectId = studioStore.currentProjectId
    const projectName = studioStore.currentProject?.name || projectId
    const room = await collabStore.createRoom(
      cloudApp,
      projectId,
      name || projectName,
    )

    if (room) {
      await collabStore.startPresence(cloudApp)
      await startSession()
      return true
    }
    return false
  }

  /**
   * Leave the current collaboration room.
   */
  function leaveRoom() {
    stopSession()
    collabStore.disconnect()
  }

  // Auto-cleanup on unmount
  onUnmounted(() => {
    leaveRoom()
  })

  // Auto-disconnect when project changes
  watch(
    () => studioStore.currentProjectId,
    () => {
      if (isInRoom.value)
        leaveRoom()
    },
  )

  return {
    // Yjs state
    ydoc,
    provider,
    isSynced,

    // Room lifecycle
    joinRoom,
    createAndJoinRoom,
    leaveRoom,

    // Shared types
    getSharedText,
    getSharedMap,
    getSharedArray,

    // Store state
    isAvailable,
    currentRoom,
    isInRoom,
    isOwner,
    onlineUsers,
    connectionState,
    error,
    isBusy,
    myRole,
  }
}
