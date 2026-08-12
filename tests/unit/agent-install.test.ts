import { cp, mkdtemp, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { installAgentIntegration } from '../../packages/advjs/node/agent'

const repositoryRoot = resolve(import.meta.dirname, '../..')
const sourceSkillsRoot = resolve(repositoryRoot, 'skills')
const temporaryDirectories: string[] = []

async function fakeHome() {
  const root = await mkdtemp(join(tmpdir(), 'advjs-agent-home-'))
  temporaryDirectories.push(root)
  return root
}

afterEach(async () => {
  const { rm } = await import('node:fs/promises')
  await Promise.all(temporaryDirectories.splice(0).map(root => rm(root, { force: true, recursive: true })))
})

describe('agent installer', () => {
  it('returns a path-aware dry-run without touching the fake home', async () => {
    const home = await fakeHome()
    const result = await installAgentIntegration({
      client: 'codex',
      dryRun: true,
      home,
      mcp: true,
      skills: 'default',
      skillsRoot: sourceSkillsRoot,
    })

    expect(result).toMatchObject({
      changed: true,
      client: 'codex',
      configPath: join(home, '.codex/config.toml'),
      dryRun: true,
      mcp: { command: 'adv-mcp-server', installed: true },
      skills: [
        { name: 'adv-art', revision: '0.1.2' },
        { name: 'adv-create', revision: '0.1.2' },
        { name: 'adv-debug', revision: '0.1.2' },
        { name: 'adv-review', revision: '0.1.2' },
      ],
    })
    expect(result.diff.every(operation => operation.path.startsWith(home))).toBe(true)
    await expect(stat(join(home, '.codex'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it.each([
    {
      client: 'codex' as const,
      config: '.codex/config.toml',
      initial: 'model = "gpt-5"\n',
      skills: '.agents/skills',
      unrelated: 'model = "gpt-5"',
    },
    {
      client: 'claude-code' as const,
      config: '.claude.json',
      initial: '{"theme":"dark","mcpServers":{}}\n',
      skills: '.claude/skills',
      unrelated: '"theme": "dark"',
    },
    {
      client: 'cursor' as const,
      config: '.cursor/mcp.json',
      initial: '{"mcpServers":{},"workspace":"keep"}\n',
      skills: '.cursor/skills',
      unrelated: '"workspace": "keep"',
    },
  ])('installs $client atomically, preserves config, and is idempotent', async ({ client, config, initial, skills, unrelated }) => {
    const home = await fakeHome()
    const configPath = join(home, config)
    const { mkdir } = await import('node:fs/promises')
    await mkdir(resolve(configPath, '..'), { recursive: true })
    await writeFile(configPath, initial, 'utf8')

    const first = await installAgentIntegration({ client, home, mcp: true, skills: 'default', skillsRoot: sourceSkillsRoot })
    expect(first.changed).toBe(true)
    expect(await readFile(configPath, 'utf8')).toContain(unrelated)
    expect(await readFile(configPath, 'utf8')).toContain('adv-mcp-server')
    expect((await readdir(resolve(configPath, '..'))).some(name => name.includes('.advjs-backup.'))).toBe(true)
    for (const skill of first.skills)
      await expect(stat(join(home, skills, skill.name, 'SKILL.md'))).resolves.toBeTruthy()

    const second = await installAgentIntegration({ client, home, mcp: true, skills: 'default', skillsRoot: sourceSkillsRoot })
    expect(second.changed).toBe(false)
    expect(second.diff.every(operation => operation.kind === 'unchanged')).toBe(true)
  })

  it('rejects a Skill whose package content no longer matches the catalog', async () => {
    const home = await fakeHome()
    const corruptRoot = join(await fakeHome(), 'skills')
    await cp(sourceSkillsRoot, corruptRoot, { recursive: true })
    await writeFile(join(corruptRoot, 'adv-create/SKILL.md'), 'corrupted', 'utf8')

    await expect(installAgentIntegration({
      client: 'codex',
      home,
      skills: 'default',
      skillsRoot: corruptRoot,
    })).rejects.toThrow(/integrity/u)
  })
})
