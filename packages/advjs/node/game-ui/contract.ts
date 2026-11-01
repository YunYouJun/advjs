import type { BundledGameTheme, GameUiContrastPair, GameUiSchemeValue, GameUiThemePreset, GameUiThemeTokenName, GameUiTokenGroup, GameUiTokenKind, GameUiTokenName } from '@advjs/types'
import type { CheckIssue } from '../commands/check'
import type { ProjectGameUiTheme } from './check'
import { bundledGameThemes, bundledThemeTokenContract, gameUiContrastPairs, gameUiThemePresets, gameUiTokenContract, gameUiTokenNames, resolveGameUiTokenDefault } from '@advjs/types'
import { projectPath } from './check'

export const GAME_UI_THEME_CONTRACT_VERSION = 1 as const

export interface GameUiTokenContractEntry {
  name: GameUiTokenName
  kind: GameUiTokenKind
  group: GameUiTokenGroup
  description: string
  consumers: readonly string[]
  /** Effective default per bundled theme and colour scheme. */
  defaults: Record<BundledGameTheme, GameUiSchemeValue>
}

/** A `--adv-theme-*` token that one bundled theme's components read. */
export interface GameUiThemeTokenContractEntry extends Omit<GameUiTokenContractEntry, 'name' | 'defaults'> {
  name: GameUiThemeTokenName
  default: GameUiSchemeValue
}

/** What an agent needs to author `ThemeConfig.ui` without reading the client source. */
export interface GameUiThemeContract {
  schemaVersion: typeof GAME_UI_THEME_CONTRACT_VERSION
  configFile: 'theme.config.ts'
  customTokenPattern: '--adv-theme-*'
  tokens: GameUiTokenContractEntry[]
  themeTokens: Partial<Record<BundledGameTheme, GameUiThemeTokenContractEntry[]>>
  contrastPairs: readonly GameUiContrastPair[]
  presets: readonly GameUiThemePreset[]
  layers: { id: 'L1' | 'L2' | 'L3', title: string, use: string }[]
  rules: string[]
}

export interface GameUiThemeProjectState {
  theme: string
  colorScheme?: 'light' | 'dark'
  tokens: Record<string, string>
  files: string[]
  diagnostics: Pick<CheckIssue, 'type' | 'code' | 'message' | 'file' | 'line' | 'column' | 'suggestion'>[]
}

export function createGameUiThemeContract(): GameUiThemeContract {
  return {
    schemaVersion: GAME_UI_THEME_CONTRACT_VERSION,
    configFile: 'theme.config.ts',
    customTokenPattern: '--adv-theme-*',
    tokens: gameUiTokenNames.map((name) => {
      const spec = gameUiTokenContract[name]
      return {
        name,
        kind: spec.kind,
        group: spec.group,
        description: spec.description,
        consumers: spec.consumers,
        defaults: Object.fromEntries(bundledGameThemes.map(theme => [theme, {
          light: resolveGameUiTokenDefault(name, 'light', theme)!,
          dark: resolveGameUiTokenDefault(name, 'dark', theme)!,
        }])) as Record<BundledGameTheme, GameUiSchemeValue>,
      }
    }),
    themeTokens: Object.fromEntries(Object.entries(bundledThemeTokenContract).map(([theme, tokens]) => [
      theme,
      Object.entries(tokens).map(([name, spec]) => ({
        name: name as GameUiThemeTokenName,
        kind: spec.kind,
        group: spec.group,
        description: spec.description,
        consumers: spec.consumers,
        default: typeof spec.default === 'string' ? { light: spec.default, dark: spec.default } : spec.default,
      })),
    ])),
    contrastPairs: gameUiContrastPairs,
    presets: gameUiThemePresets,
    layers: [
      { id: 'L1', title: 'Tokens', use: 'Colour, type, radius, shadow and motion changes: ui.tokens in theme.config.ts, plus --adv-theme-* tokens read by your own styles.' },
      { id: 'L2', title: 'Project component overrides', use: 'Structural changes for one game: pages/start.vue, components/start/StartMenu.vue, components/AdvEnd.vue or styles/ in the project, scoped to [data-adv-ui="game"].' },
      { id: 'L3', title: 'Theme package', use: 'A reusable look shared by several games: a package scaffolded from themes/theme-starter that extends ThemeConfig.' },
    ],
    rules: [
      'Values are CSS strings; lengths, shadows and durations need units (only 0 may omit a length unit).',
      'Unknown token names are ignored at runtime; custom tokens must start with --adv-theme- and need a consumer.',
      'Declared contrast pairs must reach WCAG 2.2 AA: 4.5:1 for text, 3:1 for large text and focus outlines.',
      'Translucent surfaces are checked over both dark and light scene art.',
      'Scope custom styles to [data-adv-ui="game"]; never restyle the host body, buttons or html.dark.',
      'Keep --adv-c-focus visible on every surface; never remove outlines.',
      'Respect prefers-reduced-motion; keep motion durations short (≤ 240ms).',
      'Check long text and narrow canvases (390px wide) as well as desktop.',
    ],
  }
}

export function getGameUiThemeProjectState(cwd: string, project: ProjectGameUiTheme): GameUiThemeProjectState {
  return {
    theme: project.theme,
    colorScheme: project.colorScheme,
    tokens: project.tokens,
    files: project.sources.map(source => projectPath(cwd, source.file)),
    diagnostics: project.issues.map(({ type, code, message, file, line, column, suggestion }) => ({ type, code, message, file, line, column, suggestion })),
  }
}

function schemeCell({ light, dark }: GameUiSchemeValue): string {
  const cell = light === dark ? `\`${light}\`` : `light \`${light}\`, dark \`${dark}\``
  return cell.replaceAll('|', '\\|')
}

function defaultCell(entry: GameUiTokenContractEntry, theme: BundledGameTheme): string {
  return schemeCell(entry.defaults[theme])
}

/** Markdown for `adv context --theme`. */
export function formatGameUiThemeContract(contract: GameUiThemeContract, project?: GameUiThemeProjectState): string {
  const lines: string[] = ['# Game UI Theme', '']
  if (project) {
    lines.push('## This project', '')
    lines.push(`- Theme: \`${project.theme}\``)
    lines.push(`- Colour scheme: ${project.colorScheme ? `\`${project.colorScheme}\`` : 'inherits the host'}`)
    lines.push(`- Config: ${project.files.length ? project.files.map(file => `\`${file}\``).join(', ') : `none (create \`${contract.configFile}\`)`}`)
    const declared = Object.entries(project.tokens)
    lines.push(`- Declared tokens: ${declared.length}`)
    for (const [name, value] of declared)
      lines.push(`  - \`${name}\`: \`${value}\``)
    lines.push(`- Theme diagnostics: ${project.diagnostics.length ? '' : 'none'}`)
    for (const issue of project.diagnostics)
      lines.push(`  - ${issue.type} ${issue.code} ${issue.file}:${issue.line ?? 1}: ${issue.message}`)
    lines.push('')
  }

  lines.push('## Layers', '', 'Use the lightest layer that achieves the look.', '')
  for (const layer of contract.layers)
    lines.push(`- **${layer.id} ${layer.title}**: ${layer.use}`)
  lines.push('', '## Rules', '')
  for (const rule of contract.rules)
    lines.push(`- ${rule}`)

  lines.push('', `## Tokens (\`ui.tokens\`; custom: \`${contract.customTokenPattern}\`)`, '')
  lines.push('Defaults are the `default` theme; pominis and starter differ only where noted.', '')
  lines.push('| Token | Kind | Default | Use |', '| --- | --- | --- | --- |')
  for (const entry of contract.tokens) {
    const others = bundledGameThemes
      .filter(theme => theme !== 'default' && defaultCell(entry, theme) !== defaultCell(entry, 'default'))
      .map(theme => `${theme}: ${defaultCell(entry, theme)}`)
    lines.push(`| \`${entry.name}\` | ${entry.kind} | ${[defaultCell(entry, 'default'), ...others].join('; ')} | ${entry.description} |`)
  }

  for (const [theme, tokens] of Object.entries(contract.themeTokens)) {
    lines.push('', `## \`${theme}\` theme tokens (only when adv.config uses this theme)`, '')
    lines.push('| Token | Kind | Default | Use |', '| --- | --- | --- | --- |')
    for (const entry of tokens)
      lines.push(`| \`${entry.name}\` | ${entry.kind} | ${schemeCell(entry.default)} | ${entry.description} |`)
  }

  lines.push('', '## Contrast pairs (checked by `adv check`)', '')
  lines.push('| Pair | Foreground | Background | Minimum |', '| --- | --- | --- | --- |')
  for (const pair of contract.contrastPairs)
    lines.push(`| ${pair.description}${pair.theme ? ` (${pair.theme} theme)` : ''} | \`${pair.foreground}\` | \`${pair.background}\` | ${pair.minRatio}:1 (${pair.kind}) |`)

  lines.push('', '## Presets', '', 'Start from the closest preset, then adapt it to the story; never ship one unchanged.', '')
  for (const preset of contract.presets)
    lines.push(`- \`${preset.id}\` (${preset.colorScheme}; ${preset.moods.join(', ')}): ${preset.description}`)
  lines.push('', 'Apply one with `adv theme init --preset <id>`, then render it with `adv theme screenshot`.')
  return lines.join('\n')
}
