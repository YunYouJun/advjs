// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { expect, it } from 'vitest'
import { createAdvMcpServer } from '../../packages/mcp-server/src/index'
import { parseCharacterMd } from '../../packages/parser/src/character'

it('creates, preserves, replaces and removes visual identities through real MCP tools', async () => {
  const root = mkdtempSync(join(tmpdir(), 'advjs-character-visual-'))
  const previousCwd = process.cwd()
  writeFileSync(join(root, 'adv.config.json'), JSON.stringify({ format: 'adv-md', root: './adv' }))
  process.chdir(root)
  const server = createAdvMcpServer()
  const client = new Client({ name: 'character-test', version: '1.0.0' })
  try {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)])
    const visual = { version: 'v1', references: [{ path: 'art/hero.png', description: 'Left figure' }], fixedTraits: ['Short beard'] }
    const created = await client.callTool({ name: 'create_character', arguments: { id: 'hero', name: 'Hero', visual, background: 'Unchanged history' } })
    expect(created.isError).not.toBe(true)
    const read = () => parseCharacterMd(readFileSync(join(root, 'adv/characters/hero.character.md'), 'utf8'))
    expect(read().visual).toEqual(visual)
    await client.callTool({ name: 'edit_character', arguments: { id: 'hero', name: 'Renamed' } })
    expect(read().visual).toEqual(visual)
    await client.callTool({ name: 'edit_character', arguments: { id: 'hero', visual: { ...visual, version: 'v2' } } })
    expect(read().visual?.version).toBe('v2')
    const beforeInvalidEdit = read()
    const invalid = await client.callTool({ name: 'edit_character', arguments: { id: 'hero', visual: { ...visual, references: [{ path: '../secret.png' }] } } })
    expect(invalid.isError).toBe(true)
    expect(read()).toEqual(beforeInvalidEdit)
    const bulk = await client.callTool({ name: 'create_characters', arguments: { items: [{ id: 'friend', name: 'Friend', visual }] } })
    expect(bulk.isError).not.toBe(true)
    expect(parseCharacterMd(readFileSync(join(root, 'adv/characters/friend.character.md'), 'utf8')).visual).toEqual(visual)
    await client.callTool({ name: 'edit_character', arguments: { id: 'hero', visual: null } })
    expect(read().visual).toBeUndefined()
    expect(read().background).toBe('Unchanged history')
  }
  finally {
    await client.close()
    await server.close()
    process.chdir(previousCwd)
    rmSync(root, { recursive: true, force: true })
  }
})
