import type { EditorIntegration } from '../../capabilities'
import process from 'node:process'
import { resolveEditorCapabilities } from '../../capabilities'

export function assertEditorServerCapability(integration: EditorIntegration) {
  const capabilities = resolveEditorCapabilities(process.env)
  if (!capabilities.integrations[integration]) {
    throw createError({
      statusCode: 404,
      message: `Editor integration is unavailable: ${integration}`,
    })
  }
}
