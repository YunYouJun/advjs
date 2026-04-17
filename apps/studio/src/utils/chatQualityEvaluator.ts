/**
 * AI-powered chat quality auto-evaluation.
 *
 * After every 10 rounds of conversation, automatically evaluates the AI's responses
 * on three dimensions: coherence, character consistency, and information density.
 * Results are persisted to IndexedDB.
 */

import type { CharacterChatMessage } from '../stores/useCharacterChatStore'
import { runAiJsonExtraction } from './aiExtraction'
import { db } from './db'
import { getCurrentProjectId } from './projectScope'

export interface QualityScore {
  /** 0-100: logical flow and contextual coherence */
  coherence: number
  /** 0-100: how well the AI stays in character */
  characterConsistency: number
  /** 0-100: meaningful content vs filler */
  informationDensity: number
  /** Overall average score */
  overall: number
  /** ISO timestamp of evaluation */
  evaluatedAt: string
  /** Number of messages evaluated */
  messageCount: number
}

export interface DbQualityEvaluation {
  projectId: string
  characterId: string
  id: string
  score: QualityScore
}

/** How many assistant messages between auto-evaluations */
const EVALUATION_INTERVAL = 10

/** Track evaluation counts in memory to avoid redundant DB queries */
const _evaluationCounters = new Map<string, number>()

/**
 * Check if auto-evaluation should trigger and run it if needed.
 * Called after each assistant message is completed.
 */
export function checkAndTriggerEvaluation(
  characterId: string,
  characterName: string,
  messages: CharacterChatMessage[],
): void {
  const key = `${getCurrentProjectId()}:${characterId}`
  const count = (_evaluationCounters.get(key) ?? 0) + 1
  _evaluationCounters.set(key, count)

  if (count % EVALUATION_INTERVAL === 0) {
    // Fire-and-forget: run evaluation in background
    evaluateConversationQuality(characterId, characterName, messages).catch(() => {})
  }
}

/**
 * Run AI quality evaluation on the most recent conversation segment.
 */
export async function evaluateConversationQuality(
  characterId: string,
  characterName: string,
  messages: CharacterChatMessage[],
): Promise<QualityScore | null> {
  // Take the last 20 messages for evaluation (10 rounds)
  const recentMessages = messages.slice(-20)
  if (recentMessages.length < 4)
    return null

  const conversationText = recentMessages
    .map(m => `${m.role === 'assistant' ? characterName : 'Player'}: ${m.content}`)
    .join('\n')

  const result = await runAiJsonExtraction<QualityScore>(
    {
      prompt: `Evaluate the quality of the following roleplay conversation between a player and the character "${characterName}".

Score each dimension from 0 to 100:
- coherence: Does the conversation flow logically? Are responses contextually appropriate?
- character_consistency: Does the AI stay in character? Are personality, speech style, and knowledge consistent?
- information_density: Are responses meaningful and substantive? Or generic/repetitive filler?

Conversation:
${conversationText}

Return JSON: { "coherence": <number>, "character_consistency": <number>, "information_density": <number> }`,
      maxTokens: 150,
      temperature: 0.2,
    },
    (raw) => {
      const coherence = Number(raw.coherence)
      const consistency = Number(raw.character_consistency)
      const density = Number(raw.information_density)
      if (
        !Number.isFinite(coherence) || coherence < 0 || coherence > 100
        || !Number.isFinite(consistency) || consistency < 0 || consistency > 100
        || !Number.isFinite(density) || density < 0 || density > 100
      ) {
        throw new Error('invalid scores')
      }
      const overall = Math.round((coherence + consistency + density) / 3)
      return {
        coherence: Math.round(coherence),
        characterConsistency: Math.round(consistency),
        informationDensity: Math.round(density),
        overall,
        evaluatedAt: new Date().toISOString(),
        messageCount: recentMessages.length,
      }
    },
    1,
  )

  if (result) {
    // Persist to IndexedDB
    const pid = getCurrentProjectId()
    const evalId = `eval-${Date.now()}`
    try {
      await db.table('qualityEvaluations').put({
        projectId: pid,
        characterId,
        id: evalId,
        score: result,
      })
    }
    catch {
      // Table may not exist yet — silently fail
    }
  }

  return result
}

/**
 * Get all quality evaluations for a character.
 */
export async function getQualityEvaluations(characterId: string): Promise<QualityScore[]> {
  const pid = getCurrentProjectId()
  try {
    const rows = await db.table('qualityEvaluations')
      .where('[projectId+characterId]')
      .equals([pid, characterId])
      .toArray()
    return rows.map((r: DbQualityEvaluation) => r.score)
  }
  catch {
    return []
  }
}
