import type { AdvAssetManifest } from './config/assets'
import type { AdvCharacter } from './game/character'
import type { JsonObject, JsonValue } from './runtime/json'
import type { RuntimeProgram } from './runtime/program'

export type AdvProjectFileMap = Record<string, string>

export interface AdvProjectSource {
  files: AdvProjectFileMap
  id?: string
}

export interface AdvProjectCompileOptions {
  /** Runtime plugin names and exact versions available to the compiler. */
  plugins?: Record<string, string>
  /** Compatibility wrappers may disable project-level character/scene checks. */
  validateContentReferences?: boolean
}

export interface AdvProjectDiagnostic {
  code: string
  severity: 'error' | 'warning'
  message: string
  path?: string
  line?: number
  column?: number
  details?: JsonObject
}

export interface AdvProjectChapter {
  id: string
  title?: string
  sources: string[]
}

export interface AdvProjectScene {
  id: string
  name?: string
  alias?: string
  description?: string
  imagePrompt?: string
  type?: 'image' | 'model'
  src?: string
  assetId?: string
  tags?: string[]
}

export interface AdvProjectPluginRequirement {
  name: string
  version: string
}

export interface AdvProjectExtensions {
  /** Unknown adv.config.json fields, recursively stripped of non-deterministic metadata. */
  config: JsonObject
  /** Unknown game config fields, recursively stripped of non-deterministic metadata. */
  game: JsonObject
}

export interface NormalizedAdvProject {
  schemaVersion: 1
  id: string
  format: 'adv-md' | 'flow'
  root: string
  theme?: string
  entryChapterId?: string
  game: JsonObject
  chapters: AdvProjectChapter[]
  characters: AdvCharacter[]
  scenes: AdvProjectScene[]
  plugins: AdvProjectPluginRequirement[]
  assets?: AdvAssetManifest
  program?: RuntimeProgram
  extensions: AdvProjectExtensions
}

export interface AdvProjectSourceMap {
  config?: string
  gameConfig?: string
  assets?: string
  chapters: Record<string, string[]>
  characters: Record<string, string>
  scenes: Record<string, string>
}

export interface AdvProjectCompileResult {
  project: NormalizedAdvProject
  diagnostics: AdvProjectDiagnostic[]
  sourceMap: AdvProjectSourceMap
}

export type AdvProjectJsonValue = JsonValue
