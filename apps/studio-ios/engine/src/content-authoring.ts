import type { ProjectContentKind } from '@advjs/core/project'
import type { Input } from './input'
import {
  createProjectEntry,
  exportCharactersToCSV,
  exportRelationshipsToCSV,
  listProjectEntries,
  planProjectContentImport,
  prepareCharacterVoiceBinding,
  PROJECT_CONTENT_LOCATIONS,
  readProjectEntry,
  updateProjectEntry,
} from '@advjs/core/project'
import { exportCharacterForAI, parseCharacterMd } from '@advjs/parser'
import { optionalStringArray, requireFileMap, requireObject, requireString } from './input'
import { EngineFailure } from './protocol'

function kind(input: Input): ProjectContentKind {
  const value = requireString(input, 'kind')
  if (!Object.hasOwn(PROJECT_CONTENT_LOCATIONS, value))
    throw new EngineFailure('ENGINE_INVALID_INPUT', 'Unsupported content kind', 'kind')
  return value as ProjectContentKind
}

const authoring: Record<string, (input: Input) => unknown> = {
  'authoring.list': (input) => {
    const files = requireFileMap(input)
    return listProjectEntries(files, optionalStringArray(input, 'paths') ?? Object.keys(files), kind(input))
  },
  'authoring.read': input => readProjectEntry(kind(input), requireString(input, 'path'), requireString(input, 'source')),
  'authoring.create': input => createProjectEntry(kind(input), requireObject(input, 'data')),
  'authoring.update': input => updateProjectEntry(kind(input), requireString(input, 'path'), requireString(input, 'source'), requireObject(input, 'data')),
  'authoring.import': (input) => {
    const type = kind(input)
    const format = requireString(input, 'format')
    const strategy = requireString(input, 'strategy')
    if ((type !== 'character' && type !== 'scene') || (format !== 'csv' && format !== 'json') || (strategy !== 'skip' && strategy !== 'overwrite' && strategy !== 'rename'))
      throw new EngineFailure('ENGINE_INVALID_INPUT', 'Unsupported import option')
    const files = requireFileMap(input)
    return planProjectContentImport(type, format, requireString(input, 'source'), strategy, files, optionalStringArray(input, 'paths') ?? Object.keys(files))
  },
  'authoring.characterCSV': (input) => {
    const files = requireFileMap(input)
    const characters = listProjectEntries(files, Object.keys(files), 'character')
      .filter(entry => entry.data)
      .map(entry => parseCharacterMd(files[entry.path]))
    return {
      characters: exportCharactersToCSV(characters),
      relationships: exportRelationshipsToCSV(characters),
    }
  },
  'authoring.voiceBinding': input => prepareCharacterVoiceBinding(requireString(input, 'locale'), requireString(input, 'provider'), requireObject(input, 'data')),
  'authoring.characterSummary': input => exportCharacterForAI(parseCharacterMd(requireString(input, 'source'))),
}

export const contentAuthoringOperations = Object.fromEntries(Object.entries(authoring).map(([operation, run]) => [
  operation,
  (input: Input) => {
    try {
      return run(input)
    }
    catch (error) {
      if (error instanceof EngineFailure)
        throw error
      throw new EngineFailure('ENGINE_AUTHORING_INVALID', error instanceof Error ? error.message : String(error))
    }
  },
]))
