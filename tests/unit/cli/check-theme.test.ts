// @vitest-environment node

import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { runCheck } from '../../../packages/advjs/node/commands/check'
import { checkGameUiTheme } from '../../../packages/advjs/node/game-ui/check'
import { contrastRatio, parseCssColor, parsePaintColors, resolveCssVars } from '../../../packages/advjs/node/game-ui/color'

const fixtures = resolve(import.meta.dirname, '../../fixtures/diagnostics')
const roots: string[] = []

function project(themeConfig?: { file: string, content: string }) {
  const cwd = mkdtempSync(join(tmpdir(), 'advjs-theme-check-'))
  roots.push(cwd)
  cpSync(join(fixtures, 'valid'), cwd, { recursive: true })
  if (themeConfig)
    writeFileSync(join(cwd, themeConfig.file), themeConfig.content)
  return cwd
}

function json(tokens: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  return { file: 'theme.config.json', content: `${JSON.stringify({ ui: { ...extra, tokens } }, null, 2)}\n` }
}

async function themeIssues(cwd: string) {
  return (await runCheck({ cwd })).issues.filter(issue => issue.category === 'theme')
}

function check(tokens: Record<string, unknown>, colorScheme?: string) {
  return checkGameUiTheme({ cwd: '/game', theme: 'default', sources: [{ file: '/game/theme.config.ts', ui: { colorScheme, tokens } }] })
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('game UI colour math', () => {
  it('parses the colour syntaxes used by the token defaults', () => {
    expect(parseCssColor('#0078e7')).toEqual({ r: 0, g: 120, b: 231, a: 1 })
    expect(parseCssColor('rgb(0 0 0 / 80%)')).toEqual({ r: 0, g: 0, b: 0, a: 0.8 })
    expect(parseCssColor('rgba(60, 60, 67)')).toEqual({ r: 60, g: 60, b: 67, a: 1 })
    expect(parseCssColor('hsl(0 0% 100%)')).toMatchObject({ r: 255, g: 255, b: 255 })
    expect(parseCssColor('color-mix(in srgb, #fff 50%, #000)')).toMatchObject({ r: 127.5, a: 1 })
    expect(parseCssColor('oklch(0.7 0.1 200)')).toBeUndefined()
    expect(resolveCssVars('rgba(0, 0, 0, var(--o))', name => name === '--o' ? '0.9' : undefined)).toBe('rgba(0, 0, 0, 0.9)')
    expect(resolveCssVars('var(--missing, var(--x, #fff))', () => undefined)).toBe('#fff')
    expect(parsePaintColors('linear-gradient(to bottom, transparent 0%, rgba(0, 0, 0, 0.75) 35%, black) no-repeat bottom')).toHaveLength(3)
    expect(parsePaintColors('url(paper.webp), #fff')).toBeUndefined()
    expect(contrastRatio(parseCssColor('#000')!, parseCssColor('#fff')!)).toBeCloseTo(21)
  })
})

describe('adv check theme diagnostics', () => {
  it('adds nothing for projects without theme settings', async () => {
    expect(await themeIssues(project())).toEqual([])
  })

  it('reports unknown token names with the closest contract token and source location', async () => {
    const cwd = project(json({ '--adv-dialog-bgg': '#000', '--adv-theme-paper': 'none', '--adv-foo': 'red' }))
    const issues = await themeIssues(cwd)
    expect(issues.map(issue => issue.code)).toEqual(['ADV_THEME_UNKNOWN_TOKEN', 'ADV_THEME_UNKNOWN_TOKEN'])
    expect(issues[0]).toMatchObject({
      type: 'error',
      file: 'theme.config.json',
      line: 4,
      certainty: 'certain',
      message: expect.stringContaining('--adv-dialog-bgg'),
      suggestion: expect.stringContaining('"--adv-dialog-bg"'),
    })
    expect(issues[1].suggestion).toContain('--adv-theme-')
    expect((await runCheck({ cwd })).passed).toBe(false)
  })

  it('reports lengths, shadows and durations without units, but accepts unitless zero', () => {
    const issues = check({
      '--adv-choice-radius': '6',
      '--adv-control-radius': '0',
      '--adv-save-card-shadow': '0 2 8 rgba(0, 0, 0, 0.2)',
      '--adv-modal-motion-duration': '200',
      '--adv-end-font-weight': '600',
      '--adv-modal-opacity': '0.8',
    })
    expect(issues.map(issue => [issue.code, issue.message.match(/"(--adv-[\w-]+)"/u)?.[1]])).toEqual([
      ['ADV_THEME_MISSING_UNIT', '--adv-choice-radius'],
      ['ADV_THEME_MISSING_UNIT', '--adv-save-card-shadow'],
      ['ADV_THEME_MISSING_UNIT', '--adv-modal-motion-duration'],
    ])
    expect(issues[0].suggestion).toContain('"6px"')
    expect(issues[2].suggestion).toContain('"200ms"')
  })

  it('reports invalid values and colour schemes the runtime would ignore', () => {
    const issues = check({ '--adv-end-color': 3, '--adv-c-primary': '12px', '--adv-dialog-bg': 'red !important' }, 'night')
    expect(issues.map(issue => issue.code)).toEqual([
      'ADV_THEME_INVALID_COLOR_SCHEME',
      'ADV_THEME_INVALID_TOKEN_VALUE',
      'ADV_THEME_INVALID_COLOR',
      'ADV_THEME_INVALID_TOKEN_VALUE',
    ])
  })

  it('fails opaque contrast pairs below WCAG AA with both colours in the message', () => {
    const issues = check({ '--adv-dialog-bg': '#333333', '--adv-dialog-color': '#555555', '--adv-dialog-name-color': '#ffd479' })
      .filter(issue => issue.message.startsWith('Dialogue'))
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({
      type: 'error',
      code: 'ADV_THEME_LOW_CONTRAST',
      certainty: 'certain',
      message: expect.stringMatching(/Dialogue text .*1\.\d\d:1 is below 4\.5:1 \(--adv-dialog-color #555555 on --adv-dialog-bg #333333\)/u),
    })
  })

  it('checks focus rings at 3:1, including when they follow a changed primary colour', () => {
    const issues = check({ '--adv-c-primary': '#151515', '--adv-c-bg': '#111111', '--adv-c-text': '#eeeeee' }, 'dark')
    expect(issues.filter(issue => issue.code === 'ADV_THEME_LOW_CONTRAST').map(issue => issue.message.split(':')[0])).toContain('Focus outline against the game surface')
  })

  it('treats translucent surfaces that fail over only one kind of scene as uncertain warnings', () => {
    const issues = check({ '--adv-choice-bg': 'rgba(0, 0, 0, 0.35)', '--adv-choice-hover-bg': '#203040', '--adv-choice-color': '#ffffff' })
      .filter(issue => issue.message.startsWith('Choice text'))
    expect(issues).toEqual([expect.objectContaining({
      type: 'warning',
      code: 'ADV_THEME_LOW_CONTRAST',
      certainty: 'uncertain',
      message: expect.stringContaining('over a light scene'),
    })])
  })

  it('asks for an explicit foreground when the choice colour is only inherited', () => {
    const issues = check({ '--adv-choice-bg': '#f4f1ea', '--adv-choice-hover-bg': '#e8e0d0' }, 'dark')
    expect(issues[0]).toMatchObject({ type: 'warning', code: 'ADV_THEME_LOW_CONTRAST', suggestion: expect.stringContaining('Declare --adv-choice-color') })
  })

  it('evaluates both colour schemes when the theme inherits the host scheme', () => {
    const issues = check({ '--adv-c-bg': '#111111' })
    expect(issues.find(issue => issue.message.startsWith('Game text on the container'))).toMatchObject({
      type: 'error',
      message: expect.stringContaining('light scheme'),
      suggestion: expect.stringContaining('ui.colorScheme'),
    })
  })

  it('checks the default theme\'s start menu tokens only for that theme', () => {
    const tokens = { '--adv-theme-start-menu-bg': '#202020', '--adv-theme-start-menu-color': '#5a5a5a', '--adv-theme-start-menu-size': '18' }
    expect(check(tokens, 'dark').map(issue => issue.code)).toEqual(['ADV_THEME_MISSING_UNIT', 'ADV_THEME_LOW_CONTRAST'])
    expect(checkGameUiTheme({ cwd: '/game', theme: 'starter', sources: [{ file: '/game/theme.config.ts', ui: { colorScheme: 'dark', tokens } }] })).toEqual([])
  })

  it('warns when a declared pair cannot be computed', () => {
    const issues = check({ '--adv-dialog-bg': 'url(/paper.webp)', '--adv-dialog-color': '#222' })
    expect(issues.map(issue => [issue.code, issue.type])).toContainEqual(['ADV_THEME_CONTRAST_UNVERIFIED', 'warning'])
  })

  it('loads theme.config.ts, merges adv.config themeConfig underneath and emits JSON-ready diagnostics', async () => {
    const cwd = project({
      file: 'theme.config.ts',
      content: `import { defineThemeConfig } from 'advjs'\n\nexport default defineThemeConfig({\n  ui: {\n    colorScheme: 'dark',\n    tokens: {\n      '--adv-choice-color': '#3a3a3a',\n    },\n  },\n})\n`,
    })
    writeFileSync(join(cwd, 'adv.config.json'), JSON.stringify({ format: 'adv-md', root: './adv', themeConfig: { ui: { tokens: { '--adv-choice-bg': '#2b2b2b', '--adv-choice-radiuss': '4px' } } } }, null, 2))
    const issues = await themeIssues(cwd)
    expect(issues.map(issue => [issue.code, issue.file, issue.message.split(':')[0]])).toEqual([
      ['ADV_THEME_UNKNOWN_TOKEN', 'adv.config.json', 'Unknown game UI token "--adv-choice-radiuss"; the runtime ignores it.'],
      ['ADV_THEME_LOW_CONTRAST', 'theme.config.ts', 'Choice text on the choice button'],
      ['ADV_THEME_LOW_CONTRAST', 'theme.config.ts', 'Choice text on the hovered choice button'],
    ])
    expect(issues[1]).toMatchObject({ type: 'error', line: 7, column: 7 })
    for (const issue of issues)
      expect(Object.keys(issue)).toEqual(expect.arrayContaining(['code', 'message', 'file', 'line', 'column', 'suggestion', 'certainty']))
  })

  it('reports a theme.config that cannot be loaded', async () => {
    const issues = await themeIssues(project({ file: 'theme.config.ts', content: 'export default {\n' }))
    expect(issues.map(issue => issue.code)).toEqual(['ADV_THEME_CONFIG_LOAD_FAILED'])
  })
})
