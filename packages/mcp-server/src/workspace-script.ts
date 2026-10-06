/** Sandboxed MCP App controller. Project text is rendered without executing HTML. */
export const ADV_WORKSPACE_SCRIPT = String.raw`
const messages = {
 'zh-CN': {
  auto:'跟随宿主',language:'界面语言',loading:'正在读取项目…',connecting:'正在连接…',refresh:'刷新',retry:'重新连接',run:'校验项目',running:'正在校验…',
  overview:'概览',chapters:'章节',characters:'人物',scenes:'场景',branch:'分支：',dirty:'有未提交的更改',files:'项目文件',directory:'项目目录',
  loadOK:'项目读取正常',errors:'个错误',warnings:'个警告',loadIssues:'项目读取',not_run:'尚未运行校验',passed:'上次校验通过',failed:'上次校验未通过',
  scripts:'个脚本',characterRefs:'处人物引用',sceneRefs:'处场景引用',command:'查看校验命令',impact:'只读操作：读取项目文件并报告问题，不修改文件。',cwd:'工作目录：',checked:'上次运行：',
  noCheck:'点击“校验项目”检查剧本及资源引用。',error:'操作未完成：',timeout:'宿主未响应，请重试。',invalid:'未收到有效的项目数据。',search:'搜索名称或 ID',empty:'暂无内容',noMatch:'没有匹配的内容',
  select:'选择内容查看资料',itemLoading:'正在读取资料…',itemRetry:'重新读取',copy:'复制给 AI',copied:'已复制创作资料',manualCopy:'请在下方选择资料并复制。',context:'创作上下文',source:'源文件',
  portraits:'神态头像',references:'视觉参考',version:'造型版本：',fixedTraits:'固定特征',allowedChanges:'允许变化',personality:'性格',appearance:'外貌',background:'背景',speechStyle:'说话风格',description:'场景描述',imagePrompt:'图像提示词',default:'默认',
  missing:'预览未缓存，可运行 assets:pull 后刷新。',unsupported:'此资源暂不支持内嵌预览。',outside_project:'图片不在项目目录内。',too_large:'图片较大，请使用轻量预览。',upgrade:'重新连接新版插件后查看创作资料。',expand:'展开工作台',collapse:'收起工作台',
 },
 en: {
  auto:'Follow host',language:'Interface language',loading:'Loading project…',connecting:'Connecting…',refresh:'Refresh',retry:'Reconnect',run:'Check project',running:'Checking…',
  overview:'Overview',chapters:'Chapters',characters:'Characters',scenes:'Scenes',chapter:'chapter',character:'character',scene:'scene',branch:'Branch: ',dirty:'Uncommitted changes',files:'Project files',directory:'Project directory',
  loadOK:'Project loaded without issues',errors:'errors',warnings:'warnings',loadIssues:'Project loading',not_run:'Validation not run',passed:'Last check passed',failed:'Last check failed',scripts:'scripts',characterRefs:'character references',sceneRefs:'scene references',
  command:'View validation command',impact:'Read-only: reads project files and reports issues. No files are modified.',cwd:'Working directory: ',checked:'Last run: ',noCheck:'Check scripts and asset references with “Check project”.',error:'Could not complete: ',timeout:'Host did not respond. Please retry.',invalid:'No valid project data was returned.',
  search:'Search name or ID',empty:'No content yet',noMatch:'No matching content',select:'Select an item to view its details',itemLoading:'Loading authoring details…',itemRetry:'Read again',copy:'Copy for AI',copied:'Authoring context copied',manualCopy:'Select and copy the context below.',context:'Authoring context',source:'Source files',
  portraits:'Portrait expressions',references:'Visual references',version:'Design version: ',fixedTraits:'Fixed traits',allowedChanges:'Allowed changes',personality:'Personality',appearance:'Appearance',background:'Background',speechStyle:'Speech style',description:'Scene description',imagePrompt:'Image prompt',default:'Default',
  missing:'Preview is not cached. Run assets:pull and refresh.',unsupported:'Embedded preview is unavailable for this resource.',outside_project:'Image is outside the project directory.',too_large:'Image is too large. Use a lightweight preview.',upgrade:'Reconnect the updated plugin to browse authoring details.',expand:'Expand workspace',collapse:'Collapse workspace',
 },
};
const $ = id => document.getElementById(id);
let preference = 'auto';
try { const saved = localStorage.getItem('advjs-workspace-locale'); if (['auto','zh-CN','en'].includes(saved)) preference = saved; } catch {}
$('language').value = preference;
let hostLocale,latest,busy = '',connected = false,lastError,tab = 'overview',selection,detail,detailError,detailLoading = false;
let imageData = {},copyStatus = '',displayMode = 'inline',displayModes = [],generation = 0;
const locale = () => preference === 'auto' ? (/^zh(?:-|_|$)/i.test(hostLocale || navigator.languages?.[0] || navigator.language || 'en') ? 'zh-CN' : 'en') : preference;
const t = key => messages[locale()][key] || key;
const pending = new Map(); let rpcId = 0,lastHeight = 0;
const notify = (method,params = {}) => window.parent.postMessage({jsonrpc:'2.0',method,params},'*');
function request(method,params = {}) {
 return new Promise((resolve,reject) => {
  const id = ++rpcId;
  const timeout = setTimeout(() => { pending.delete(id); reject({key:'timeout'}); },method === 'tools/call' ? 120000 : 10000);
  pending.set(id,{resolve,reject,timeout}); window.parent.postMessage({jsonrpc:'2.0',id,method,params},'*');
 });
}
function resize() { if (!document?.body) return; const height = Math.ceil(document.body.getBoundingClientRect().height); if (height !== lastHeight) { lastHeight = height; notify('ui/notifications/size-changed',{height}); } }
function text(id,value) { $(id).textContent = value; }
function el(tag,value,className) { const node = document.createElement(tag); if (value != null) node.textContent = value; if (className) node.className = className; return node; }
function issues(id,items) {
 $(id).replaceChildren(...items.map(item => {
  const node = el('li',null,'issue ' + item.severity);
  node.append(el('code',[item.code,item.path && item.path + (item.line ? ':' + item.line : '')].filter(Boolean).join(' · ')),el('p',item.message)); return node;
 }));
}
function imageFigure(image) {
 const node = el('figure',null,image.group === 'portrait' ? 'portrait' : 'reference'); const src = imageData[image.key];
 if (image.status === 'ready' && /^data:image\/(?:png|jpeg|webp);base64,/u.test(src || '')) {
  const img = document.createElement('img'); img.src = src; img.alt = detail.title + ' · ' + image.label;
  img.addEventListener('error',() => { img.replaceWith(el('p',t('missing'),'image-note')); resize(); },{once:true}); node.append(img);
 } else node.append(el('p',t(image.status || 'missing'),'image-note'));
 const caption = el('figcaption',image.state === 'default' && image.label === 'default' ? t('default') : image.label);
 if (image.group === 'portrait') caption.append(el('code',image.state)); node.append(caption); return node;
}
function section(container,label,value) {
 if (!value || (Array.isArray(value) && !value.length)) return;
 container.append(el('h3',t(label)));
 if (Array.isArray(value)) { const list = el('ul',null,'traits'); list.append(...value.map(item => el('li',item))); container.append(list); }
 else container.append(el('p',value,'body-text'));
}
function renderDetail() {
 text('item-status',detailLoading ? t('itemLoading') : detailError ? t('error') + (detailError.key ? t(detailError.key) : detailError.message || String(detailError)) : t(latest?.content ? 'select' : 'upgrade'));
 $('item-status').hidden = Boolean(detail) && !detailLoading && !detailError; $('item-retry').hidden = !detailError; text('item-retry',t('itemRetry'));
 $('detail-content').hidden = !detail || detailLoading; if (!detail || detailLoading) return;
 text('detail-title',detail.title); text('detail-paths',detail.paths.join('\n')); text('copy',t('copy')); text('copy-status',copyStatus ? t(copyStatus) : '');
 text('context-label',t('context')); $('context').value = detail.context;
 const body = $('detail-body'),referencesOpen = body.querySelector('[data-references]')?.open || false; body.replaceChildren();
 if (detail.character) {
  const character = detail.character,portraits = detail.images.filter(image => image.group === 'portrait');
  if (portraits.length) { body.append(el('h3',t('portraits') + ' (' + portraits.length + ')')); const images = el('div',null,'portraits'); images.append(...portraits.map(imageFigure)); body.append(images); }
  if (character.visual?.version) body.append(el('p',t('version') + character.visual.version,'muted'));
  const references = detail.images.filter(image => image.group === 'reference');
  if (references.length) { const disclosure = el('details'); disclosure.dataset.references = ''; disclosure.open = referencesOpen; disclosure.append(el('summary',t('references')),...references.map(imageFigure)); disclosure.addEventListener('toggle',resize); body.append(disclosure); }
  section(body,'fixedTraits',character.visual?.fixedTraits); section(body,'allowedChanges',character.visual?.allowedChanges);
  for (const key of ['personality','appearance','background','speechStyle']) section(body,key,character[key]);
  if (character.imagePrompt) { const disclosure = el('details'); disclosure.append(el('summary',t('imagePrompt')),el('p',character.imagePrompt,'body-text')); body.append(disclosure); }
 } else if (detail.scene) { body.append(...detail.images.map(imageFigure)); section(body,'description',detail.scene.description); section(body,'imagePrompt',detail.scene.imagePrompt); }
 const source = $('source'); source.replaceChildren(); for (const file of detail.files) source.append(el('code',file.path),el('pre',file.text));
 text('source-label',t('source')); $('source-details').hidden = !detail.files.length; if (detail.kind === 'chapters') $('source-details').open = true;
}
function renderList() {
 const focus = document.activeElement?.closest('#item-list button')?.dataset.id;
 const query = $('search').value.trim().toLocaleLowerCase(locale()); const entries = latest?.content?.[tab] || [];
 const filtered = entries.filter(item => (item.title + ' ' + item.id).toLocaleLowerCase(locale()).includes(query));
 $('item-list').replaceChildren(...filtered.map(item => { const node = el('li'),button = el('button',item.title); button.dataset.id = item.id; button.title = item.title; button.setAttribute('aria-current',String(selection === item.id)); button.append(el('span',item.id,'item-id')); button.addEventListener('click',() => selectItem(item.id)); node.append(button); return node; }));
 if (focus) [...$('item-list').querySelectorAll('button')].find(button => button.dataset.id === focus)?.focus();
 text('list-empty',t(query ? 'noMatch' : 'empty')); $('list-empty').hidden = Boolean(filtered.length);
}
function render() {
 document.documentElement.lang = locale(); $('language').setAttribute('aria-label',t('language')); $('language').options[0].textContent = t('auto');
 text('run',t(busy === 'check' ? 'running' : 'run')); $('run').disabled = !connected || !latest || Boolean(busy);
 text('refresh',t(!connected && !busy ? 'retry' : busy === 'connect' ? 'connecting' : 'refresh')); $('refresh').disabled = Boolean(busy); $('refresh').title = t('refresh');
 $('expand').hidden = !displayModes.includes('fullscreen'); text('expand',t(displayMode === 'fullscreen' ? 'collapse' : 'expand'));
 $('loading').hidden = Boolean(latest) || Boolean(lastError); text('loading',t('loading')); $('error').hidden = !lastError; text('error',lastError ? t('error') + (lastError.key ? t(lastError.key) : lastError.message || String(lastError)) : ''); $('project').hidden = !latest;
 document.querySelectorAll('[role="tab"]').forEach(button => { button.textContent = t(button.dataset.tab); button.setAttribute('aria-selected',String(tab === button.dataset.tab)); button.tabIndex = tab === button.dataset.tab ? 0 : -1; });
 $('overview').hidden = tab !== 'overview'; $('browser').hidden = tab === 'overview'; $('search').placeholder = t('search'); $('search').setAttribute('aria-label',t('search'));
 if (latest) {
  const {project:p,diagnostics:d,validation:v,command:c} = latest;
  text('name',p.id); text('repository',p.repository === p.id ? '' : p.repository); text('branch',p.branch ? t('branch') + p.branch : ''); text('dirty',p.dirty ? t('dirty') : ''); text('root',p.root); text('directory-label',t('directory'));
  $('stats').replaceChildren(...['chapters','characters','scenes'].map(key => { const node = el('span'); node.append(el('b',p[key]),locale() === 'en' ? (p[key] === 1 ? t(key.slice(0,-1)) : t(key).toLowerCase()) : t(key)); return node; }));
  text('diagnostic-summary',d.items.length ? t('loadIssues') + ': ' + d.errors + ' ' + t('errors') + ' / ' + d.warnings + ' ' + t('warnings') : t('loadOK')); issues('diagnostics',d.items);
  text('files-label',t('files') + ' (' + p.files.length + ')'); $('files').replaceChildren(...p.files.map(file => { const li = el('li'); li.append(el('code',file)); return li; }));
  text('validation-status',t(busy === 'check' ? 'running' : v.status)); $('validation-status').className = 'section-title' + (v.status === 'failed' && busy !== 'check' ? ' error' : '');
  text('validation-meta',v.checkedAt ? t('checked') + new Date(v.checkedAt).toLocaleString(locale()) + (typeof v.elapsedMs === 'number' ? ' · ' + v.elapsedMs + ' ms' : '') + '\n' + v.scriptCount + ' ' + t('scripts') + ' / ' + v.characterRefCount + ' ' + t('characterRefs') + ' / ' + v.sceneRefCount + ' ' + t('sceneRefs') : t('noCheck')); issues('validation-issues',v.issues);
  text('command-label',t('command')); text('command',c.command); text('impact',t('impact')); text('cwd-label',t('cwd')); text('cwd',c.cwd);
 }
 renderList(); renderDetail(); queueMicrotask(resize);
}
function accept(data) {
 if (!data?.project || !data?.diagnostics || !data?.validation || !data?.command) throw {key:'invalid'};
 if (latest && latest.project.root !== data.project.root) { generation++; selection = undefined; detail = undefined; imageData = {}; detailLoading = false; }
 latest = data;
}
function hostContext(context) {
 if (typeof context?.locale === 'string') hostLocale = context.locale;
 if (['light','dark'].includes(context?.theme)) document.documentElement.dataset.theme = context.theme;
 if (context?.displayMode) displayMode = context.displayMode;
 if (Array.isArray(context?.availableDisplayModes)) displayModes = context.availableDisplayModes;
 render();
}
window.addEventListener('message',event => {
 if (event.source !== window.parent || event.data?.jsonrpc !== '2.0') return;
 const message = event.data;
 if (message.id != null) { const operation = pending.get(message.id); if (!operation) return; pending.delete(message.id); clearTimeout(operation.timeout); message.error ? operation.reject(message.error) : operation.resolve(message.result); }
 else if (message.method === 'ui/notifications/host-context-changed') hostContext(message.params);
 else if (message.method === 'ui/notifications/tool-result' && !message.params?.structuredContent?.item) {
  try { if (message.params?.isError) throw {message:message.params.content?.find(item => item.type === 'text')?.text || t('invalid')}; accept(message.params?.structuredContent); lastError = undefined; }
  catch(error) { lastError = error; } render();
 }
});
async function connect() {
 if (busy) return; busy = 'connect'; lastError = undefined; render();
 try { const response = await request('ui/initialize',{appInfo:{name:'advjs-workspace',version:'0.3.0'},appCapabilities:{availableDisplayModes:['inline','fullscreen']},protocolVersion:'2026-01-26'}); hostContext(response?.hostContext); connected = true; notify('ui/notifications/initialized'); }
 catch(error) { connected = false; lastError = error; } finally { busy = ''; render(); }
}
async function selectItem(id) {
 if (!connected || tab === 'overview') return;
 const kind = tab,requestGeneration = ++generation; selection = id; detail = undefined; detailLoading = true; detailError = undefined; copyStatus = ''; imageData = {}; $('source-details').open = kind === 'chapters'; $('context-details').open = false; render();
 try {
  const response = await request('tools/call',{name:'advjs_read_workspace_item',arguments:{kind,id}});
  if (response?.isError) throw {message:response.content?.find(item => item.type === 'text')?.text || t('invalid')};
  if (response?.structuredContent?.item?.id !== id || response.structuredContent.item.kind !== kind || response.structuredContent.item.projectId !== latest.project.id) throw {key:'invalid'};
  if (generation !== requestGeneration) return; detail = response.structuredContent.item; imageData = response._meta?.['advjs/images'] || {};
 } catch(error) { if (generation === requestGeneration) detailError = error; }
 finally { if (generation === requestGeneration) { detailLoading = false; render(); } }
}
function switchTab(value) {
 generation++; tab = value; selection = undefined; detail = undefined; imageData = {}; detailError = undefined; detailLoading = false; $('search').value = ''; render();
 const first = latest?.content?.[tab]?.[0]; if (first) selectItem(first.id);
}
async function callTool(action) {
 if (!connected || busy) return; busy = action; lastError = undefined; render();
 try {
  const response = await request('tools/call',{name:action === 'check' ? 'advjs_run_project_check' : 'advjs_show_project_workspace',arguments:{locale:locale()}});
  if (response?.isError) throw {message:response.content?.find(item => item.type === 'text')?.text || t('invalid')}; accept(response?.structuredContent);
  if (tab !== 'overview') { const entries = latest.content?.[tab] || [],id = entries.some(item => item.id === selection) ? selection : entries[0]?.id; if (id) await selectItem(id); else { generation++; selection = undefined; detail = undefined; detailLoading = false; } }
 } catch(error) { lastError = error; } finally { busy = ''; render(); }
}
$('language').addEventListener('change',() => { preference = $('language').value; try { localStorage.setItem('advjs-workspace-locale',preference); } catch {} render(); });
$('search').addEventListener('input',renderList); $('run').addEventListener('click',() => callTool('check'));
$('refresh').addEventListener('click',async () => { if (!connected) await connect(); if (connected) await callTool('refresh'); });
$('item-retry').addEventListener('click',() => selectItem(selection));
$('copy').addEventListener('click',async () => {
 if (!detail) return;
 try { if (!navigator.clipboard?.writeText) throw new Error(); await navigator.clipboard.writeText(detail.context); copyStatus = 'copied'; }
 catch { copyStatus = 'manualCopy'; $('context-details').open = true; $('context').focus(); $('context').select(); }
 text('copy-status',t(copyStatus)); resize();
});
$('expand').addEventListener('click',async () => {
 try { const response = await request('ui/request-display-mode',{mode:displayMode === 'fullscreen' ? 'inline' : 'fullscreen'}); if (response?.mode) displayMode = response.mode; render(); }
 catch(error) { lastError = error; render(); }
});
document.querySelectorAll('[role="tab"]').forEach(button => {
 button.addEventListener('click',() => switchTab(button.dataset.tab));
 button.addEventListener('keydown',event => {
  const tabs = [...document.querySelectorAll('[role="tab"]')]; if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return; event.preventDefault();
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (tabs.indexOf(button) + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
  tabs[index].focus(); switchTab(tabs[index].dataset.tab);
 });
});
document.querySelectorAll('details').forEach(node => node.addEventListener('toggle',resize));
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(document.body);
connect();
`
