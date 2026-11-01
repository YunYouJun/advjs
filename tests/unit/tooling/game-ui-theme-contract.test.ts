// @vitest-environment node

import type { GameUiTokenName } from '@advjs/types'
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterEach, describe, expect, it } from 'vitest'
import { runCheck } from '../../../packages/advjs/node/commands/check'
import { checkGameUiTheme } from '../../../packages/advjs/node/game-ui/check'
import { parseCssColor, parsePaintColors, resolveCssVars } from '../../../packages/advjs/node/game-ui/color'
import { createGameUiThemeContract, formatGameUiThemeContract } from '../../../packages/advjs/node/game-ui/contract'
import { renderGameUiThemeConfig, writeGameUiThemePreset } from '../../../packages/advjs/node/game-ui/preset'
import { parseGameUiViewport } from '../../../packages/advjs/node/game-ui/screenshot'
import { loadProject } from '../../../packages/advjs/node/project'
import { createAdvMcpServer } from '../../../packages/mcp-server/src/index'
import { gameUiContrastPairs, gameUiThemePresets, gameUiTokenContract, gameUiTokenNames, getGameUiTokenSpec, resolveGameUiTokenDefault } from '../../../packages/types/src'

const fixtures = resolve(import.meta.dirname, '../../fixtures/diagnostics')
const roots: string[] = []

function project() {
  const cwd = mkdtempSync(join(tmpdir(), 'advjs-theme-contract-'))
  roots.push(cwd)
  cpSync(join(fixtures, 'valid'), cwd, { recursive: true })
  return cwd
}

afterEach(() => {
  for (const root of roots.splice(0))
    rmSync(root, { recursive: true, force: true })
})

describe('game UI token contract', () => {
  it('describes every public token, and only public tokens', () => {
    expect(Object.keys(gameUiTokenContract).sort()).toEqual([...gameUiTokenNames].sort())
    for (const name of gameUiTokenNames) {
      const spec = gameUiTokenContract[name]
      expect(spec.description.length, name).toBeGreaterThan(15)
      expect(spec.consumers.length, name).toBeGreaterThan(0)
    }
  })

  it('keeps colour defaults computable in both schemes', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const lookup = (name: string) => gameUiTokenNames.includes(name as GameUiTokenName)
        ? resolveGameUiTokenDefault(name as GameUiTokenName, scheme)
        : undefined
      for (const name of gameUiTokenNames) {
        const { kind } = gameUiTokenContract[name]
        const value = resolveCssVars(resolveGameUiTokenDefault(name, scheme)!, lookup)
        if (kind === 'color' && !/inherit|currentcolor/iu.test(value))
          expect(parseCssColor(value), `${name} (${scheme}): ${value}`).toBeDefined()
        if (kind === 'paint')
          expect(parsePaintColors(value), `${name} (${scheme}): ${value}`).toBeDefined()
      }
    }
  })

  it('declares contrast pairs over colour tokens with WCAG thresholds', () => {
    for (const pair of gameUiContrastPairs) {
      expect(['color', 'paint']).toContain(getGameUiTokenSpec(pair.foreground, pair.theme)?.kind)
      expect(['color', 'paint']).toContain(getGameUiTokenSpec(pair.background, pair.theme)?.kind)
      expect(pair.minRatio).toBe(pair.kind === 'text' ? 4.5 : 3)
    }
    expect(gameUiContrastPairs.map(pair => pair.id)).toEqual(expect.arrayContaining(['dialog-text', 'choice-text', 'focus-surface']))
  })

  it('exports defaults for every bundled theme and renders them for adv context', () => {
    const contract = createGameUiThemeContract()
    expect(contract.tokens.map(token => token.name)).toEqual([...gameUiTokenNames])
    const serif = contract.tokens.find(token => token.name === '--adv-font-serif')!
    expect(serif.defaults.default.light).toContain('Songti SC')
    expect(serif.defaults.starter.light).toBe('serif')
    expect(contract.tokens.find(token => token.name === '--adv-c-text')!.defaults.pominis).toEqual({ light: '#000', dark: '#fff' })
    expect(contract.themeTokens.default!.map(token => token.name)).toContain('--adv-theme-start-menu-bg')

    const markdown = formatGameUiThemeContract(contract, { theme: 'default', tokens: { '--adv-c-primary': '#123456' }, files: ['theme.config.ts'], diagnostics: [] })
    for (const name of gameUiTokenNames)
      expect(markdown).toContain(`\`${name}\``)
    for (const preset of gameUiThemePresets)
      expect(markdown).toContain(`\`${preset.id}\``)
    expect(markdown).toContain('`--adv-c-primary`: `#123456`')
    expect(markdown).toContain('L3 Theme package')
    expect(markdown).toContain('`--adv-theme-start-title-size`')
  })
})

describe('game UI theme presets', () => {
  it('ships distinct presets that pass every theme diagnostic', () => {
    expect(gameUiThemePresets.length).toBeGreaterThanOrEqual(2)
    expect(new Set(gameUiThemePresets.map(preset => preset.colorScheme))).toEqual(new Set(['light', 'dark']))
    for (const preset of gameUiThemePresets) {
      expect(checkGameUiTheme({
        cwd: '/game',
        theme: 'default',
        sources: [{ file: '/game/theme.config.ts', ui: { colorScheme: preset.colorScheme, tokens: preset.tokens } }],
      }), preset.id).toEqual([])
    }
  })

  it('writes a preset theme.config.ts that adv check accepts, without overwriting by default', async () => {
    const cwd = project()
    const result = writeGameUiThemePreset(cwd, 'neon-noir')
    expect(result).toMatchObject({ preset: 'neon-noir', tokens: Object.keys(gameUiThemePresets[0].tokens).length })
    expect(readFileSync(result.file, 'utf8')).toBe(renderGameUiThemeConfig(gameUiThemePresets[0]))
    expect(readFileSync(result.file, 'utf8')).toContain('import { defineThemeConfig } from \'advjs\'')
    const checked = await runCheck({ cwd })
    expect(checked.issues).toEqual([])
    expect(() => writeGameUiThemePreset(cwd, 'paper-ink')).toThrow(/already exists/u)
    expect(writeGameUiThemePreset(cwd, 'paper-ink', true).preset).toBe('paper-ink')
    expect(() => writeGameUiThemePreset(cwd, 'vaporwave')).toThrow(/Unknown theme preset/u)
  })

  it('parses screenshot viewports', () => {
    expect(parseGameUiViewport('narrow=390x844')).toEqual({ name: 'narrow', width: 390, height: 844 })
    expect(parseGameUiViewport('1024x768')).toEqual({ name: '1024x768', width: 1024, height: 768 })
    expect(() => parseGameUiViewport('wide')).toThrow(/Invalid viewport/u)
  })
})

describe('adv://theme MCP resource', () => {
  it('returns the contract with this project\'s theme state', async () => {
    const cwd = project()
    writeGameUiThemePreset(cwd, 'paper-ink')
    const previous = process.cwd()
    process.chdir(cwd)
    const server = createAdvMcpServer({ projectLoader: loadProject })
    const client = new Client({ name: 'theme-test', version: '0.0.0' })
    try {
      const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
      await Promise.all([server.connect(serverTransport), client.connect(clientTransport)])
      const resources = await client.listResources()
      expect(resources.resources.map(resource => resource.uri)).toContain('adv://theme')
      const tools = await client.listTools()
      expect(tools.tools.map(tool => tool.name)).toContain('adv_theme_screenshot')
      const response = await client.readResource({ uri: 'adv://theme' })
      const data = JSON.parse((response.contents[0] as { text: string }).text)
      expect(data.schemaVersion).toBe(1)
      expect(data.tokens).toHaveLength(gameUiTokenNames.length)
      expect(data.contrastPairs.length).toBe(gameUiContrastPairs.length)
      expect(data.presets.map((preset: { id: string }) => preset.id)).toEqual(gameUiThemePresets.map(preset => preset.id))
      expect(data.project).toMatchObject({ theme: 'default', colorScheme: 'light', files: ['theme.config.ts'], diagnostics: [] })
      expect(data.project.tokens['--adv-c-primary']).toBe('#a8321f')
    }
    finally {
      await client.close()
      process.chdir(previous)
    }
  })
})
