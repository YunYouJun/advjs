// @vitest-environment node

import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createPackageManifest, LAUNCH_VERSION } from '../../scripts/release/package-manifest.mjs'
import { createLaunchRegistry, launchRegistryEnvironment, runLaunchCommand, writeLaunchRegistryConfig, writeLaunchWorkspaceConfig } from './helpers/registry'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const fixturesRoot = resolve(repositoryRoot, 'tests/fixtures/agent-configs')
const pnpmExecutable = 'pnpm'
const clients = ['codex', 'claude-code', 'cursor'] as const
const clientContracts = {
  'codex': {
    configPath: '.codex/config.toml',
    fixture: 'codex/config.toml',
    preserved: 'approval_policy = "never"',
    skillsPath: '.agents/skills',
    version: 'codex-config-v1',
  },
  'claude-code': {
    configPath: '.claude.json',
    fixture: 'claude-code/config.json',
    preserved: '"theme": "dark"',
    skillsPath: '.claude/skills',
    version: 'claude-code-config-v1',
  },
  'cursor': {
    configPath: '.cursor/mcp.json',
    fixture: 'cursor/mcp.json',
    preserved: '"workspace": "keep"',
    skillsPath: '.cursor/skills',
    version: 'cursor-config-v1',
  },
} as const

let temporaryRoot = ''
let packageDirectory = ''
let installDirectory = ''
let registry: Awaited<ReturnType<typeof createLaunchRegistry>>
let manifest: Awaited<ReturnType<typeof createPackageManifest>>

async function runNode(args: string[], cwd: string) {
  return await runLaunchCommand(process.execPath, args, cwd, registry.url, temporaryRoot)
}

async function createProject(name: string) {
  const root = join(temporaryRoot, `project-${name}`)
  await mkdir(join(root, 'adv'), { recursive: true })
  await writeFile(join(root, 'adv.config.json'), '{"format":"adv-md","root":"./adv"}\n', 'utf8')
  return root
}

async function connectMcp(projectRoot: string) {
  const mcpBin = join(installDirectory, 'node_modules/@advjs/mcp-server/bin/mcp-server.mjs')
  const transport = new StdioClientTransport({
    args: [mcpBin],
    command: process.execPath,
    cwd: projectRoot,
    env: launchRegistryEnvironment(registry.url, temporaryRoot),
    stderr: 'pipe',
  })
  const client = new Client({ name: 'codex-launch-contract', version: '1.0.0' })
  await client.connect(transport)
  return { client, transport }
}

beforeAll(async () => {
  temporaryRoot = await mkdtemp(join(tmpdir(), 'advjs-agent-packed-'))
  packageDirectory = join(temporaryRoot, 'packages')
  installDirectory = join(temporaryRoot, 'install')
  await Promise.all([mkdir(packageDirectory), mkdir(installDirectory)])
  manifest = await createPackageManifest({
    build: process.env.ADVJS_PACKED_INSTALL_SKIP_BUILD !== '1',
    outputDirectory: packageDirectory,
    root: repositoryRoot,
  })
  registry = await createLaunchRegistry(manifest, packageDirectory)
  await writeLaunchRegistryConfig(temporaryRoot, registry.url)
  await writeLaunchWorkspaceConfig(installDirectory)
  await writeFile(join(installDirectory, 'package.json'), '{"name":"advjs-agent-smoke","private":true}\n', 'utf8')
  await runLaunchCommand(pnpmExecutable, [
    'add',
    `--registry=${registry.url}`,
    `advjs@${LAUNCH_VERSION}`,
    `@advjs/mcp-server@${LAUNCH_VERSION}`,
  ], installDirectory, registry.url, temporaryRoot)
  await mkdir(join(installDirectory, 'skills'))
  await writeFile(join(installDirectory, 'skills/catalog.json'), '{"corrupt":true}\n', 'utf8')
}, 300_000)

afterAll(async () => {
  await registry?.close()
  if (temporaryRoot)
    await rm(temporaryRoot, { force: true, recursive: true })
})

describe('packed Agent installation smoke', () => {
  it('installs discoverable Skills and MCP for Codex, Claude Code, and Cursor without clobbering config', async () => {
    const advBin = join(installDirectory, 'node_modules/advjs/bin/adv.mjs')
    const records: Array<Record<string, unknown>> = []

    for (const clientName of clients) {
      const contract = clientContracts[clientName]
      const home = join(temporaryRoot, `home-${clientName}`)
      const configPath = join(home, contract.configPath)
      await mkdir(dirname(configPath), { recursive: true })
      await cp(join(fixturesRoot, contract.fixture), configPath)

      const first = await runNode([
        advBin,
        'agent',
        'install',
        '--client',
        clientName,
        '--skills',
        'default',
        '--mcp',
        '--home',
        home,
        '--json',
      ], installDirectory)
      const firstEnvelope = JSON.parse(first.stdout)
      expect(firstEnvelope).toMatchObject({ command: 'agent.install', ok: true, data: { changed: true, client: clientName } })
      expect(await readFile(configPath, 'utf8')).toContain(contract.preserved)
      expect(await readFile(configPath, 'utf8')).toContain('adv-mcp-server')

      for (const skill of firstEnvelope.data.skills) {
        const installed = join(home, contract.skillsPath, skill.name)
        expect(await readFile(join(installed, 'SKILL.md'), 'utf8')).toContain(`name: ${skill.name}`)
        expect(await readFile(join(installed, 'agents/openai.yaml'), 'utf8')).toContain(`$${skill.name}`)
      }
      await expect(stat(join(home, contract.skillsPath, 'adv-hamster-demo'))).rejects.toMatchObject({ code: 'ENOENT' })

      const second = await runNode([
        advBin,
        'agent',
        'install',
        '--client',
        clientName,
        '--skills',
        'default',
        '--mcp',
        '--home',
        home,
        '--json',
      ], installDirectory)
      expect(JSON.parse(second.stdout)).toMatchObject({ ok: true, data: { changed: false } })

      const projectRoot = await createProject(clientName)
      const { client } = await connectMcp(projectRoot)
      try {
        const resources = await client.listResources()
        expect(resources.resources.some(resource => resource.uri === 'adv://project/compiled')).toBe(true)
      }
      finally {
        await client.close()
      }

      records.push({
        client: clientName,
        clientVersion: contract.version,
        packageVersion: LAUNCH_VERSION,
        skills: firstEnvelope.data.skills,
      })
    }

    const artifactsRoot = resolve(process.env.ADV_LAUNCH_ARTIFACTS_DIR || join(temporaryRoot, 'artifacts'))
    await mkdir(artifactsRoot, { recursive: true })
    await writeFile(join(artifactsRoot, 'agent-install-smoke.json'), `${JSON.stringify({ records }, null, 2)}\n`, 'utf8')
  }, 240_000)

  it('uses the installed adv-create Skill to drive packed MCP generation and validates the result twice', async () => {
    const advBin = join(installDirectory, 'node_modules/advjs/bin/adv.mjs')
    const home = join(temporaryRoot, 'home-codex')
    const request = (await readFile(join(fixturesRoot, 'codex/request.txt'), 'utf8')).trim()
    const skill = await readFile(join(home, '.agents/skills/adv-create/SKILL.md'), 'utf8')
    expect(request).toContain('月球图书馆')
    expect(skill).toContain('Create a new ADV.JS visual novel')

    const projectRoot = join(temporaryRoot, 'project-codex')
    const { client } = await connectMcp(projectRoot)
    try {
      await client.callTool({
        name: 'create_character',
        arguments: {
          id: 'haruka',
          name: '阿遥',
          personality: '安静而好奇的月球图书管理员',
        },
      })
      await client.callTool({
        name: 'create_scene',
        arguments: {
          id: 'moon-library',
          name: '月球图书馆',
          description: '月光穿过穹顶，照亮漂浮的书页。',
        },
      })
      await client.callTool({
        name: 'create_chapter',
        arguments: {
          filename: 'chapter_01',
          content: '---\nplotSummary: 阿遥在月球图书馆开始值夜\n---\n\n【月球图书馆】\n\n@阿遥\n今晚，也要替地球保管好这些故事。\n',
        },
      })
      const validation = await client.callTool({ name: 'adv_validate', arguments: {} })
      expect(validation.isError).not.toBe(true)
      expect(JSON.stringify(validation.content)).toContain('All checks passed!')
    }
    finally {
      await client.close()
    }

    const checked = await runNode([advBin, 'check', '--json'], projectRoot)
    expect(JSON.parse(checked.stdout)).toMatchObject({ command: 'check', ok: true, data: { diagnostics: [] } })
  }, 120_000)
})
