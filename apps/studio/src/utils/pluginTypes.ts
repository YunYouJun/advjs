/**
 * StudioPlugin — unified plugin type system for ADV.JS Studio.
 *
 * All extensible subsystems (AI Provider, TTS Provider, Export Format)
 * share this base interface for metadata and lifecycle.
 */

export type StudioPluginType = 'ai-provider' | 'tts-provider' | 'export-format'

export interface StudioPlugin {
  /** Unique plugin identifier (e.g. 'deepseek', 'openai-tts') */
  id: string
  /** Human-readable display name */
  name: string
  /** Plugin category */
  type: StudioPluginType
  /** Semantic version (optional, defaults to '1.0.0') */
  version?: string
  /** Short description of this plugin */
  description?: string
}
