import type { FlowEditNode, FlowNodeKind } from './flow-document'
import { createAudioId } from '@advjs/audio'

export * from './flow-document'

export function createFlowNode(type: FlowNodeKind, options: { id?: string, lineId?: string } = {}): FlowEditNode {
  const id = options.id ?? `node_${createAudioId('line').slice(5)}`
  const base = { id, type, next: null }
  switch (type) {
    case 'dialogues': return { ...base, dialogues: [{ speakerId: 'narrator', text: '', lineId: options.lineId ?? createAudioId('line') }] }
    case 'narration': return { ...base, text: '', lineId: options.lineId ?? createAudioId('line') }
    case 'choices': return { ...base, choices: [] }
    case 'background': return { ...base, name: '' }
    case 'tachie': return { ...base, name: '', action: 'enter' }
    case 'audio': return { ...base, operations: [] }
    case 'start': return base
    case 'end': return { id, type }
  }
}
