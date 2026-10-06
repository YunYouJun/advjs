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

it('creates, preserves, replaces and removes portraits through the real MCP tools', async () => {
  const root = mkdtempSync(join(tmpdir(), 'advjs-character-portraits-'))
  const previousCwd = process.cwd()
  writeFileSync(join(root, 'adv.config.json'), JSON.stringify({ format: 'adv-md', root: './adv' }))
  process.chdir(root)
  const server = createAdvMcpServer()
  const client = new Client({ name: 'portrait-test', version: '1.0.0' })
  try {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)])
    const avatars = { thoughtful: { src: 'art/hero-thoughtful.webp', label: '思索' } }
    const read = () => parseCharacterMd(readFileSync(join(root, 'adv/characters/hero.character.md'), 'utf8'))
    expect((await client.callTool({ name: 'create_character', arguments: { id: 'hero', name: 'Hero', avatar: 'art/hero.webp', avatars } })).isError).not.toBe(true)
    await client.callTool({ name: 'edit_character', arguments: { id: 'hero', name: 'Renamed' } })
    expect(read()).toMatchObject({ avatar: 'art/hero.webp', avatars })
    const invalid = await client.callTool({ name: 'edit_character', arguments: { id: 'hero', avatars: { thoughtful: { src: '' } } } })
    expect(invalid.isError).toBe(true)
    expect(read().avatars).toEqual(avatars)
    const replacement = { resolved: { src: 'art/resolved.webp' } }
    await client.callTool({ name: 'edit_character', arguments: { id: 'hero', avatars: replacement } })
    expect(read().avatars).toEqual(replacement)
    const bulk = await client.callTool({ name: 'create_characters', arguments: { items: [{ id: 'friend', name: 'Friend', avatars }] } })
    expect(bulk.isError).not.toBe(true)
    expect(parseCharacterMd(readFileSync(join(root, 'adv/characters/friend.character.md'), 'utf8')).avatars).toEqual(avatars)
    await client.callTool({ name: 'edit_character', arguments: { id: 'hero', avatars: null } })
    expect(read().avatars).toBeUndefined()
    expect(read().avatar).toBe('art/hero.webp')
  }
  finally {
    await client.close()
    await server.close()
    process.chdir(previousCwd)
    rmSync(root, { recursive: true, force: true })
  }
})
