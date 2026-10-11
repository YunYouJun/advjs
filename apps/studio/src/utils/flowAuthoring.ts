import type { IFileSystem } from './fs'
import { createFlowAuthoringService } from '@advjs/core'
import { commitStudioProjectFiles } from './nativeProjectMutation'

/** Native JSON source protocol; never serialize a Flow chapter as Markdown. */
export function createStudioFlowAuthoringService(fs: IFileSystem, assertCurrent?: () => void) {
  return createFlowAuthoringService({
    readFiles: async () => Object.fromEntries((await fs.collectAllFiles()).map(file => [file.path, file.content])),
    writeFiles: changes => commitStudioProjectFiles(fs, changes, {
      assertCurrent,
      acceptsPath: path => !path.startsWith('/') && !path.includes('\\') && !path.split('/').some(part => ['.', '..', '.git', 'node_modules'].includes(part)),
    }),
  })
}
