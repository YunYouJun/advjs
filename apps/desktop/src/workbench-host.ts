// Compatibility names for the desktop shell; protocol and validation live in the SDK.
export { createEditorProjectHostClient as createWorkbenchHost } from '@advjs/editor-sdk/node'
export type {
  EditorRepositoryBinding as WorkbenchBinding,
  EditorProjectHostClient as WorkbenchHost,
  EditorProjectHostInfo as WorkbenchInfo,
  EditorRepository as WorkbenchRepository,
} from '@advjs/editor-sdk/node'
