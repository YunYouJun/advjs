import { createHash, randomUUID } from 'node:crypto'
import { copyFile, cp, lstat, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import process from 'node:process'

export const ADV_AGENT_CLIENTS = ['codex', 'claude-code', 'cursor'] as const
export type AdvAgentClient = typeof ADV_AGENT_CLIENTS[number]
export type AgentInstallOperationKind = 'create' | 'update' | 'unchanged'

interface SkillCatalogEntry {
  group: 'default' | 'optional' | 'repository-only'
  integrity: string
  name: string
  revision: string
}

interface SkillCatalog {
  groups: {
    default: string[]
    optional: string[]
    repositoryOnly: string[]
  }
  schemaVersion: number
  skills: SkillCatalogEntry[]
}

export interface InstallAgentIntegrationOptions {
  client: AdvAgentClient
  dryRun?: boolean
  home?: string
  mcp?: boolean
  skills?: 'all' | 'default' | 'optional' | string
  skillsRoot?: string
}

export interface AgentInstallResult {
  changed: boolean
  client: AdvAgentClient
  configPath: string
  diff: Array<{
    kind: AgentInstallOperationKind
    path: string
  }>
  dryRun: boolean
  mcp: {
    command: 'adv-mcp-server'
    installed: boolean
  }
  skills: Array<Pick<SkillCatalogEntry, 'name' | 'revision' | 'integrity'>>
}

interface ClientAdapter {
  configPath: (home: string) => string
  skillsPath: (home: string) => string
  mergeMcpConfig: (existing: string) => string
}

export class AgentInstallError extends Error {}

const require = createRequire(import.meta.url)

function resolvePackagedSkillsRoot() {
  return resolve(dirname(require.resolve('advjs/package.json')), 'skills')
}

function canonicalJsonMcp(existing: string) {
  let config: Record<string, unknown>
  try {
    config = existing.trim() ? JSON.parse(existing) as Record<string, unknown> : {}
  }
  catch (error) {
    throw new AgentInstallError(`Cannot merge invalid JSON config: ${error instanceof Error ? error.message : String(error)}`)
  }
  const currentServers = config.mcpServers
  const mcpServers = currentServers && typeof currentServers === 'object' && !Array.isArray(currentServers)
    ? currentServers as Record<string, unknown>
    : {}
  return `${JSON.stringify({
    ...config,
    mcpServers: {
      ...mcpServers,
      advjs: {
        args: [],
        command: 'adv-mcp-server',
      },
    },
  }, null, 2)}\n`
}

const CODEX_BLOCK_START = '# >>> ADV.JS managed MCP server >>>'
const CODEX_BLOCK_END = '# <<< ADV.JS managed MCP server <<<'

function mergeCodexMcp(existing: string) {
  const managedBlock = `${CODEX_BLOCK_START}\n[mcp_servers.advjs]\ncommand = "adv-mcp-server"\nargs = []\n${CODEX_BLOCK_END}`
  const start = existing.indexOf(CODEX_BLOCK_START)
  const end = existing.indexOf(CODEX_BLOCK_END)
  if (start >= 0 && end >= start)
    return `${existing.slice(0, start)}${managedBlock}${existing.slice(end + CODEX_BLOCK_END.length)}`
  const separator = existing && !existing.endsWith('\n') ? '\n\n' : existing ? '\n' : ''
  return `${existing}${separator}${managedBlock}\n`
}

const CLIENT_ADAPTERS: Record<AdvAgentClient, ClientAdapter> = {
  'codex': {
    configPath: home => join(home, '.codex/config.toml'),
    skillsPath: home => join(home, '.agents/skills'),
    mergeMcpConfig: mergeCodexMcp,
  },
  'claude-code': {
    configPath: home => join(home, '.claude.json'),
    skillsPath: home => join(home, '.claude/skills'),
    mergeMcpConfig: canonicalJsonMcp,
  },
  'cursor': {
    configPath: home => join(home, '.cursor/mcp.json'),
    skillsPath: home => join(home, '.cursor/skills'),
    mergeMcpConfig: canonicalJsonMcp,
  },
}

async function pathExists(path: string) {
  return await lstat(path).then(() => true).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT')
      return false
    throw error
  })
}

export async function calculateSkillIntegrity(directory: string) {
  const files: string[] = []
  async function walk(current: string, prefix = ''): Promise<void> {
    for (const entry of (await readdir(current)).sort()) {
      const path = prefix ? `${prefix}/${entry}` : entry
      const absolutePath = join(current, entry)
      const stats = await lstat(absolutePath)
      if (stats.isSymbolicLink())
        throw new AgentInstallError(`Skill content cannot contain symbolic links: ${path}`)
      if (stats.isDirectory())
        await walk(absolutePath, path)
      else if (stats.isFile())
        files.push(path)
    }
  }
  await walk(directory)
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(file)
    hash.update('\0')
    hash.update(await readFile(join(directory, file)))
    hash.update('\0')
  }
  return hash.digest('hex')
}

async function backupFile(path: string, content: string) {
  const digest = createHash('sha256').update(content).digest('hex').slice(0, 12)
  const backup = `${path}.advjs-backup.${digest}`
  if (!await pathExists(backup))
    await copyFile(path, backup)
}

async function atomicWrite(path: string, content: string) {
  await mkdir(dirname(path), { recursive: true })
  if (await pathExists(path))
    await backupFile(path, await readFile(path, 'utf8'))
  const temporary = `${path}.advjs-tmp-${process.pid}-${randomUUID()}`
  try {
    await writeFile(temporary, content, { encoding: 'utf8', mode: 0o600 })
    await rename(temporary, path)
  }
  finally {
    await rm(temporary, { force: true })
  }
}

async function replaceDirectory(source: string, destination: string, previousIntegrity?: string) {
  const parent = dirname(destination)
  await mkdir(parent, { recursive: true })
  const temporary = await mkdtemp(join(parent, `.${basename(destination)}.advjs-tmp-`))
  try {
    await cp(source, temporary, { recursive: true })
    if (await pathExists(destination)) {
      const backup = `${destination}.advjs-backup.${previousIntegrity?.slice(0, 12) || 'unknown'}`
      if (!await pathExists(backup))
        await cp(destination, backup, { recursive: true })
      await rm(destination, { force: true, recursive: true })
    }
    await rename(temporary, destination)
  }
  catch (error) {
    await rm(temporary, { force: true, recursive: true })
    throw error
  }
}

function selectSkills(catalog: SkillCatalog, requested: string) {
  const names = requested === 'default'
    ? catalog.groups.default
    : requested === 'optional'
      ? catalog.groups.optional
      : requested === 'all'
        ? [...catalog.groups.default, ...catalog.groups.optional]
        : requested.split(',').map(name => name.trim()).filter(Boolean)
  const entries = new Map(catalog.skills.map(skill => [skill.name, skill]))
  return [...new Set(names)].sort().map((name) => {
    const skill = entries.get(name)
    if (!skill || skill.group === 'repository-only')
      throw new AgentInstallError(`Unknown or repository-only Skill: ${name}`)
    return skill
  })
}

export async function installAgentIntegration(options: InstallAgentIntegrationOptions): Promise<AgentInstallResult> {
  const adapter = CLIENT_ADAPTERS[options.client]
  if (!adapter)
    throw new AgentInstallError(`Unsupported Agent client: ${options.client}`)
  const home = resolve(options.home || homedir())
  const skillsRoot = resolve(options.skillsRoot || resolvePackagedSkillsRoot())
  const catalog = JSON.parse(await readFile(join(skillsRoot, 'catalog.json'), 'utf8')) as SkillCatalog
  const selected = selectSkills(catalog, options.skills || 'default')
  const diff: AgentInstallResult['diff'] = []
  const skillsPath = adapter.skillsPath(home)

  for (const skill of selected) {
    const source = join(skillsRoot, skill.name)
    const sourceIntegrity = await calculateSkillIntegrity(source)
    if (sourceIntegrity !== skill.integrity)
      throw new AgentInstallError(`Skill integrity mismatch for ${skill.name}`)
    const destination = join(skillsPath, skill.name)
    const exists = await pathExists(destination)
    const currentIntegrity = exists ? await calculateSkillIntegrity(destination) : undefined
    const kind: AgentInstallOperationKind = !exists ? 'create' : currentIntegrity === skill.integrity ? 'unchanged' : 'update'
    diff.push({ kind, path: destination })
    if (!options.dryRun && kind !== 'unchanged')
      await replaceDirectory(source, destination, currentIntegrity)
  }

  const configPath = adapter.configPath(home)
  if (options.mcp) {
    const existing = await readFile(configPath, 'utf8').catch((error: NodeJS.ErrnoException) => {
      if (error.code === 'ENOENT')
        return ''
      throw error
    })
    const updated = adapter.mergeMcpConfig(existing)
    const kind: AgentInstallOperationKind = !existing ? 'create' : updated === existing ? 'unchanged' : 'update'
    diff.push({ kind, path: configPath })
    if (!options.dryRun && kind !== 'unchanged')
      await atomicWrite(configPath, updated)
  }

  return {
    changed: diff.some(operation => operation.kind !== 'unchanged'),
    client: options.client,
    configPath,
    diff,
    dryRun: Boolean(options.dryRun),
    mcp: {
      command: 'adv-mcp-server',
      installed: Boolean(options.mcp),
    },
    skills: selected.map(({ integrity, name, revision }) => ({ integrity, name, revision })),
  }
}
