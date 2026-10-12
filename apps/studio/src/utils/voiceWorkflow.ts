export type VoiceWorkflowSection = 'design' | 'jobs' | 'review'

/** Navigation selects authoring scope only; it never starts synthesis or adopts audio. */
export function voiceWorkflowLocation(section: VoiceWorkflowSection, speakerId?: string, lineId?: string) {
  return { path: '/tabs/workspace/audio', query: { section, ...(speakerId ? { speaker: speakerId } : {}), ...(lineId ? { line: lineId } : {}) } }
}

export function readVoiceWorkflowQuery(query: Record<string, unknown>) {
  const text = (value: unknown) => typeof value === 'string' && value.length <= 160 && ![...value].some(character => character.charCodeAt(0) < 32) ? value : ''
  const section = ['design', 'jobs', 'review'].includes(text(query.section)) ? text(query.section) as VoiceWorkflowSection : undefined
  return { section, speakerId: text(query.speaker), lineId: text(query.line) }
}
