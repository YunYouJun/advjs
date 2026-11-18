import type { Input } from './input'
import { AUTHORING_GAME_SETTINGS_PATH, projectImagePath, readProjectCover, writeProjectCover } from '@advjs/core/project'
import { optionalString, requireString } from './input'
import { EngineFailure } from './protocol'

export const projectImageOperations: Record<string, (input: Input) => unknown> = {
  'project.imagePath': (input) => {
    const kind = requireString(input, 'kind')
    if (kind !== 'character' && kind !== 'scene' && kind !== 'cover')
      throw new EngineFailure('ENGINE_INVALID_INPUT', 'Invalid image kind', 'kind')
    return projectImagePath(kind, requireString(input, 'id'), requireString(input, 'name'), requireString(input, 'digest'), requireString(input, 'extension'))
  },
  'project.readCover': input => ({ path: readProjectCover(optionalString(input, 'source')) }),
  'project.setCover': input => ({
    path: AUTHORING_GAME_SETTINGS_PATH,
    text: writeProjectCover(optionalString(input, 'source'), optionalString(input, 'path')),
  }),
}
