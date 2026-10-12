const MAX_DRAFT_CHARACTERS = 512 * 1024
const PREFIX = 'advjs:editor:private-voice-listening:'

/** Recovery stays in the host's private project scope and never enters project exports. */
export function voiceListeningDraftKey(projectScope: string) {
  if (!projectScope || projectScope.length > 4096)
    throw new Error('VOICE_LISTENING_PRIVATE_SCOPE_REQUIRED')
  return `${PREFIX}${encodeURIComponent(projectScope)}`
}
export function readVoiceListeningDraft(storage: Pick<Storage, 'getItem'>, projectScope: string) {
  const content = storage.getItem(voiceListeningDraftKey(projectScope))
  if (content && content.length > MAX_DRAFT_CHARACTERS)
    throw new Error('VOICE_LISTENING_DRAFT_TOO_LARGE')
  return content
}
export function writeVoiceListeningDraft(storage: Pick<Storage, 'setItem' | 'removeItem'>, projectScope: string, content: string | null) {
  const key = voiceListeningDraftKey(projectScope)
  if (content === null) {
    storage.removeItem(key)
  }
  else {
    if (content.length > MAX_DRAFT_CHARACTERS)
      throw new Error('VOICE_LISTENING_DRAFT_TOO_LARGE')
    storage.setItem(key, content)
  }
}
