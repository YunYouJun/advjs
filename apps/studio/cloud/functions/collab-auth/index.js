/**
 * CloudBase function: collaboration auth & member management.
 *
 * Actions:
 *   - invite:     Add a member to a room (owner only).
 *   - remove:     Remove a member from a room (owner only).
 *   - updateRole: Change a member's role (owner only).
 *
 * All actions verify the caller is the room owner via context.auth.uid.
 *
 * Collection: advjs_collab_rooms
 */

const tcb = require('@cloudbase/node-sdk')

const app = tcb.init({ env: tcb.SYMBOL_CURRENT_ENV })
const db = app.database()
const _ = db.command
const COLLECTION = 'advjs_collab_rooms'

exports.main = async (event, context) => {
  // Get caller UID from CloudBase auth context
  const uid = context.auth && context.auth.uid
  if (!uid)
    return { error: 'Authentication required', code: 401 }

  const { action, roomId, targetUid, displayName, role } = event

  if (!roomId)
    return { error: 'roomId required', code: 400 }

  // Fetch room and verify ownership
  const roomResult = await db.collection(COLLECTION).doc(roomId).get()
  if (!roomResult.data || roomResult.data.length === 0)
    return { error: 'Room not found', code: 404 }

  const room = roomResult.data[0] || roomResult.data
  if (room.ownerId !== uid)
    return { error: 'Permission denied: not room owner', code: 403 }

  // --- Actions ---

  if (action === 'invite') {
    if (!targetUid)
      return { error: 'targetUid required', code: 400 }

    // Check duplicate
    if (room.members && room.members.some(m => m.uid === targetUid))
      return { error: 'Member already exists', code: 409 }

    const validRoles = ['editor', 'viewer']
    const memberRole = validRoles.includes(role) ? role : 'editor'

    const newMember = {
      uid: targetUid,
      displayName: displayName || targetUid,
      role: memberRole,
      lastSeen: 0,
    }

    await db.collection(COLLECTION).doc(roomId).update({
      members: _.push(newMember),
      updatedAt: Date.now(),
    })

    return { ok: true, member: newMember }
  }

  if (action === 'remove') {
    if (!targetUid)
      return { error: 'targetUid required', code: 400 }

    // Cannot remove the owner
    if (targetUid === room.ownerId)
      return { error: 'Cannot remove room owner', code: 400 }

    const updatedMembers = (room.members || []).filter(m => m.uid !== targetUid)

    await db.collection(COLLECTION).doc(roomId).update({
      members: updatedMembers,
      updatedAt: Date.now(),
    })

    return { ok: true }
  }

  if (action === 'updateRole') {
    if (!targetUid || !role)
      return { error: 'targetUid and role required', code: 400 }

    const validRoles = ['editor', 'viewer']
    if (!validRoles.includes(role))
      return { error: 'Invalid role. Must be editor or viewer', code: 400 }

    // Cannot change owner's role
    if (targetUid === room.ownerId)
      return { error: 'Cannot change owner role', code: 400 }

    const updatedMembers = (room.members || []).map(m =>
      m.uid === targetUid ? { ...m, role } : m,
    )

    await db.collection(COLLECTION).doc(roomId).update({
      members: updatedMembers,
      updatedAt: Date.now(),
    })

    return { ok: true }
  }

  return { error: 'Unknown action', code: 400 }
}
