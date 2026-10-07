import { describe, expect, it } from 'vitest'
import { resolveThemeSources, themeAiContext, themeOverrideChanges } from '../../editor/core/app/utils/theme-authoring'

describe('theme authoring sources', () => {
  it('materializes page dependencies without replacing project overrides', () => {
    const menu = '<template>My existing menu</template>'
    const sources = resolveThemeSources({ 'components/StartMenu.vue': menu })
    expect(sources.sources.find(source => source.id === 'menu')).toMatchObject({ path: 'components/StartMenu.vue', content: menu, exists: true })
    expect(themeOverrideChanges(sources, 'start')).toEqual([expect.objectContaining({ path: 'pages/start.vue', expected: null })])
    expect(themeOverrideChanges(sources, 'menu')).toEqual([])
  })

  it('copies the current official theme and leaves unknown themes untouched', () => {
    const pominis = resolveThemeSources({}, '@advjs/theme-pominis')
    expect(pominis.sources.find(source => source.id === 'start')?.content).toContain('PominisStartMenu')
    expect(themeOverrideChanges(pominis, 'start').map(change => change.path)).toEqual(['pages/start.vue', 'components/start/PominisStartMenu.vue'])
    const custom = resolveThemeSources({}, './my-theme')
    expect(custom.sources.find(source => source.id === 'start')?.content).toBeUndefined()
    expect(themeOverrideChanges(custom, 'start')).toEqual([])
    expect(themeOverrideChanges(custom, 'config')).toEqual([expect.objectContaining({ path: 'theme.config.json', expected: null })])
  })

  it('uses existing configuration and limits AI context to theme sources', () => {
    const sources = resolveThemeSources({
      'pages/start.vue': '<template>Custom homepage</template>',
      'theme.config.ts': 'export default { ui: {} }',
      'adv/chapters/secret.adv.md': 'Private unreleased story',
      '.env': 'TOKEN=secret',
    })
    expect(sources.sources.find(source => source.id === 'config')?.path).toBe('theme.config.ts')
    const context = themeAiContext(sources, '加大标题与菜单间距', true)
    expect(context).toContain('加大标题与菜单间距')
    expect(context).toContain('Custom homepage')
    expect(context).toContain('保留开始游戏')
    expect(context).not.toContain('Private unreleased story')
    expect(context).not.toContain('TOKEN=secret')
  })
})
