import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const studioRoot = resolve(import.meta.dirname, '../..')

function readStudioFile(path: string): string {
  return readFileSync(resolve(studioRoot, path), 'utf8')
}

describe('studio managed AI production boundary', () => {
  it('keeps all five authoring entries on the managed adapter', () => {
    const entries = [
      'src/components/OutlineGenerateModal.vue',
      'src/components/ChapterDraftModal.vue',
      'src/components/PlotSuggestionModal.vue',
      'src/components/RoleplaySimulationModal.vue',
      'src/components/ConsistencyCheckModal.vue',
    ]
    const forbiddenImports = [
      'useAiSettingsStore',
      'aiClient',
      'outlineGenerator',
      'chapterDraftGenerator',
      'plotSuggestionGenerator',
      'roleplaySimulator',
      'consistencyChecker',
    ]

    for (const entry of entries) {
      const source = readStudioFile(entry)
      expect(source, entry).toContain('useManagedAuthoring')
      for (const forbidden of forbiddenImports)
        expect(source, `${entry} imports ${forbidden}`).not.toContain(forbidden)
    }
  })

  it('does not load unregistered AI pages from production routes', () => {
    const router = readStudioFile('src/router/index.ts')

    for (const page of ['ChatPage.vue', 'CharacterChatPage.vue', 'GroupChatPage.vue', 'ImportSourcePage.vue'])
      expect(router).not.toContain(page)

    expect(router).toContain('path: \'chat\',\n        redirect: \'/tabs/workspace\'')
    expect(router).toContain('path: \'workspace/import-source\',\n        redirect: \'/tabs/workspace\'')
    expect(router).toContain('path: \'world/chat/:characterId\',\n        redirect:')
  })

  it('exposes service state instead of provider credentials in AI settings', () => {
    const settings = readStudioFile('src/views/settings/SettingsAiPage.vue')
    const productionCopy = [
      readStudioFile('src/i18n/locales/en.json'),
      readStudioFile('src/i18n/locales/zh-CN.json'),
    ].join('\n')

    expect(settings).toContain('useManagedAgentStore')
    for (const forbidden of ['useAiSettingsStore', 'apiKey', 'baseURL', 'aiProviderRegistry'])
      expect(settings).not.toContain(forbidden)
    for (const forbidden of ['"aiApiKey"', '"aiImageApiKey"', '"ttsApiKey"', '"embeddingApiKey"', '"aiBaseURL"'])
      expect(productionCopy).not.toContain(forbidden)
  })

  it('keeps source and bundle guards for legacy clients and approved provider domains', () => {
    const config = readStudioFile('vite.config.ts')

    for (const module of [
      '/agent/byok-dev/',
      '/stores/useAiSettingsStore.ts',
      '/utils/aiClient.ts',
      '/utils/aiImageClient.ts',
      '/utils/embeddingClient.ts',
      '/utils/ttsClient.ts',
    ])
      expect(config).toContain(module)

    for (const domain of ['api.deepseek.com', 'api.openai.com', 'api.siliconflow.cn', 'openrouter.ai/api'])
      expect(config).toContain(domain)

    for (const credentialField of ['apiKey', 'aiApiKey', 'aiImageApiKey', 'ttsApiKey', 'embeddingApiKey', 'customBaseURL'])
      expect(config).toContain(credentialField)
  })

  it('runs the one-way credential cleanup before app services start', () => {
    const main = readStudioFile('src/main.ts')
    const cleanup = readStudioFile('src/agent/managed/legacy-credentials.ts')

    expect(main.indexOf('clearLegacyStudioAiCredentials()')).toBeLessThan(main.indexOf('const pinia = createPinia()'))
    expect(cleanup).toContain('storage.removeItem(key)')
    expect(cleanup).not.toContain('getItem')
  })
})
