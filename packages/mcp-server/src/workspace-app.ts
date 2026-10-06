import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { WorkspaceContentSource } from './workspace-content'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import process from 'node:process'
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server'
import { basename } from 'pathe'
import { z } from 'zod'
import { readWorkspaceItem, workspaceContentIndex, workspaceContentSchema, workspaceItemKindSchema } from './workspace-content'
import { ADV_WORKSPACE_HTML } from './workspace-html'

const RESOURCE_URI = 'ui://advjs/workspace.html'
const diagnosticSchema = z.object({
  code: z.string(),
  severity: z.enum(['error', 'warning']),
  message: z.string(),
  path: z.string().optional(),
  line: z.number().optional(),
})
type Diagnostic = z.infer<typeof diagnosticSchema>

interface CheckResult {
  passed: boolean
  scriptCount: number
  characterRefCount: number
  sceneRefCount: number
  issues: { type: 'error' | 'warning', category: string, file: string, message: string, code?: string, line?: number }[]
}

interface WorkspaceOptions {
  cwd: string
  projectLoader: (options: { root: string }) => Promise<WorkspaceContentSource & {
    root: string
    files: Record<string, string>
    result: {
      diagnostics: Diagnostic[]
    }
  }>
  runCheck: (options: { cwd: string }) => Promise<CheckResult>
}

const outputSchema = {
  content: workspaceContentSchema.optional(),
  project: z.object({
    id: z.string(),
    repository: z.string(),
    branch: z.string(),
    dirty: z.boolean(),
    root: z.string(),
    files: z.array(z.string()),
    chapters: z.number(),
    characters: z.number(),
    scenes: z.number(),
  }),
  diagnostics: z.object({ errors: z.number(), warnings: z.number(), items: z.array(diagnosticSchema) }),
  command: z.object({ command: z.string(), cwd: z.string(), risk: z.string(), impact: z.string() }),
  validation: z.object({
    status: z.enum(['not_run', 'passed', 'failed']),
    checkedAt: z.string().optional(),
    elapsedMs: z.number().optional(),
    scriptCount: z.number().optional(),
    characterRefCount: z.number().optional(),
    sceneRefCount: z.number().optional(),
    issues: z.array(diagnosticSchema),
  }),
}

/** Machine-readable project context and the result of the latest explicit check. */
export type AdvWorkspaceSnapshot = z.infer<z.ZodObject<typeof outputSchema>>

function gitText(cwd: string, args: string[]): string {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 3000 }).trim()
  }
  catch {
    return ''
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll('\'', '\'\\\'\'')}'`
}

function summarize(snapshot: AdvWorkspaceSnapshot, locale: string): string {
  const { project: p, diagnostics: d, validation: v, command: c } = snapshot
  const zh = locale.toLowerCase().startsWith('zh')
  const lines = zh
    ? [`ADV.JS 项目：${p.id}`, `目录：${p.root}`, `内容：${p.chapters} 章节，${p.characters} 人物，${p.scenes} 场景`, `项目读取：${d.errors} 个错误，${d.warnings} 个警告`, `校验：${({ not_run: '尚未运行', passed: '通过', failed: '未通过' })[v.status]}`]
    : [`ADV.JS project: ${p.id}`, `Directory: ${p.root}`, `Content: ${p.chapters} chapters, ${p.characters} characters, ${p.scenes} scenes`, `Project loading: ${d.errors} errors, ${d.warnings} warnings`, `Validation: ${v.status === 'not_run' ? 'Not run' : v.status}`]
  if (v.checkedAt)
    lines.push(`${zh ? '上次校验' : 'Last checked'}: ${v.checkedAt}`)
  for (const item of [...d.items, ...v.issues])
    lines.push(`[${item.severity}] ${item.code} ${item.path ?? ''}${item.line ? `:${item.line}` : ''}: ${item.message}`)
  lines.push(`${zh ? '校验命令' : 'Validation command'}: ${c.command}`, `cwd: ${c.cwd}`, `${c.risk}: ${c.impact}`)
  return lines.join('\n')
}

/** Register the bilingual, read-only MCP Apps workspace and project check tools. */
export function registerAdvWorkspaceApp(server: McpServer, options: WorkspaceOptions): void {
  // Match the installed CLI, without depending on a project's package scripts.
  const require = createRequire(import.meta.url)
  const command = `${shellQuote(process.execPath)} ${shellQuote(require.resolve('advjs/bin/adv.mjs'))} check --json`
  let validation: AdvWorkspaceSnapshot['validation'] = { status: 'not_run', issues: [] }
  let inFlight: Promise<void> | undefined

  async function snapshot(locale: string): Promise<AdvWorkspaceSnapshot> {
    const loaded = await options.projectLoader({ root: options.cwd })
    const p = loaded.result.project
    const items = loaded.result.diagnostics
    const remote = gitText(options.cwd, ['config', '--get', 'remote.origin.url'])
    const repository = remote.match(/github\.com[/:]([^/]+\/[^/]+?)(?:\.git)?$/u)?.[1] || basename(options.cwd)
    const branch = gitText(options.cwd, ['branch', '--show-current']) || gitText(options.cwd, ['rev-parse', '--short', 'HEAD'])
    const zh = locale.toLowerCase().startsWith('zh')
    return {
      project: {
        id: p.id,
        repository,
        branch,
        dirty: Boolean(gitText(options.cwd, ['status', '--porcelain'])),
        root: options.cwd,
        files: Object.keys(loaded.files),
        chapters: p.chapters.length,
        characters: p.characters.length,
        scenes: p.scenes.length,
      },
      diagnostics: { errors: items.filter(i => i.severity === 'error').length, warnings: items.filter(i => i.severity === 'warning').length, items },
      command: {
        command,
        cwd: options.cwd,
        risk: zh ? '只读校验' : 'Read-only validation',
        impact: zh ? '读取项目文件并报告问题，不修改文件。' : 'Reads project files and reports issues. No files are modified.',
      },
      validation,
      content: workspaceContentIndex(loaded),
    }
  }

  async function result(locale: string) {
    const data = await snapshot(locale)
    return { content: [{ type: 'text' as const, text: summarize(data, locale) }], structuredContent: data }
  }

  registerAppResource(server, 'ADV.JS workspace', RESOURCE_URI, {
    description: 'Compact project summary with Chinese/English controls and explicit validation',
    _meta: { ui: { prefersBorder: true } },
  }, async () => ({ contents: [{ uri: RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: ADV_WORKSPACE_HTML, _meta: { ui: { prefersBorder: true } } }] }))

  const shared = {
    inputSchema: { locale: z.string().optional().describe('Language for the text summary, e.g. zh-CN or en. Match the user language.') },
    outputSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    _meta: { ui: { resourceUri: RESOURCE_URI, visibility: ['model', 'app'] as ('model' | 'app')[] } },
  }
  registerAppTool(server, 'advjs_show_project_workspace', {
    ...shared,
    title: 'ADV.JS 项目 / Project',
    description: 'Show project identity, content counts and loading diagnostics. Does not run validation. Supply locale to match the user language.',
  }, async ({ locale = 'en' }) => result(locale))

  registerAppTool(server, 'advjs_read_workspace_item', {
    title: '查看创作资料 / Read authoring item',
    description: 'Read a character card, chapter or scene from the compiled project. Returns bounded local image previews only to the app.',
    inputSchema: { kind: workspaceItemKindSchema, id: z.string().min(1) },
    annotations: shared.annotations,
    _meta: { ui: { visibility: ['app'] as ('model' | 'app')[] } },
  }, async ({ kind, id }) => {
    try {
      const loaded = await options.projectLoader({ root: options.cwd })
      return await readWorkspaceItem(loaded, options.cwd, kind, id)
    }
    catch (error) {
      return { isError: true, content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }] }
    }
  })

  registerAppTool(server, 'advjs_run_project_check', {
    ...shared,
    title: '校验 ADV.JS 项目 / Check project',
    description: 'Run the read-only validator only when requested or approved by the user. The workspace tool shows the exact command and working directory.',
  }, async ({ locale = 'en' }) => {
    // Coalesce clicks from multiple panels without starting duplicate validators.
    if (!inFlight) {
      inFlight = (async () => {
        const start = Date.now()
        const check = await options.runCheck({ cwd: options.cwd })
        validation = {
          status: check.passed ? 'passed' : 'failed',
          checkedAt: new Date().toISOString(),
          elapsedMs: Date.now() - start,
          scriptCount: check.scriptCount,
          characterRefCount: check.characterRefCount,
          sceneRefCount: check.sceneRefCount,
          issues: check.issues.map(i => ({ severity: i.type, code: i.code ?? i.category, path: i.file, message: i.message, line: i.line })),
        }
      })()
    }
    try {
      await inFlight
      return await result(locale)
    }
    finally {
      inFlight = undefined
    }
  })
}
