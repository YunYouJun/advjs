import type cloudbase from '@cloudbase/js-sdk'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useAuthStore } from './useAuthStore'

// --- Types ---

export type CollabRole = 'owner' | 'editor' | 'viewer'
export type CollabConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface CollabMember {
  uid: string
  displayName: string
  role: CollabRole
  /** Epoch ms of last heartbeat */
  lastSeen: number
}

export interface CollabRoom {
  /** CloudBase document _id */
  _id?: string
  /** Local projectId this room is for */
  projectId: string
  /** Room owner UID */
  ownerId: string
  /** Room display name (defaults to project name) */
  name: string
  /** Member list with roles */
  members: CollabMember[]
  /** Creation timestamp */
  createdAt: number
  /** Last activity timestamp */
  updatedAt: number
}

export interface CollabOnlineUser {
  uid: string
  displayName: string
  role: CollabRole
  online: boolean
  lastSeen: number
}

// --- Constants ---

const COLLECTION_ROOMS = 'advjs_collab_rooms'
const COLLECTION_STATE = 'advjs_collab_state'
const HEARTBEAT_INTERVAL = 10_000 // 10 seconds

// --- Store ---

/**
 * Collaboration Store — manages collaboration rooms, membership, and online presence.
 *
 * Built on CloudBase database. Requires user to be logged in.
 */
export const useCollabStore = defineStore('collab', () => {
  const authStore = useAuthStore()

  // --- State ---
  const currentRoom = ref<CollabRoom | null>(null)
  const onlineUsers = ref<CollabOnlineUser[]>([])
  const connectionState = ref<CollabConnectionState>('disconnected')
  const error = ref<string | null>(null)
  const isBusy = ref(false)

  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let stateWatcher: any = null

  // --- Computed ---
  const isInRoom = computed(() => currentRoom.value !== null)
  const isOwner = computed(() =>
    currentRoom.value?.ownerId === authStore.userInfo.uid,
  )
  const myRole = computed<CollabRole | null>(() => {
    if (!currentRoom.value || !authStore.userInfo.uid)
      return null
    if (currentRoom.value.ownerId === authStore.userInfo.uid)
      return 'owner'
    const member = currentRoom.value.members.find(
      m => m.uid === authStore.userInfo.uid,
    )
    return member?.role ?? null
  })

  // --- Room CRUD ---

  /**
   * Create a collaboration room for a project.
   */
  async function createRoom(
    cloudApp: cloudbase.app.App,
    projectId: string,
    name: string,
  ): Promise<CollabRoom | null> {
    const uid = authStore.userInfo.uid
    if (!uid) {
      error.value = 'Not logged in'
      return null
    }

    isBusy.value = true
    error.value = null

    try {
      const existing = await fetchRoom(cloudApp, projectId)
      if (existing)
        return existing

      const db = cloudApp.database()
      const now = Date.now()
      const room: Omit<CollabRoom, '_id'> = {
        projectId,
        ownerId: uid,
        name,
        members: [{
          uid,
          displayName: authStore.displayName,
          role: 'owner',
          lastSeen: now,
        }],
        createdAt: now,
        updatedAt: now,
      }

      const result = await db.collection(COLLECTION_ROOMS).add(room)
      const createdId = (result as any)._id || (result as any).id
      if (!createdId)
        throw new Error('CloudBase did not return room id')
      const created: CollabRoom = { ...room, _id: createdId as string }
      currentRoom.value = created
      return created
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
   * Fetch the collaboration room for a project (if any).
   */
  async function fetchRoom(
    cloudApp: cloudbase.app.App,
    projectId: string,
  ): Promise<CollabRoom | null> {
    const uid = authStore.userInfo.uid
    if (!uid)
      return null

    try {
      const db = cloudApp.database()
      // Find room where user is owner or member
      const result = await db.collection(COLLECTION_ROOMS)
        .where({ projectId })
        .limit(1)
        .get()

      if (result.data && result.data.length > 0) {
        const room = result.data[0] as CollabRoom
        // Verify user has access
        const isMember = room.ownerId === uid
          || room.members.some(m => m.uid === uid)
        if (isMember) {
          currentRoom.value = room
          return room
        }
      }
      return null
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      return null
    }
  }

  /**
   * Invite a user to the current room (via server-side cloud function).
   */
  async function inviteMember(
    cloudApp: cloudbase.app.App,
    targetUid: string,
    displayName: string,
    role: CollabRole = 'editor',
  ): Promise<boolean> {
    if (!currentRoom.value?._id || !isOwner.value) {
      error.value = 'Not room owner'
      return false
    }

    try {
      if (currentRoom.value.members.some(m => m.uid === targetUid)) {
        error.value = 'Member already exists'
        return false
      }

      const result = await cloudApp.callFunction({
        name: 'collab-auth',
        data: {
          action: 'invite',
          roomId: currentRoom.value._id,
          targetUid,
          displayName,
          role,
        },
      }) as any

      const res = result.result || result
      if (res.error) {
        error.value = res.error
        return false
      }

      // Update local state
      if (res.member)
        currentRoom.value.members.push(res.member)

      return true
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      return false
    }
  }

  /**
   * Remove a member from the current room (via server-side cloud function).
   */
  async function removeMember(
    cloudApp: cloudbase.app.App,
    targetUid: string,
  ): Promise<boolean> {
    if (!currentRoom.value?._id || !isOwner.value) {
      error.value = 'Not room owner'
      return false
    }

    try {
      const result = await cloudApp.callFunction({
        name: 'collab-auth',
        data: {
          action: 'remove',
          roomId: currentRoom.value._id,
          targetUid,
        },
      }) as any

      const res = result.result || result
      if (res.error) {
        error.value = res.error
        return false
      }

      currentRoom.value.members = currentRoom.value.members.filter(
        m => m.uid !== targetUid,
      )
      return true
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      return false
    }
  }

  /**
   * Update a member's role (via server-side cloud function).
   */
  async function updateMemberRole(
    cloudApp: cloudbase.app.App,
    targetUid: string,
    role: CollabRole,
  ): Promise<boolean> {
    if (!currentRoom.value?._id || !isOwner.value) {
      error.value = 'Not room owner'
      return false
    }

    try {
      const result = await cloudApp.callFunction({
        name: 'collab-auth',
        data: {
          action: 'updateRole',
          roomId: currentRoom.value._id,
          targetUid,
          role,
        },
      }) as any

      const res = result.result || result
      if (res.error) {
        error.value = res.error
        return false
      }

      // Update local state
      const member = currentRoom.value.members.find(m => m.uid === targetUid)
      if (member)
        member.role = role

      return true
    }
    catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
      return false
    }
  }

  // --- Online Presence ---

  /**
   * Start sending heartbeats and watching online presence.
   */
  async function startPresence(cloudApp: cloudbase.app.App) {
    if (!currentRoom.value?._id || !authStore.userInfo.uid)
      return

    stopPresence()

    const db = cloudApp.database()
    const roomId = currentRoom.value._id
    const uid = authStore.userInfo.uid!

    // Send initial heartbeat
    await sendHeartbeat(db, roomId, uid)

    // Clean up stale presence records (TTL: 60s)
    try {
      const _ = db.command
      await db.collection(COLLECTION_STATE)
        .where({
          roomId,
          lastSeen: _.lt(Date.now() - 60_000),
        })
        .remove()
    }
    catch {
      // Non-critical — stale records will be cleaned on next heartbeat
    }

    // Periodic heartbeat
    heartbeatTimer = setInterval(() => {
      sendHeartbeat(db, roomId, uid)
    }, HEARTBEAT_INTERVAL)

    // Watch for presence changes
    try {
      stateWatcher = db.collection(COLLECTION_STATE)
        .where({ roomId })
        .watch({
          onChange: (snapshot: any) => {
            if (snapshot.docs) {
              onlineUsers.value = snapshot.docs.map((doc: any) => ({
                uid: doc.uid,
                displayName: doc.displayName,
                role: doc.role || 'viewer',
                online: Date.now() - doc.lastSeen < HEARTBEAT_INTERVAL * 3,
                lastSeen: doc.lastSeen,
              }))
            }
          },
          onError: (err: any) => {
            console.warn('[Collab] Presence watch error:', err)
          },
        })
    }
    catch {
      // watch() not available or failed — graceful degradation
    }
  }

  /**
   * Stop presence tracking.
   */
  function stopPresence() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer)
      heartbeatTimer = null
    }
    if (stateWatcher) {
      stateWatcher.close?.()
      stateWatcher = null
    }
    onlineUsers.value = []
  }

  /**
   * Send a heartbeat to the presence collection.
   */
  async function sendHeartbeat(
    db: ReturnType<cloudbase.app.App['database']>,
    roomId: string,
    uid: string,
  ) {
    try {
      const doc = {
        roomId,
        uid,
        displayName: authStore.displayName,
        role: myRole.value || 'viewer',
        lastSeen: Date.now(),
      }

      // Idempotent upsert using deterministic _id to avoid duplicates
      const docId = `${roomId}_${uid}`
      await db.collection(COLLECTION_STATE).doc(docId).set(doc)
    }
    catch {
      // Non-critical — next heartbeat will retry
    }
  }

  // --- Connection lifecycle ---

  /**
   * Connect to a collaboration room.
   */
  async function connect(cloudApp: cloudbase.app.App, projectId: string) {
    connectionState.value = 'connecting'
    error.value = null

    try {
      const room = await fetchRoom(cloudApp, projectId)
      if (room) {
        await startPresence(cloudApp)
        connectionState.value = 'connected'
      }
      else {
        connectionState.value = 'disconnected'
      }
    }
    catch (err) {
      connectionState.value = 'error'
      error.value = err instanceof Error ? err.message : String(err)
    }
  }

  /**
   * Disconnect from the current room.
   */
  function disconnect() {
    stopPresence()
    currentRoom.value = null
    connectionState.value = 'disconnected'
    error.value = null
  }

  return {
    // State
    currentRoom,
    onlineUsers,
    connectionState,
    error,
    isBusy,

    // Computed
    isInRoom,
    isOwner,
    myRole,

    // Room management
    createRoom,
    fetchRoom,
    inviteMember,
    removeMember,
    updateMemberRole,

    // Presence
    startPresence,
    stopPresence,

    // Connection
    connect,
    disconnect,
  }
})
