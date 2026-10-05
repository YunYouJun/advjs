import type { PluginRegistration } from './registry'
import diagnosticsPlugin from '@advjs/editor-plugin-diagnostics'
import { contextPlugin } from './builtin/context'
import { corePlugin } from './builtin/core'

/** Only code explicitly bundled by the editor build is executed. */
export const editorPluginCatalog: readonly PluginRegistration[] = [
  { plugin: corePlugin, source: 'builtin', required: true },
  { plugin: contextPlugin, source: 'builtin' },
  { plugin: diagnosticsPlugin, source: 'bundled' },
]
