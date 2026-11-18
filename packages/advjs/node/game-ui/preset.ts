import type { GameUiThemePreset } from '@advjs/types'
import { existsSync, writeFileSync } from 'node:fs'
import { gameUiThemePresets } from '@advjs/types'
import { join } from 'pathe'
import { AdvCommandError } from '../commands/errors'

const themeConfigFiles = ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs', 'json'].map(extension => `theme.config.${extension}`)

export function findGameUiThemePreset(id: string): GameUiThemePreset {
  const preset = gameUiThemePresets.find(item => item.id === id)
  if (!preset)
    throw new AdvCommandError('ADV_USAGE', `Unknown theme preset "${id}". Available: ${gameUiThemePresets.map(item => item.id).join(', ')}.`)
  return preset
}

function quote(value: string): string {
  return `'${value.replaceAll('\\', '\\\\').replaceAll('\'', '\\\'')}'`
}

/** `theme.config.ts` source for a preset, ready to adapt. */
export function renderGameUiThemeConfig(preset: GameUiThemePreset): string {
  const tokens = Object.entries(preset.tokens).map(([name, value]) => `      ${quote(name)}: ${quote(value!)},`)
  return [
    'import { defineThemeConfig } from \'advjs\'',
    '',
    `// Started from the "${preset.id}" preset. Adapt it to the story, then run`,
    '// `adv check` and `adv theme screenshot`.',
    'export default defineThemeConfig({',
    '  ui: {',
    `    colorScheme: ${quote(preset.colorScheme)},`,
    '    tokens: {',
    ...tokens,
    '    },',
    '  },',
    '})',
    '',
  ].join('\n')
}

export interface WriteGameUiThemePresetResult {
  file: string
  preset: string
  tokens: number
}

/** Write `theme.config.ts` from a preset; refuses to replace an existing theme config unless forced. */
export function writeGameUiThemePreset(cwd: string, id: string, force = false): WriteGameUiThemePresetResult {
  const preset = findGameUiThemePreset(id)
  const existing = themeConfigFiles.find(file => existsSync(join(cwd, file)))
  if (existing && (!force || existing !== 'theme.config.ts'))
    throw new AdvCommandError('ADV_VALIDATION', `${existing} already exists; edit it${existing === 'theme.config.ts' ? ', or pass --force to replace it' : ', or remove it first'} to start from the "${id}" preset.`)
  const file = join(cwd, 'theme.config.ts')
  writeFileSync(file, renderGameUiThemeConfig(preset))
  return { file, preset: preset.id, tokens: Object.keys(preset.tokens).length }
}
