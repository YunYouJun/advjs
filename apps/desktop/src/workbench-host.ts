import type { createEditorProjectHostClient } from '@advjs/editor-sdk/node'
import { createRequire } from 'node:module'

// The packaged shell starts without the optional development workbench SDK.
export const createWorkbenchHost: typeof createEditorProjectHostClient = (...args) => {
  const sdk = createRequire(import.meta.url)('@advjs/editor-sdk/node') as typeof import('@advjs/editor-sdk/node')
  return sdk.createEditorProjectHostClient(...args)
}
export type {
  EditorRepositoryBinding as WorkbenchBinding,
  EditorProjectHostClient as WorkbenchHost,
  EditorProjectHostInfo as WorkbenchInfo,
  EditorRepository as WorkbenchRepository,
} from '@advjs/editor-sdk/node'
