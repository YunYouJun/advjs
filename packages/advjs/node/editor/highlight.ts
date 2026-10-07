import type { ShikiServiceApi } from '@devframes/service-shiki'
import { tmpdir } from 'node:os'
import process from 'node:process'
import { join } from 'pathe'
import { canHighlightJson, createJsonHighlightPalette, flattenJsonHighlightTokens } from '../../../shared/json-highlight'

let service: Promise<{ api: ShikiServiceApi, palette: Map<string, string> }> | undefined

async function createHighlightService() {
  const [{ createHostContext }, { createShikiService }, { default: theme }] = await Promise.all([
    import('devframe/node'),
    import('@devframes/service-shiki'),
    import('shiki/themes/vitesse-light.mjs'),
  ])
  // service-shiki accepts bundled theme names. Translate its palette into AGUI
  // semantics using the theme's scopes, keeping library colors out of the UI.
  const palette = createJsonHighlightPalette(theme)
  const context = await createHostContext({
    cwd: process.cwd(),
    mode: 'dev',
    host: {
      resolveOrigin: () => 'http://localhost',
      getStorageDir: scope => join(tmpdir(), 'advjs-devframe', scope),
      mountStatic: () => { throw new Error('The Editor highlighting host does not serve Devframe views') },
    },
  })
  const installation = context.services.install(createShikiService({
    langs: ['json'],
    themes: { light: 'vitesse-light', dark: 'vitesse-dark' },
  }))
  await context.services.ready()
  const api = await installation
  if (!api)
    throw new Error('Devframe Shiki service is unavailable')
  return { api, palette }
}

/** Use Devframe's shared singleton and LRU through the existing authenticated bridge. */
export async function highlightEditorJson(code: string) {
  if (!canHighlightJson(code))
    return undefined
  service ??= createHighlightService().catch((error) => {
    service = undefined
    throw error
  })
  const { api, palette } = await service
  const result = await api.codeToTokens({ code, lang: 'json' })
  return flattenJsonHighlightTokens(code, result.tokens, color => palette.get(color?.toLowerCase() ?? '') ?? 'var(--agui-c-syntax-punctuation)')
}
