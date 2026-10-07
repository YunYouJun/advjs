import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { execFileSync } from 'node:child_process'
import { basename } from 'node:path'
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server'
import { z } from 'zod'

const WORKSPACE_RESOURCE_URI = 'ui://advjs/workspace.html'

interface ProjectDiagnostic {
  code: string
  severity: 'error' | 'warning'
  message: string
  path?: string
  line?: number
}

interface ProjectLoaderResult {
  root: string
  files: Record<string, string>
  result: {
    diagnostics: ProjectDiagnostic[]
    project: {
      id: string
      chapters: unknown[]
      characters: unknown[]
      scenes: unknown[]
    }
  }
}

interface CheckResult {
  passed: boolean
  scriptCount: number
  characterRefCount: number
  sceneRefCount: number
  issues: Array<{
    type: 'error' | 'warning'
    category: string
    file: string
    message: string
  }>
}

interface RegisterAdvWorkspaceAppOptions {
  cwd: string
  projectLoader: (options: { root: string }) => Promise<ProjectLoaderResult>
  runCheck: (options: { cwd: string }) => Promise<CheckResult>
}

export interface AdvWorkspaceSnapshot {
  project: {
    id: string
    repository: string
    branch: string
    workspace: string
    dirty: boolean
    root: string
    files: string[]
    chapters: number
    characters: number
    scenes: number
  }
  diagnostics: {
    errors: number
    warnings: number
    items: ProjectDiagnostic[]
  }
  command: {
    command: string
    cwd: string
    risk: string
    impact: string
    status: 'awaiting_approval' | 'passed' | 'failed'
  }
  task: {
    title: string
    status: 'ready' | 'passed' | 'failed'
    elapsedMs?: number
    steps: Array<{
      id: string
      label: string
      status: 'complete' | 'ready' | 'queued' | 'failed'
    }>
    logs: string[]
  }
}

function gitText(cwd: string, args: string[]) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  }
  catch {
    return ''
  }
}

function repositoryLabel(cwd: string) {
  const remote = gitText(cwd, ['config', '--get', 'remote.origin.url'])
  const match = remote.match(/github\.com[/:]([^/]+\/[^/.]+)(?:\.git)?$/u)
  return match?.[1] || basename(cwd)
}

function summarizeSnapshot(snapshot: AdvWorkspaceSnapshot) {
  const diagnostics = `${snapshot.diagnostics.errors} error(s), ${snapshot.diagnostics.warnings} warning(s)`
  const task = snapshot.task.status === 'ready'
    ? 'Validation is waiting for explicit approval.'
    : `Validation ${snapshot.task.status} in ${snapshot.task.elapsedMs ?? 0}ms.`
  return [
    `ADV.JS project ${snapshot.project.id} (${snapshot.project.repository})`,
    `Branch: ${snapshot.project.branch}; workspace: ${snapshot.project.workspace}`,
    `Content: ${snapshot.project.chapters} chapters, ${snapshot.project.characters} characters, ${snapshot.project.scenes} scenes`,
    `Diagnostics: ${diagnostics}`,
    `Command: ${snapshot.command.command} (${snapshot.command.risk})`,
    task,
  ].join('\n')
}

async function createSnapshot(
  options: RegisterAdvWorkspaceAppOptions,
  check?: CheckResult,
  elapsedMs?: number,
): Promise<AdvWorkspaceSnapshot> {
  const loaded = await options.projectLoader({ root: options.cwd })
  const project = loaded.result.project
  const errors = loaded.result.diagnostics.filter(item => item.severity === 'error').length
  const warnings = loaded.result.diagnostics.filter(item => item.severity === 'warning').length
  const branch = gitText(options.cwd, ['branch', '--show-current']) || 'detached'
  const dirty = Boolean(gitText(options.cwd, ['status', '--porcelain']))
  const status = check ? (check.passed ? 'passed' : 'failed') : 'ready'
  const validationStatus = check ? (check.passed ? 'passed' : 'failed') : 'awaiting_approval'
  const logs = check
    ? check.passed
      ? [
          `${check.scriptCount} scripts checked`,
          `${check.characterRefCount} character references resolved`,
          `${check.sceneRefCount} scene references resolved`,
          'All checks passed',
        ]
      : check.issues.slice(0, 8).map(issue => `${issue.type.toUpperCase()} [${issue.category}] ${issue.file}: ${issue.message}`)
    : [
        'Project metadata loaded',
        'Validation command prepared',
        'Waiting for user approval',
      ]

  return {
    project: {
      id: project.id,
      repository: repositoryLabel(options.cwd),
      branch,
      workspace: 'Local workspace',
      dirty,
      root: loaded.root,
      files: Object.keys(loaded.files).slice(0, 10),
      chapters: project.chapters.length,
      characters: project.characters.length,
      scenes: project.scenes.length,
    },
    diagnostics: {
      errors,
      warnings,
      items: loaded.result.diagnostics.slice(0, 6),
    },
    command: {
      command: 'pnpm adv check',
      cwd: options.cwd,
      risk: 'Read-only validation',
      impact: 'Reads project files and reports diagnostics. No files are modified.',
      status: validationStatus,
    },
    task: {
      title: 'Validate ADV.JS project',
      status,
      elapsedMs,
      steps: [
        { id: 'inspect', label: 'Inspect project', status: 'complete' },
        { id: 'prepare', label: 'Prepare command', status: 'complete' },
        { id: 'validate', label: 'Run adv check', status: check ? (check.passed ? 'complete' : 'failed') : 'ready' },
        { id: 'report', label: 'Report diagnostics', status: check ? 'complete' : 'queued' },
      ],
      logs,
    },
  }
}

const workspaceOutputSchema = {
  project: z.object({
    id: z.string(),
    repository: z.string(),
    branch: z.string(),
    workspace: z.string(),
    dirty: z.boolean(),
    root: z.string(),
    files: z.array(z.string()),
    chapters: z.number(),
    characters: z.number(),
    scenes: z.number(),
  }),
  diagnostics: z.object({
    errors: z.number(),
    warnings: z.number(),
    items: z.array(z.object({
      code: z.string(),
      severity: z.enum(['error', 'warning']),
      message: z.string(),
      path: z.string().optional(),
      line: z.number().optional(),
    })),
  }),
  command: z.object({
    command: z.string(),
    cwd: z.string(),
    risk: z.string(),
    impact: z.string(),
    status: z.enum(['awaiting_approval', 'passed', 'failed']),
  }),
  task: z.object({
    title: z.string(),
    status: z.enum(['ready', 'passed', 'failed']),
    elapsedMs: z.number().optional(),
    steps: z.array(z.object({
      id: z.string(),
      label: z.string(),
      status: z.enum(['complete', 'ready', 'queued', 'failed']),
    })),
    logs: z.array(z.string()),
  }),
}

function workspaceResult(snapshot: AdvWorkspaceSnapshot): CallToolResult {
  return {
    content: [{ type: 'text' as const, text: summarizeSnapshot(snapshot) }],
    structuredContent: { ...snapshot },
  }
}

export function registerAdvWorkspaceApp(server: McpServer, options: RegisterAdvWorkspaceAppOptions) {
  registerAppResource(
    server,
    'ADV.JS project workspace',
    WORKSPACE_RESOURCE_URI,
    {
      description: 'Interactive ADV.JS project context, command approval, and validation status panel',
      _meta: { ui: { prefersBorder: true } },
    },
    async () => ({
      contents: [{
        uri: WORKSPACE_RESOURCE_URI,
        mimeType: RESOURCE_MIME_TYPE,
        // eslint-disable-next-line ts/no-use-before-define
        text: ADV_WORKSPACE_HTML,
        _meta: { ui: { prefersBorder: true } },
      }],
    }),
  )

  registerAppTool(
    server,
    'advjs_show_project_workspace',
    {
      title: 'Show ADV.JS project workspace',
      description: 'Inspect the current ADV.JS project and render an interactive project, command approval, and task-status panel.',
      inputSchema: {},
      outputSchema: workspaceOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { ui: { resourceUri: WORKSPACE_RESOURCE_URI, visibility: ['model', 'app'] } },
    },
    async () => workspaceResult(await createSnapshot(options)),
  )

  registerAppTool(
    server,
    'advjs_run_project_check',
    {
      title: 'Run ADV.JS project check',
      description: 'Run the read-only ADV.JS project validator after the user approves the exact command shown in the workspace panel.',
      inputSchema: {},
      outputSchema: workspaceOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      _meta: { ui: { resourceUri: WORKSPACE_RESOURCE_URI, visibility: ['model', 'app'] } },
    },
    async () => {
      const startedAt = Date.now()
      const check = await options.runCheck({ cwd: options.cwd })
      return workspaceResult(await createSnapshot(options, check, Date.now() - startedAt))
    },
  )
}

// Preserve JavaScript string escapes inside the HTML resource.
export const ADV_WORKSPACE_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    :root { color-scheme: dark; font-family: var(--font-sans, Helvetica, Arial, sans-serif); background:#1a1a1a; color:rgba(255,255,255,.82); }
    * { box-sizing:border-box; }
    body { margin:0; padding:10px; background:#1a1a1a; font-size:12px; }
    button { font:inherit; }
    .shell { display:grid; gap:8px; max-width:760px; margin:0 auto; }
    .topbar,.card { border:1px solid rgba(255,255,255,.12); background:#303238; border-radius:6px; overflow:hidden; }
    .topbar { display:flex; align-items:center; justify-content:space-between; padding:8px 10px; background:#242424; }
    .title,.row,.actions,.badge-row,.stats { display:flex; align-items:center; }
    .title,.row,.badge-row { gap:7px; }
    .title strong { font-size:12px; }
    .connected { color:#67d391; font-size:10px; }
    .card-header { display:flex; align-items:center; justify-content:space-between; gap:8px; padding:7px 9px; border-bottom:1px solid rgba(255,255,255,.1); background:#383838; }
    .card-body { padding:10px; }
    .badge { padding:2px 5px; border:1px solid rgba(59,142,237,.55); border-radius:2px; background:#4772b3; color:white; font-size:9px; font-weight:700; }
    .origin,.muted,.label { color:rgba(235,235,235,.42); font-size:10px; }
    .project-grid { display:grid; grid-template-columns:minmax(0,1fr) 190px; gap:10px; margin-top:9px; }
    .repo { font-weight:700; }
    code,.files,.logs { font-family:var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace); }
    code { color:rgba(255,255,255,.68); }
    .files,.logs { margin:0; padding:7px 8px; border:1px solid rgba(255,255,255,.1); border-radius:3px; background:#1a1a1a; font-size:10px; line-height:1.55; }
    .files { list-style:none; max-height:116px; overflow:auto; }
    .files li::before { content:'◇'; margin-right:6px; color:#7ba4d9; }
    .stats { gap:6px; flex-wrap:wrap; margin:8px 0; }
    .stat { padding:3px 6px; border-radius:2px; background:#242424; color:rgba(255,255,255,.62); font-size:10px; }
    .diagnostics { display:grid; gap:5px; margin-top:8px; }
    .diagnostic { padding:5px 7px; border-left:2px solid #d4a94e; background:#242424; font-size:10px; }
    .ok { color:#67d391; } .warn { color:#e3b75c; } .error { color:#ef7777; }
    .approval { border-color:rgba(227,183,92,.55); }
    .risk { margin-bottom:8px; color:#e3b75c; font-weight:700; font-size:10px; }
    .command-grid { display:grid; grid-template-columns:62px minmax(0,1fr); gap:6px; align-items:center; }
    .command { padding:6px 8px; border-radius:3px; background:#1a1a1a; color:white; overflow:auto; }
    .impact { margin:8px 0 0; color:rgba(255,255,255,.52); font-size:10px; }
    .actions { justify-content:flex-end; gap:7px; margin-top:10px; }
    .button { border:1px solid rgba(255,255,255,.16); border-radius:2px; background:transparent; color:rgba(255,255,255,.68); padding:5px 10px; cursor:pointer; }
    .button:hover { background:rgba(255,255,255,.07); }
    .button.primary { border-color:#4772b3; background:#4772b3; color:white; font-weight:700; }
    .button:disabled { opacity:.5; cursor:wait; }
    .progress { height:3px; margin:8px 0 10px; overflow:hidden; background:#1a1a1a; }
    .progress > span { display:block; width:45%; height:100%; background:#3b8eed; transition:width .2s ease; }
    .progress.running > span { width:72%; animation:pulse 1s ease-in-out infinite alternate; }
    .progress.done > span { width:100%; background:#4eb579; }
    .progress.failed > span { width:100%; background:#c65a5a; }
    .steps { display:grid; grid-template-columns:1fr 1fr; gap:6px 12px; margin:0; padding:0; list-style:none; }
    .step { display:flex; align-items:center; gap:6px; min-width:0; color:rgba(255,255,255,.55); font-size:10px; }
    .step::before { content:'○'; color:rgba(255,255,255,.35); }
    .step.complete::before { content:'✓'; color:#67d391; }
    .step.ready::before { content:'●'; color:#3b8eed; }
    .step.failed::before { content:'!'; color:#ef7777; }
    .logs { min-height:62px; max-height:110px; margin-top:10px; overflow:auto; color:rgba(255,255,255,.52); white-space:pre-wrap; }
    .statusline { display:flex; justify-content:space-between; gap:8px; margin-top:8px; color:rgba(255,255,255,.4); font-size:9px; }
    @keyframes pulse { from { opacity:.45 } to { opacity:1 } }
    @media (max-width:560px) { .project-grid { grid-template-columns:1fr; } .steps { grid-template-columns:1fr; } }
  </style>
</head>
<body>
  <main class="shell">
    <header class="topbar"><div class="title"><strong>ADV.JS Studio</strong><span class="badge">MCP UI</span></div><span id="connection-status" class="muted">Connecting…</span></header>
    <section class="card"><div class="card-header"><div class="badge-row"><span class="badge">MCP UI</span><strong>Project context</strong></div><code class="origin">advjs.project</code></div><div class="card-body"><div class="row"><strong class="repo" id="repository">Loading project…</strong><code id="branch"></code><span id="workspace-state" class="connected"></span></div><div class="stats" id="stats"></div><div class="project-grid"><ul class="files" id="files"></ul><div><div class="row"><span class="label">Diagnostics</span><strong id="diagnostic-summary"></strong></div><div class="diagnostics" id="diagnostics"></div><button class="button" id="refresh-button" disabled>Refresh context</button></div></div></div></section>
    <section class="card approval"><div class="card-header"><div class="badge-row"><span class="badge">MCP UI</span><strong>Command approval required</strong></div><code class="origin">codex.command</code></div><div class="card-body"><div class="risk">◇ <span id="risk">Read-only validation</span></div><div class="command-grid"><span class="label">Command</span><code class="command" id="command"></code><span class="label">cwd</span><code id="cwd"></code></div><p class="impact" id="impact"></p><div class="actions"><button class="button" id="cancel-button">Cancel</button><button class="button primary" id="run-button" disabled>Run command</button></div></div></section>
    <section class="card"><div class="card-header"><div class="badge-row"><span class="badge">MCP UI</span><strong id="task-title">Task status</strong></div><code class="origin">advjs.task</code></div><div class="card-body"><div class="progress" id="progress"><span></span></div><ul class="steps" id="steps"></ul><pre class="logs" id="logs">Waiting for tool result…</pre><div class="statusline"><span id="task-status">Ready</span><span id="elapsed"></span></div></div></section>
  </main>
  <script type="module">
    let rpcId = 0;
    const pending = new Map();
    const $ = (id) => document.getElementById(id);
    const notify = (method, params={}) => window.parent.postMessage({ jsonrpc:'2.0', method, params }, '*');
    const request = (method, params={}) => new Promise((resolve,reject) => {
      const id=++rpcId;
      const timeout=setTimeout(()=>{ pending.delete(id); reject(new Error('Host did not respond to '+method)); }, method==='tools/call'?120000:10000);
      pending.set(id,{resolve,reject,timeout});
      window.parent.postMessage({jsonrpc:'2.0',id,method,params},'*');
    });
    const escapeText = (value) => value == null ? '' : String(value);
    let connected = false;
    let latest;
    function resize() { notify('ui/notifications/size-changed', { width:document.documentElement.scrollWidth, height:document.documentElement.scrollHeight }); }
    function render(data) {
      if (!data?.project) return;
      latest = data;
      $('repository').textContent = data.project.repository;
      $('branch').textContent = data.project.branch;
      $('workspace-state').textContent = data.project.dirty ? 'Modified' : 'Clean';
      $('workspace-state').className = data.project.dirty ? 'warn' : 'connected';
      $('stats').replaceChildren(...[['Chapters',data.project.chapters],['Characters',data.project.characters],['Scenes',data.project.scenes]].map(([label,value]) => { const el=document.createElement('span'); el.className='stat'; el.textContent=label+': '+value; return el; }));
      $('files').replaceChildren(...data.project.files.map(file => { const li=document.createElement('li'); li.textContent=file; return li; }));
      $('diagnostic-summary').textContent = data.diagnostics.errors+' errors · '+data.diagnostics.warnings+' warnings';
      $('diagnostic-summary').className = data.diagnostics.errors ? 'error' : data.diagnostics.warnings ? 'warn' : 'ok';
      $('diagnostics').replaceChildren(...data.diagnostics.items.slice(0,3).map(item => { const el=document.createElement('div'); el.className='diagnostic'; el.textContent=item.code+' · '+(item.path||'project')+' · '+item.message; return el; }));
      if (!data.diagnostics.items.length) { const el=document.createElement('div'); el.className='ok'; el.textContent='No compiler diagnostics'; $('diagnostics').replaceChildren(el); }
      $('risk').textContent=data.command.risk; $('command').textContent=data.command.command; $('cwd').textContent=data.command.cwd; $('impact').textContent=data.command.impact;
      $('task-title').textContent=data.task.title;
      $('steps').replaceChildren(...data.task.steps.map(step => { const li=document.createElement('li'); li.className='step '+step.status; li.textContent=step.label+' · '+step.status; return li; }));
      $('logs').textContent=data.task.logs.map(escapeText).join('\n');
      $('task-status').textContent=data.task.status;
      $('elapsed').textContent=data.task.elapsedMs == null ? '' : data.task.elapsedMs+'ms';
      $('progress').className='progress '+(data.task.status==='ready'?'':data.task.status==='passed'?'done':'failed');
      $('run-button').disabled=!connected||data.command.status!=='awaiting_approval';
      $('run-button').textContent=data.command.status==='passed'?'Completed':data.command.status==='failed'?'Check failed':'Run command';
      queueMicrotask(resize);
    }
    async function callTool(name) { const response=await request('tools/call',{name,arguments:{}}); render(response?.structuredContent); return response; }
    window.addEventListener('message',(event)=>{ if(event.source!==window.parent)return; const message=event.data; if(!message||message.jsonrpc!=='2.0')return; if(message.id!=null){const p=pending.get(message.id);if(!p)return;pending.delete(message.id);clearTimeout(p.timeout);message.error?p.reject(message.error):p.resolve(message.result);return;} if(message.method==='ui/notifications/tool-result')render(message.params?.structuredContent); });
    const bridgeReady=request('ui/initialize',{appInfo:{name:'advjs-workspace',version:'0.1.0'},appCapabilities:{},protocolVersion:'2026-01-26'}).then(()=>{
      notify('ui/notifications/initialized',{});
      connected=true;
      $('connection-status').textContent='● Connected';
      $('connection-status').className='connected';
      $('refresh-button').disabled=false;
      if(latest)render(latest);
      resize();
    }).catch(error=>{
      $('connection-status').textContent='Connection failed';
      $('connection-status').className='error';
      $('logs').textContent='Could not initialize the host bridge: '+escapeText(error?.message||error);
      resize();
    });
    $('run-button').addEventListener('click',async()=>{ await bridgeReady; $('run-button').disabled=true; $('run-button').textContent='Running…'; $('progress').className='progress running'; $('task-status').textContent='running'; $('logs').textContent='$ pnpm adv check\nValidating project…'; try{await callTool('advjs_run_project_check');}catch(error){$('logs').textContent='Check failed: '+escapeText(error?.message||error);$('run-button').disabled=false;$('run-button').textContent='Retry';} });
    $('refresh-button').addEventListener('click',async()=>{
      await bridgeReady;
      try{await callTool('advjs_show_project_workspace');}
      catch(error){$('logs').textContent='Refresh failed: '+escapeText(error?.message||error);resize();}
    });
    $('cancel-button').addEventListener('click',()=>{ $('task-status').textContent='Approval cancelled'; $('run-button').disabled=true; $('logs').textContent='Command was not run.'; resize(); });
    resize();
  </script>
</body>
</html>`
