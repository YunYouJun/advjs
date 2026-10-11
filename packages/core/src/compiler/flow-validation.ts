import type { AdvChapter } from '@advjs/types'
import type { CompileDiagnostic, CompileSourceLocation } from './types'
import { isRuntimeIdentifier } from './address'

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function target(value: unknown) {
  return typeof value === 'string'
    ? Boolean(value.trim())
    : record(value) && typeof value.chapterId === 'string' && typeof value.nodeId === 'string'
      && isRuntimeIdentifier(value.chapterId) && isRuntimeIdentifier(value.nodeId)
}

/** Validate untrusted serialized author data before it reaches the common linker. */
export function validateFlowChapter(value: unknown, diagnostics: CompileDiagnostic[], source?: CompileSourceLocation): value is AdvChapter {
  const fail = (message: string, code = 'ADV_RUNTIME_INVALID_FLOW_NODE') => diagnostics.push({ code, severity: 'error', message, source })
  if (!record(value) || typeof value.id !== 'string' || !isRuntimeIdentifier(value.id)
    || typeof value.title !== 'string' || !Array.isArray(value.nodes) || value.nodes.length > 10000
    || (value.startNodeId !== undefined && (typeof value.startNodeId !== 'string' || !isRuntimeIdentifier(value.startNodeId)))) {
    fail('Flow chapters require valid id, title, nodes and optional startNodeId', 'ADV_RUNTIME_INVALID_FLOW_CHAPTER')
    return false
  }
  let valid = true
  for (const node of value.nodes) {
    const before = diagnostics.length
    if (!record(node) || typeof node.id !== 'string' || !isRuntimeIdentifier(node.id)) {
      fail(`Flow chapter ${value.id} contains a node without a valid stable id`)
      valid = false
      continue
    }
    const context = `${value.id}#${node.id}`
    if (node.next !== undefined && node.next !== null && !target(node.next))
      fail(`Invalid Flow next target in ${context}`)
    if (node.target !== undefined)
      fail(`Legacy target in ${context} must be migrated to next`, 'ADV_RUNTIME_LEGACY_FLOW_TARGET')
    switch (node.type) {
      case 'start':
      case 'end':
        break
      case 'audio':
        if (!Array.isArray(node.operations) || node.operations.length > 64
          || node.operations.some(operation => !record(operation) || !['bgm', 'ambience', 'sfx'].includes(String(operation.type)))) {
          fail(`Flow audio ${context} requires at most 64 canonical audio operations`)
        }
        break
      case 'background':
        if (typeof node.name !== 'string' || !node.name.trim() || (node.src !== undefined && typeof node.src !== 'string'))
          fail(`Flow background ${context} requires a scene or asset name and optional src`)
        break
      case 'tachie':
        if (typeof node.name !== 'string' || !node.name.trim() || !['enter', 'exit'].includes(String(node.action))
          || (node.status !== undefined && typeof node.status !== 'string')
          || [node.enter, node.exit].some(items => items !== undefined && !(typeof items === 'string' || (Array.isArray(items) && items.every(item => typeof item === 'string'))))) {
          fail(`Flow tachie ${context} requires a character and enter/exit action`)
        }
        break
      case 'narration':
        if (typeof node.text !== 'string' || node.text.length > 1024 * 1024)
          fail(`Flow narration ${context} requires bounded text`)
        break
      case 'dialogues':
      case undefined:
        if (!Array.isArray(node.dialogues) || node.dialogues.length > 10000
          || node.dialogues.some(dialogue => !record(dialogue) || typeof dialogue.text !== 'string' || dialogue.text.length > 1024 * 1024
            || (dialogue.status !== undefined && typeof dialogue.status !== 'string')
            || [dialogue.speakerId, dialogue.speaker].some(speaker => speaker !== undefined && (typeof speaker !== 'string' || !speaker.trim())))) {
          fail(`Flow dialogues ${context} requires bounded dialogue records`)
        }
        if (node.sceneId !== undefined && typeof node.sceneId !== 'string')
          fail(`Flow dialogues ${context} has an invalid sceneId`)
        break
      case 'choices':
        if (!Array.isArray(node.choices) || !node.choices.length || node.choices.length > 256
          || node.choices.some(choice => !record(choice) || typeof choice.id !== 'string' || typeof choice.text !== 'string'
            || !target(choice.target) || (choice.when !== undefined && typeof choice.when !== 'string'))) {
          fail(`Flow choices ${context} requires explicit IDs, text and targets`)
        }
        break
      case 'fountain':
        break // The compiler reports the existing mixed-format diagnostic.
      default:
        fail(`Unknown Flow node kind in ${context}: ${String(node.type)}`, 'ADV_RUNTIME_UNKNOWN_FLOW_NODE')
    }
    if (diagnostics.length !== before)
      valid = false
  }
  return valid
}
