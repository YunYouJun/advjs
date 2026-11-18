import type { GameUiContrastPair, GameUiTokenSpec } from '@advjs/types'
import type { CheckIssue } from '../commands/check'
import type { LoadedProject } from '../project'
import type { Rgba } from './color'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { gameUiContrastPairs, gameUiTokenNames, getGameUiTokenSpec, resolveGameUiTokenDefault } from '@advjs/types'
import { relative, resolve } from 'pathe'
import { resolveThemeConfigFromRoot } from '../config/theme'
import { composite, contrastRatio, formatColor, parseCssColor, parsePaintColors, resolveCssVars, splitTopLevel } from './color'

/** One place a project declares `ui` theme settings, lowest precedence first. */
export interface GameUiThemeSource {
  /** Absolute path, used for diagnostics and source locations. */
  file: string
  ui: unknown
}

export interface GameUiThemeCheckInput {
  cwd: string
  /** `adv.config` theme name, used to pick bundled defaults. */
  theme?: string
  sources: GameUiThemeSource[]
}

export interface ProjectGameUiTheme {
  theme: string
  colorScheme?: 'light' | 'dark'
  /** Merged string tokens as the runtime applies them, including unknown names. */
  tokens: Record<string, string>
  sources: GameUiThemeSource[]
  issues: CheckIssue[]
}

const knownTokens = new Set<string>(gameUiTokenNames)
const customToken = /^--adv-theme-[\w-]+$/u
const backdrops: { name: 'dark' | 'light', color: Rgba }[] = [
  { name: 'dark', color: { r: 0, g: 0, b: 0, a: 1 } },
  { name: 'light', color: { r: 255, g: 255, b: 255, a: 1 } },
]

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function realPath(path: string): string {
  try {
    return realpathSync(path)
  }
  catch {
    return path
  }
}

/** Project-relative path; config loaders may return the real path of a symlinked root. */
export function projectPath(cwd: string, file: string): string {
  const path = relative(realPath(cwd), realPath(file))
  return path && !path.startsWith('..') ? path : relative(cwd, file) || file
}

function readSource(file: string): string {
  try {
    return readFileSync(file, 'utf8')
  }
  catch {
    return ''
  }
}

/** Load `adv.config` `themeConfig` and `theme.config.*`, which the runtime merges in that order. */
export async function loadGameUiThemeSources(cwd: string, advConfig?: { file: string, data: unknown }): Promise<{ theme?: string, sources: GameUiThemeSource[], issues: CheckIssue[] }> {
  const sources: GameUiThemeSource[] = []
  const issues: CheckIssue[] = []
  const config = isRecord(advConfig?.data) ? advConfig.data : {}
  if (advConfig && isRecord(config.themeConfig) && config.themeConfig.ui !== undefined)
    sources.push({ file: advConfig.file, ui: config.themeConfig.ui })
  try {
    const { config: themeConfig, configFile } = await resolveThemeConfigFromRoot(cwd)
    if (configFile && existsSync(configFile) && isRecord(themeConfig) && themeConfig.ui !== undefined)
      sources.push({ file: configFile, ui: themeConfig.ui })
  }
  catch (error) {
    issues.push({
      type: 'error',
      category: 'theme',
      code: 'ADV_THEME_CONFIG_LOAD_FAILED',
      file: 'theme.config',
      message: `theme.config could not be loaded: ${error instanceof Error ? error.message : String(error)}`,
      certainty: 'certain',
      suggestion: 'Fix the syntax error and keep the default export a defineThemeConfig({ ... }) object.',
    })
  }
  return { theme: typeof config.theme === 'string' ? config.theme : undefined, sources, issues }
}

function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const current = row[j]
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1))
      previous = current
    }
  }
  return row[b.length]
}

function nearestToken(name: string): string | undefined {
  let best: { name: string, distance: number } | undefined
  for (const candidate of gameUiTokenNames) {
    const distance = levenshtein(name, candidate)
    if (!best || distance < best.distance)
      best = { name: candidate, distance }
  }
  return best && best.distance <= Math.max(3, Math.floor(name.length / 5)) ? best.name : undefined
}

function locate(file: string, needle: string): { line: number, column: number } {
  const content = readSource(file)
  const index = [`'${needle}'`, `"${needle}"`, needle].map(candidate => content.indexOf(candidate)).find(found => found >= 0)
  if (index === undefined)
    return { line: 1, column: 1 }
  const before = content.slice(0, index)
  return { line: before.split('\n').length, column: index - before.lastIndexOf('\n') }
}

const bareNumber = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/u

/** Bare numbers where CSS requires a unit, ignoring numbers inside functions such as colours. */
function unitlessParts(spec: GameUiTokenSpec, value: string): string[] {
  if (!['length', 'shadow', 'duration'].includes(spec.kind))
    return []
  return splitTopLevel(value, ' ')
    .flatMap(part => splitTopLevel(part, ','))
    .filter(part => bareNumber.test(part) && (spec.kind === 'duration' || Number.parseFloat(part) !== 0))
}

function invalidColor(spec: GameUiTokenSpec, value: string): boolean {
  if (spec.kind !== 'color')
    return false
  const trimmed = value.trim()
  if (trimmed.startsWith('#'))
    return !parseCssColor(trimmed)
  return /^[+-]?[\d.]/u.test(trimmed)
}

/** Validates one source; adds tokens with unusable values to `invalid`. */
function validateSource(source: GameUiThemeSource, cwd: string, theme: string | undefined, invalid: Set<string>): CheckIssue[] {
  const issues: CheckIssue[] = []
  const file = projectPath(cwd, source.file)
  const issue = (code: string, message: string, suggestion: string, needle?: string): CheckIssue => ({
    type: 'error',
    category: 'theme',
    code,
    file,
    message,
    suggestion,
    certainty: 'certain',
    ...(needle ? locate(source.file, needle) : { line: 1, column: 1 }),
  })
  if (!isRecord(source.ui)) {
    issues.push(issue('ADV_THEME_INVALID_CONFIG', 'ThemeConfig.ui must be an object.', 'Use ui: { colorScheme, tokens } in defineThemeConfig().'))
    return issues
  }
  const { colorScheme, tokens } = source.ui
  if (colorScheme !== undefined && colorScheme !== 'light' && colorScheme !== 'dark')
    issues.push(issue('ADV_THEME_INVALID_COLOR_SCHEME', `ui.colorScheme must be "light" or "dark", not ${JSON.stringify(colorScheme)}.`, 'Set colorScheme to "light" or "dark", or remove it to inherit the host scheme.', 'colorScheme'))
  if (tokens === undefined)
    return issues
  if (!isRecord(tokens)) {
    issues.push(issue('ADV_THEME_INVALID_CONFIG', 'ui.tokens must be an object of CSS custom properties.', 'Map token names such as "--adv-dialog-bg" to CSS strings.', 'tokens'))
    return issues
  }
  for (const [name, value] of Object.entries(tokens)) {
    if (!knownTokens.has(name) && !customToken.test(name)) {
      const nearest = nearestToken(name)
      issues.push(issue(
        'ADV_THEME_UNKNOWN_TOKEN',
        `Unknown game UI token "${name}"; the runtime ignores it.`,
        nearest
          ? `Did you mean "${nearest}"? Custom tokens must start with --adv-theme- and be read by your own components.`
          : 'Use a token from the contract (adv context --theme), or prefix custom tokens with --adv-theme- and read them in your components.',
        name,
      ))
      continue
    }
    if (typeof value !== 'string' || !value.trim()) {
      invalid.add(name)
      issues.push(issue('ADV_THEME_INVALID_TOKEN_VALUE', `Token "${name}" must be a non-empty CSS string; the runtime ignores ${JSON.stringify(value)}.`, 'Quote the value as a CSS string, for example "12px" or "#1a1a1a".', name))
      continue
    }
    if (/[;{}]|!important/iu.test(value)) {
      invalid.add(name)
      issues.push(issue('ADV_THEME_INVALID_TOKEN_VALUE', `Token "${name}" value "${value}" contains ";", braces or !important.`, 'Write a single CSS value; theme config already takes precedence over theme CSS.', name))
      continue
    }
    const spec = getGameUiTokenSpec(name, theme)
    if (!spec)
      continue
    const unitless = unitlessParts(spec, value)
    if (unitless.length) {
      invalid.add(name)
      const unit = spec.kind === 'duration' ? 'ms' : 'px'
      issues.push(issue('ADV_THEME_MISSING_UNIT', `Token "${name}" (${spec.kind}) value "${value}" has ${unitless.map(part => `"${part}"`).join(', ')} without a unit; the declaration is invalid CSS.`, `Add a unit, for example "${unitless[0]}${unit}"${spec.kind === 'duration' ? '' : '; only 0 may omit it'}.`, name))
    }
    else if (invalidColor(spec, value)) {
      invalid.add(name)
      issues.push(issue('ADV_THEME_INVALID_COLOR', `Token "${name}" expects a colour, but "${value}" is not one.`, 'Use a hex, rgb(), hsl(), named colour or var() reference.', name))
    }
  }
  return issues
}

/** Merge sources the way the runtime does: later sources override earlier ones. */
export function mergeGameUiThemeSources(sources: GameUiThemeSource[]): { colorScheme?: 'light' | 'dark', tokens: Record<string, string> } {
  const tokens: Record<string, string> = {}
  let colorScheme: 'light' | 'dark' | undefined
  for (const source of sources) {
    if (!isRecord(source.ui))
      continue
    if (source.ui.colorScheme === 'light' || source.ui.colorScheme === 'dark')
      colorScheme = source.ui.colorScheme
    if (isRecord(source.ui.tokens)) {
      for (const [name, value] of Object.entries(source.ui.tokens)) {
        if (typeof value === 'string')
          tokens[name] = value
      }
    }
  }
  return { colorScheme, tokens }
}

interface ResolvedSide {
  value: string
  colors?: Rgba[]
  inherited: boolean
}

function resolveSide(name: string, role: 'foreground' | 'background', lookup: (name: string) => string | undefined): ResolvedSide {
  let raw = lookup(name) ?? ''
  const inherited = /^(?:inherit|currentcolor)$/iu.test(raw.trim())
  // Inherited text colour comes from the game container.
  if (inherited)
    raw = 'var(--adv-c-text)'
  const value = resolveCssVars(raw, lookup)
  if (value.includes('var('))
    return { value, inherited }
  if (role === 'foreground') {
    const color = parseCssColor(value)
    return { value, colors: color && [color], inherited }
  }
  const stops = parsePaintColors(value)
  // Text sits on the opaque part of a gradient; fully faded stops are decoration.
  const surface = stops?.filter(stop => stop.a >= 0.5)
  return { value, colors: surface?.length ? surface : stops, inherited }
}

interface PairResult {
  ratio: number
  foreground: Rgba
  background: Rgba
  failing: Set<'dark' | 'light'>
}

function evaluatePair(pair: GameUiContrastPair, foreground: Rgba, backgrounds: Rgba[]): PairResult {
  let worst: PairResult | undefined
  const failing = new Set<'dark' | 'light'>()
  for (const background of backgrounds) {
    for (const backdrop of backdrops) {
      const surface = composite(background, backdrop.color)
      const text = composite(foreground, surface)
      const ratio = contrastRatio(text, surface)
      if (ratio < pair.minRatio)
        failing.add(backdrop.name)
      if (!worst || ratio < worst.ratio)
        worst = { ratio, foreground: text, background: surface, failing }
    }
  }
  return worst!
}

function checkContrast(input: GameUiThemeCheckInput, merged: ReturnType<typeof mergeGameUiThemeSources>, invalid: Set<string>): CheckIssue[] {
  const issues: CheckIssue[] = []
  const declared = new Set(Object.keys(merged.tokens))
  const target = [...input.sources].reverse().find(source => isRecord(source.ui) && isRecord(source.ui.tokens))
  const file = target ? projectPath(input.cwd, target.file) : 'theme.config'
  const schemes = merged.colorScheme ? [merged.colorScheme] : (['light', 'dark'] as const)
  for (const pair of gameUiContrastPairs) {
    if (pair.theme && pair.theme !== input.theme)
      continue
    const reported = new Set<string>()
    for (const scheme of schemes) {
      const used = new Set<string>()
      const lookup = (name: string) => {
        used.add(name)
        if (declared.has(name))
          return merged.tokens[name]
        return resolveGameUiTokenDefault(name as `--adv-theme-${string}`, scheme, input.theme)
      }
      const foreground = resolveSide(pair.foreground, 'foreground', lookup)
      const background = resolveSide(pair.background, 'background', lookup)
      const involved = [...used].filter(name => declared.has(name))
      // Invalid values already have their own diagnostic.
      if (!involved.length || involved.some(name => invalid.has(name)))
        continue
      const schemeDependent = !merged.colorScheme && [...used].some(name =>
        !declared.has(name) && typeof getGameUiTokenSpec(name, input.theme)?.default === 'object')
      const anchor = [pair.foreground, pair.background].find(name => declared.has(name)) ?? involved[0]
      const location = target ? locate(target.file, anchor) : { line: 1, column: 1 }
      const base = { category: 'theme' as const, file, ...location }
      if (!foreground.colors?.length || !background.colors?.length) {
        const key = 'unverified'
        if (!reported.has(key)) {
          reported.add(key)
          const side = !foreground.colors?.length ? `${pair.foreground} "${foreground.value}"` : `${pair.background} "${background.value}"`
          issues.push({
            ...base,
            type: 'warning',
            code: 'ADV_THEME_CONTRAST_UNVERIFIED',
            certainty: 'uncertain',
            message: `${pair.description}: contrast cannot be computed from ${side}.`,
            suggestion: 'Use hex, rgb() or hsl() colours (or a single gradient of them) so contrast can be checked, then verify the screenshots.',
          })
        }
        continue
      }
      const result = evaluatePair(pair, foreground.colors[0], background.colors)
      if (result.ratio >= pair.minRatio)
        continue
      const certain = result.failing.size === backdrops.length && !foreground.inherited
      const context = [
        schemeDependent ? `${scheme} scheme` : '',
        certain ? '' : result.failing.has('light') ? 'over a light scene' : 'over a dark scene',
        foreground.inherited ? `${pair.foreground} inherits --adv-c-text` : '',
      ].filter(Boolean).join(', ')
      const message = `${pair.description}: contrast ${result.ratio.toFixed(2)}:1 is below ${pair.minRatio}:1 (${pair.foreground} ${formatColor(result.foreground)} on ${pair.background} ${formatColor(result.background)}${context ? `; ${context}` : ''}).`
      if (reported.has(message))
        continue
      reported.add(message)
      issues.push({
        ...base,
        type: certain ? 'error' : 'warning',
        code: 'ADV_THEME_LOW_CONTRAST',
        certainty: certain ? 'certain' : 'uncertain',
        message,
        suggestion: foreground.inherited
          ? `Declare ${pair.foreground} explicitly with at least ${pair.minRatio}:1 contrast against ${pair.background}.`
          : !certain
              ? `Make ${pair.background} more opaque, or adjust ${pair.foreground}, so it reaches ${pair.minRatio}:1 over any scene art.`
              : schemeDependent
                ? `Set ui.colorScheme, or declare both ${pair.foreground} and ${pair.background}, so they reach ${pair.minRatio}:1 (WCAG 2.2 AA).`
                : `Adjust ${pair.foreground} or ${pair.background} until they reach ${pair.minRatio}:1 (WCAG 2.2 AA ${pair.kind === 'non-text' ? 'non-text' : pair.kind === 'large-text' ? 'large text' : 'text'} contrast).`,
      })
    }
  }
  return issues
}

/** Diagnostics for `ThemeConfig.ui`: token names, value units, colours and declared contrast pairs. */
export function checkGameUiTheme(input: GameUiThemeCheckInput): CheckIssue[] {
  const invalid = new Set<string>()
  const issues = input.sources.flatMap(source => validateSource(source, input.cwd, input.theme, invalid))
  const merged = mergeGameUiThemeSources(input.sources)
  issues.push(...checkContrast(input, merged, invalid))
  return issues
}

function advConfigOf(cwd: string, loaded?: Pick<LoadedProject, 'config' | 'files'>): { file: string, data: unknown } | undefined {
  const json = loaded?.files['adv.config.json']
  if (!json)
    return undefined
  try {
    return { file: resolve(cwd, loaded.config.path ?? 'adv.config.json'), data: JSON.parse(json) as unknown }
  }
  catch {
    return undefined // Project compilation already reports malformed JSON.
  }
}

/** Theme diagnostics for `adv check`, reusing a project that is already loaded. */
export async function checkProjectGameUiTheme(cwd: string, loaded?: Pick<LoadedProject, 'config' | 'files'>): Promise<CheckIssue[]> {
  return (await resolveProjectGameUiTheme(cwd, loaded)).issues
}

/** Resolve the project's theme name, merged `ui` settings and their diagnostics. */
export async function resolveProjectGameUiTheme(cwd: string, loaded?: Pick<LoadedProject, 'config' | 'files'>): Promise<ProjectGameUiTheme> {
  if (!loaded) {
    const { loadProject } = await import('../project')
    loaded = await loadProject({ root: cwd, staticAnalysis: true }).catch(() => undefined)
  }
  const { theme = 'default', sources, issues } = await loadGameUiThemeSources(cwd, advConfigOf(cwd, loaded))
  return {
    theme,
    ...mergeGameUiThemeSources(sources),
    sources,
    issues: [...issues, ...checkGameUiTheme({ cwd, theme, sources })],
  }
}
