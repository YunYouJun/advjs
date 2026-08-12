import { chmod, cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it } from 'vitest'
import { installAgentIntegration } from '../../packages/advjs/node/agent'
import { runDoctor } from '../../packages/advjs/node/commands/doctor'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const sourceSkillsRoot = resolve(repositoryRoot, 'skills')
const temporaryDirectories: string[] = []

async function temporaryRoot(prefix: string) {
  const root = await mkdtemp(join(tmpdir(), prefix))
  temporaryDirectories.push(root)
  return root
}

afterEach(async () => {
  const { rm } = await import('node:fs/promises')
  await Promise.all(temporaryDirectories.splice(0).map(root => rm(root, { force: true, recursive: true })))
})

async function createFakeMcpServer(root: string) {
  const logPath = join(root, 'mcp.log')
  const script = join(root, 'fake-mcp.mjs')
  await writeFile(script, `
import { appendFileSync } from 'node:fs'
import readline from 'node:readline'
const input = readline.createInterface({ input: process.stdin })
input.on('line', (line) => {
  const request = JSON.parse(line)
  appendFileSync(${JSON.stringify(logPath)}, request.method + '\\n')
  if (request.id === 1)
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2024-11-05', capabilities: {}, serverInfo: { name: 'fake-advjs', version: '1' } } }) + '\\n')
  if (request.id === 2)
    process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id: 2, result: { contents: [{ uri: 'adv://project/overview', mimeType: 'text/plain', text: 'ok' }] } }) + '\\n')
})
`, 'utf8')
  await chmod(script, 0o755)
  return { logPath, script }
}

describe('doctor diagnostics', () => {
  it('checks the core environment and completes a real MCP resource handshake', async () => {
    const sandbox = await temporaryRoot('advjs-doctor-')
    const projectRoot = join(sandbox, 'project')
    const home = join(sandbox, 'home')
    const editorRoot = join(sandbox, 'editor')
    await cp(resolve(repositoryRoot, 'tests/launch/fixtures/golden-project'), projectRoot, { recursive: true })
    await mkdir(editorRoot, { recursive: true })
    await writeFile(join(editorRoot, 'index.html'), '<!doctype html>', 'utf8')
    await installAgentIntegration({ client: 'codex', home, mcp: true, skills: 'default', skillsRoot: sourceSkillsRoot })
    const mcp = await createFakeMcpServer(sandbox)

    const result = await runDoctor({
      client: 'codex',
      editorRoot,
      home,
      mcpArgs: [mcp.script],
      mcpCommand: process.execPath,
      projectRoot,
      skillsRoot: sourceSkillsRoot,
      toolProbe: async () => true,
    })

    expect(result.checks.filter(check => check.status === 'fail')).toEqual([])
    expect(result.checks.find(check => check.id === 'mcp-handshake')).toMatchObject({ status: 'pass' })
    expect(await readFile(mcp.logPath, 'utf8')).toBe('initialize\nnotifications/initialized\nresources/read\n')
  })

  it('reports optional tools as warnings without turning them into core failures', async () => {
    const sandbox = await temporaryRoot('advjs-doctor-warn-')
    const projectRoot = join(sandbox, 'project')
    const editorRoot = join(sandbox, 'editor')
    await cp(resolve(repositoryRoot, 'tests/launch/fixtures/golden-project'), projectRoot, { recursive: true })
    await mkdir(editorRoot, { recursive: true })
    await writeFile(join(editorRoot, 'index.html'), '<!doctype html>', 'utf8')
    const mcp = await createFakeMcpServer(sandbox)

    const result = await runDoctor({
      editorRoot,
      home: join(sandbox, 'empty-home'),
      mcpArgs: [mcp.script],
      mcpCommand: process.execPath,
      projectRoot,
      skillsRoot: sourceSkillsRoot,
      toolProbe: async () => false,
    })

    expect(result.checks.filter(check => check.id.startsWith('optional-')).every(check => check.status === 'warn')).toBe(true)
    expect(result.checks.find(check => check.id === 'agent-installation')).toMatchObject({ status: 'warn' })
    expect(result.checks.find(check => check.id === 'project-root')).toMatchObject({ status: 'pass' })
  })
})
