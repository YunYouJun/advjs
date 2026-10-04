/** Self-contained MCP App: no network assets or project HTML execution. */
export const ADV_WORKSPACE_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>ADV.JS Studio</title>
  <style>
    :root { color-scheme:light dark; --bg:#fff; --text:#202329; --muted:#626a75; --line:#e3e7ec; --accent:#226cba; --soft:#f5f7fa; --error:#b52d38; --warn:#8b5c10; font-family:var(--font-sans,system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif); }
    :root[data-theme="dark"] { color-scheme:dark; --bg:#202124; --text:#e8eaed; --muted:#a7b0be; --line:#41454c; --accent:#8cbcff; --soft:#2b2e33; --error:#ff9ba3; --warn:#edc778; }
    :root[data-theme="light"] { color-scheme:light; }
    @media(prefers-color-scheme:dark) { :root:not([data-theme]) { --bg:#202124; --text:#e8eaed; --muted:#a7b0be; --line:#41454c; --accent:#8cbcff; --soft:#2b2e33; --error:#ff9ba3; --warn:#edc778; } }
    * { box-sizing:border-box; }
    body { margin:0; padding:18px; color:var(--text); background:var(--bg); font-size:13px; line-height:1.6; }
    main { max-width:720px; margin:auto; }
    header,.actions,.project-meta { display:flex; align-items:center; flex-wrap:wrap; gap:10px; }
    header { justify-content:space-between; padding-bottom:15px; border-bottom:1px solid var(--line); }
    header strong { font-size:14px; }
    h1 { margin:16px 0 2px; font-size:21px; line-height:1.4; overflow-wrap:anywhere; }
    p { margin:6px 0; }
    button,select { font:inherit; color:inherit; border:1px solid var(--line); border-radius:6px; background:var(--bg); padding:5px 10px; }
    button { min-height:34px; cursor:pointer; }
    select { max-width:160px; }
    button:hover,select:hover { background:var(--soft); }
    button:focus-visible,select:focus-visible,summary:focus-visible { outline:2px solid var(--accent); outline-offset:3px; }
    button:disabled { opacity:.5; cursor:default; }
    .primary { color:var(--accent); border-color:var(--accent); font-weight:600; }
    .muted { color:var(--muted); }
    .error { color:var(--error); }
    .warning { color:var(--warn); }
    .project-meta { font-size:12px; gap:8px 16px; color:var(--muted); }
    .project-meta span:empty { display:none; }
    code { font-family:var(--font-mono,ui-monospace,SFMono-Regular,Consolas,monospace); font-size:11px; overflow-wrap:anywhere; white-space:pre-wrap; }
    #root { display:block; color:var(--muted); margin:5px 0 16px; }
    #stats { display:flex; flex-wrap:wrap; gap:8px 24px; margin:0 0 16px; }
    #stats span { white-space:nowrap; }
    #stats b { font-size:17px; font-weight:600; margin-right:6px; }
    .section { border-top:1px solid var(--line); padding:12px 0; }
    .section-title { font-weight:600; }
    ul { padding:0; margin:8px 0 0; list-style:none; }
    #files { max-height:180px; overflow:auto; }
    li { overflow-wrap:anywhere; }
    .issue { border-left:2px solid var(--line); padding:5px 0 5px 10px; margin:8px 0; }
    .issue.error { border-color:var(--error); }
    .issue.warning { border-color:var(--warn); }
    .issue p { color:var(--text); margin:2px 0; }
    summary { cursor:pointer; color:var(--muted); width:fit-content; }
    details { margin-top:8px; }
    details p { margin-top:8px; }
    #command { display:block; background:var(--soft); border-radius:4px; padding:8px; margin-top:8px; }
    .actions { padding-top:12px; }
    #error { padding:10px 0 0; }
    [hidden] { display:none!important; }
    @media(max-width:360px) { body { padding:12px; } #stats { gap:8px 16px; } header { gap:8px; } }
  </style>
</head>
<body>
<main>
  <header><strong>ADV.JS Studio</strong><select id="language" aria-label="Language / 语言"><option value="auto">Follow host</option><option value="zh-CN">中文</option><option value="en">English</option></select></header>
  <p id="loading" class="muted" role="status">Loading project…</p>
  <p id="error" class="error" role="alert" hidden></p>
  <div id="project" hidden>
    <h1 id="name"></h1>
    <div class="project-meta"><span id="repository"></span><span id="branch"></span><span id="dirty" class="warning"></span></div>
    <code id="root"></code>
    <div id="stats"></div>
    <section class="section">
      <div id="diagnostic-summary"></div>
      <ul id="diagnostics"></ul>
      <details><summary id="files-label"></summary><ul id="files"></ul></details>
    </section>
    <section class="section">
      <div id="validation-status" class="section-title" role="status"></div>
      <p id="validation-meta" class="muted"></p>
      <ul id="validation-issues"></ul>
      <details><summary id="command-label"></summary><code id="command"></code><p id="impact" class="muted"></p><p><span id="cwd-label"></span><code id="cwd"></code></p></details>
    </section>
  </div>
  <div class="actions"><button id="run" class="primary" disabled></button><button id="refresh" disabled></button></div>
</main>
<script type="module">
const messages = {
  'zh-CN': {
    auto:'跟随宿主', language:'界面语言', loading:'正在读取项目…', connecting:'正在连接…', refresh:'刷新', retry:'重新连接', run:'校验项目', running:'正在校验…',
    chapters:'章节', characters:'人物', scenes:'场景', branch:'分支：', dirty:'有未提交的更改', files:'项目文件',
    loadOK:'项目读取正常', errors:'个错误', warnings:'个警告', loadIssues:'项目读取',
    not_run:'尚未运行校验', passed:'上次校验通过', failed:'上次校验未通过', scripts:'个脚本', characterRefs:'处人物引用', sceneRefs:'处场景引用',
    command:'查看校验命令', impact:'只读操作：读取项目文件并报告问题，不修改文件。', cwd:'工作目录：',
    checked:'上次运行：', noCheck:'点击“校验项目”检查剧本及资源引用。', error:'操作未完成：', timeout:'宿主未响应，请重试。', invalid:'未收到有效的项目数据。',
  },
  en: {
    auto:'Follow host', language:'Interface language', loading:'Loading project…', connecting:'Connecting…', refresh:'Refresh', retry:'Reconnect', run:'Check project', running:'Checking…',
    chapters:'chapters', characters:'characters', scenes:'scenes', chapter:'chapter', character:'character', scene:'scene', branch:'Branch: ', dirty:'Uncommitted changes', files:'Project files',
    loadOK:'Project loaded without issues', errors:'errors', warnings:'warnings', loadIssues:'Project loading',
    not_run:'Validation not run', passed:'Last check passed', failed:'Last check failed', scripts:'scripts', characterRefs:'character references', sceneRefs:'scene references',
    command:'View validation command', impact:'Read-only: reads project files and reports issues. No files are modified.', cwd:'Working directory: ',
    checked:'Last run: ', noCheck:'Check scripts and asset references with “Check project”.', error:'Could not complete: ', timeout:'Host did not respond. Please retry.', invalid:'No valid project data was returned.',
  },
};
const $ = id => document.getElementById(id);
const storageKey = 'advjs-workspace-locale';
let preference = 'auto';
try { const saved = localStorage.getItem(storageKey); if (['auto','zh-CN','en'].includes(saved)) preference = saved; } catch {}
$('language').value = preference;
let hostLocale, latest, busy = '', connected = false, lastError;
const browserLocale = navigator.languages?.[0] || navigator.language || 'en';
const locale = () => preference === 'auto' ? (/^zh(?:-|_|$)/i.test(hostLocale || browserLocale) ? 'zh-CN' : 'en') : preference;
const t = key => messages[locale()][key];
const pending = new Map();
let rpcId = 0;
const notify = (method, params = {}) => window.parent.postMessage({jsonrpc:'2.0',method,params}, '*');
function request(method, params = {}) {
  return new Promise((resolve,reject) => {
    const id = ++rpcId;
    const timeout = setTimeout(() => { pending.delete(id); reject({key:'timeout'}); }, method === 'tools/call' ? 120000 : 10000);
    pending.set(id,{resolve,reject,timeout});
    window.parent.postMessage({jsonrpc:'2.0',id,method,params}, '*');
  });
}
let lastHeight = 0;
function resize() {
  const height = Math.ceil(document.body.getBoundingClientRect().height);
  if (height !== lastHeight) { lastHeight = height; notify('ui/notifications/size-changed',{height}); }
}
function text(id, value) { $(id).textContent = value; }
function issues(id, items) {
  $(id).replaceChildren(...items.map(item => {
    const li = document.createElement('li'); li.className = 'issue ' + item.severity;
    const label = document.createElement('code'); label.textContent = [item.code,item.path && item.path + (item.line ? ':' + item.line : '')].filter(Boolean).join(' · ');
    const description = document.createElement('p'); description.textContent = item.message;
    li.append(label,description); return li;
  }));
}
function render() {
  document.documentElement.lang = locale();
  $('language').setAttribute('aria-label',t('language'));
  $('language').options[0].textContent = t('auto');
  text('run',t(busy === 'check' ? 'running' : 'run'));
  text('refresh',t(!connected && !busy ? 'retry' : busy === 'connect' ? 'connecting' : 'refresh'));
  $('run').disabled = !connected || !latest || Boolean(busy);
  $('refresh').disabled = Boolean(busy);
  $('loading').hidden = Boolean(latest) || Boolean(lastError);
  text('loading',t('loading'));
  $('error').hidden = !lastError;
  text('error',lastError ? t('error') + (lastError.key ? t(lastError.key) : lastError.message || String(lastError)) : '');
  $('project').hidden = !latest;
  if (latest) {
    const {project:p,diagnostics:d,validation:v,command:c} = latest;
    text('name',p.id); text('repository',p.repository === p.id ? '' : p.repository);
    text('branch',p.branch ? t('branch') + p.branch : ''); text('dirty',p.dirty ? t('dirty') : ''); text('root',p.root);
    $('stats').replaceChildren(...['chapters','characters','scenes'].map(key => { const el = document.createElement('span'); const count = document.createElement('b'); count.textContent = p[key]; el.append(count,t(locale() === 'en' && p[key] === 1 ? key.slice(0,-1) : key)); return el; }));
    text('diagnostic-summary',d.items.length ? t('loadIssues') + ': ' + d.errors + ' ' + t('errors') + ' / ' + d.warnings + ' ' + t('warnings') : t('loadOK'));
    issues('diagnostics',d.items);
    text('files-label',t('files') + ' (' + p.files.length + ')');
    $('files').replaceChildren(...p.files.map(file => { const li = document.createElement('li'); const code = document.createElement('code'); code.textContent = file; li.append(code); return li; }));
    text('validation-status',t(busy === 'check' ? 'running' : v.status));
    $('validation-status').className = 'section-title' + (v.status === 'failed' && busy !== 'check' ? ' error' : '');
    text('validation-meta',v.checkedAt ? t('checked') + new Date(v.checkedAt).toLocaleString(locale()) + ' · ' + v.elapsedMs + ' ms\n' + v.scriptCount + ' ' + t('scripts') + ' / ' + v.characterRefCount + ' ' + t('characterRefs') + ' / ' + v.sceneRefCount + ' ' + t('sceneRefs') : t('noCheck'));
    issues('validation-issues',v.issues);
    text('command-label',t('command')); text('command',c.command); text('impact',t('impact')); text('cwd-label',t('cwd')); text('cwd',c.cwd);
  }
  queueMicrotask(resize);
}
function accept(data) {
  if (!data?.project || !data?.diagnostics || !data?.validation || !data?.command) throw {key:'invalid'};
  latest = data;
}
function hostContext(context) {
  if (typeof context?.locale === 'string') hostLocale = context.locale;
  if (['light','dark'].includes(context?.theme)) document.documentElement.dataset.theme = context.theme;
  render();
}
window.addEventListener('message',event => {
  if (event.source !== window.parent || event.data?.jsonrpc !== '2.0') return;
  const message = event.data;
  if (message.id != null) {
    const p = pending.get(message.id); if (!p) return;
    pending.delete(message.id); clearTimeout(p.timeout);
    message.error ? p.reject(message.error) : p.resolve(message.result);
  } else if (message.method === 'ui/notifications/host-context-changed') hostContext(message.params);
  else if (message.method === 'ui/notifications/tool-result') {
    try { if (message.params?.isError) throw {message:message.params.content?.find(i => i.type === 'text')?.text || t('invalid')}; accept(message.params?.structuredContent); lastError = undefined; }
    catch(error) { lastError = error; }
    render();
  }
});
async function connect() {
  if (busy) return;
  busy = 'connect'; lastError = undefined; render();
  try {
    const response = await request('ui/initialize',{appInfo:{name:'advjs-workspace',version:'0.2.0'},appCapabilities:{},protocolVersion:'2026-01-26'});
    hostContext(response?.hostContext); connected = true; notify('ui/notifications/initialized');
  } catch(error) { connected = false; lastError = error; }
  finally { busy = ''; render(); }
}
async function callTool(action) {
  if (!connected || busy) return;
  busy = action; lastError = undefined; render();
  try {
    const response = await request('tools/call',{name:action === 'check' ? 'advjs_run_project_check' : 'advjs_show_project_workspace',arguments:{locale:locale()}});
    if (response?.isError) throw {message:response.content?.find(i => i.type === 'text')?.text || t('invalid')};
    accept(response?.structuredContent);
  } catch(error) { lastError = error; }
  finally { busy = ''; render(); }
}
$('language').addEventListener('change',() => {
  preference = $('language').value;
  try { localStorage.setItem(storageKey,preference); } catch {}
  render();
});
$('run').addEventListener('click',() => callTool('check'));
$('refresh').addEventListener('click',async () => { if (!connected) await connect(); if (connected) await callTool('refresh'); });
document.querySelectorAll('details').forEach(el => el.addEventListener('toggle',resize));
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(document.body);
connect();
</script>
</body>
</html>`
