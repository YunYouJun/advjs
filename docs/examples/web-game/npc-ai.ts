import type { AdvRuntime } from '@advjs/core/runtime'
import { defineAdvPlugin } from '@advjs/core/runtime'

export interface NpcRequest {
  requestId: string
  characterId: 'keeper'
  topic: 'town'
  playerText: string
  context: { hasQuest: boolean }
}
export interface NpcReply { requestId: string, text: string, source: 'ai' | 'fallback' }
export type NpcTransport = (request: NpcRequest, signal: AbortSignal) => Promise<unknown>

function parseReply(value: unknown, requestId: string): NpcReply {
  if (!value || typeof value !== 'object')
    throw new Error('Invalid NPC reply')
  const data = value as Record<string, unknown>
  if (data.requestId !== requestId || typeof data.text !== 'string' || !data.text.trim() || data.text.length > 600)
    throw new Error('Invalid NPC reply')
  return { requestId, text: data.text, source: 'ai' }
}

export function npcAi() {
  return defineAdvPlugin({
    name: 'npc-ai',
    version: '1.0.0',
    nodes: { reply: ({ activity, node }) => activity('reply', node.data ?? {}) },
    activities: {
      reply({ state }, result) {
        if (!result || typeof result !== 'object' || Array.isArray(result) || typeof result.requestId !== 'string'
          || typeof result.text !== 'string' || !result.text.trim() || result.text.length > 600
          || (result.source !== 'ai' && result.source !== 'fallback')) {
          throw new Error('Invalid NPC result')
        }
        state.variables.npcReply = { requestId: result.requestId, text: result.text, source: result.source }
      },
    },
    // Requires the host to reuse its saved request ID and the backend to cache replies.
    activityRollback: { reply: 'supported' },
  })
}

/** The endpoint is implemented by the game backend, not provided by ADV.JS. */
export const fetchNpcReply: NpcTransport = async (request, signal) => {
  const controller = new AbortController()
  const cancel = () => controller.abort()
  signal.addEventListener('abort', cancel, { once: true })
  if (signal.aborted)
    cancel()
  const timer = setTimeout(cancel, 8000)
  try {
    const response = await fetch('/api/npc-reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    })
    if (!response.ok)
      throw new Error(`NPC service failed: ${response.status}`)
    return await response.json()
  }
  finally {
    clearTimeout(timer)
    signal.removeEventListener('abort', cancel)
  }
}

/** Serialize calls per session; abort before close, restore or starting a new turn. */
export async function completeNpcReply(runtime: AdvRuntime, request: NpcRequest, transport: NpcTransport, signal: AbortSignal) {
  const pending = runtime.state.pendingActivity
  if (signal.aborted)
    return
  if (pending?.type !== 'npc-ai/reply' || pending.input.characterId !== request.characterId
    || pending.input.topic !== request.topic || request.playerText.length > 2000 || !request.requestId) {
    throw new Error('Unsupported NPC request')
  }
  let reply: NpcReply
  try {
    reply = parseReply(await transport(request, signal), request.requestId)
  }
  catch {
    if (signal.aborted)
      return
    reply = { requestId: request.requestId, text: '沿着主路走，路口留意来车。', source: 'fallback' }
  }
  if (signal.aborted || runtime.state.pendingActivity?.id !== pending.id)
    return
  await runtime.completeActivity({ ...reply })
  return reply
}
