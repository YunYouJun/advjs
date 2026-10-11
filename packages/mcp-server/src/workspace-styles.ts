/** Compact Editor-style chrome for inline and expanded MCP Apps. */
export const ADV_WORKSPACE_STYLES = String.raw`
:root { color-scheme:light; --agui-c-bg-panel:#fff; --agui-c-text-1:#303030; --agui-c-text-2:#595959; --agui-c-border:#c7c7c7; --agui-c-bg-panel-title:#f2f2f2; --agui-c-link:#245d9d; --agui-c-selection:#dce8f6; --agui-c-danger-text:#a12c2c; --agui-c-warning-text:#855600; font-family:var(--font-sans,system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif); }
:root[data-theme="dark"] { color-scheme:dark; --agui-c-bg-panel:#383838; --agui-c-text-1:#e8e8eb; --agui-c-text-2:#b4b4bd; --agui-c-border:#545454; --agui-c-bg-panel-title:#464646; --agui-c-link:#9ac3f3; --agui-c-selection:#304866; --agui-c-danger-text:#ffa6a6; --agui-c-warning-text:#e5c071; }
@media(prefers-color-scheme:dark) { :root:not([data-theme]) { color-scheme:dark; --agui-c-bg-panel:#383838; --agui-c-text-1:#e8e8eb; --agui-c-text-2:#b4b4bd; --agui-c-border:#545454; --agui-c-bg-panel-title:#464646; --agui-c-link:#9ac3f3; --agui-c-selection:#304866; --agui-c-danger-text:#ffa6a6; --agui-c-warning-text:#e5c071; } }
* { box-sizing:border-box; }
body { margin:0; color:var(--agui-c-text-1); background:var(--color-background-primary,var(--agui-c-bg-panel)); font-size:13px; line-height:1.6; }
main { max-width:960px; margin:auto; }
button,input,select,textarea { font:inherit; color:inherit; }
button,select { border:1px solid var(--agui-c-border); border-radius:3px; background:transparent; padding:2px 8px; min-height:24px; }
button { cursor:pointer; }
button:hover,select:hover { background:var(--agui-c-bg-panel-title); }
button:disabled { opacity:.5; cursor:default; }
button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible,textarea:focus-visible { outline:2px solid var(--agui-c-link); outline-offset:2px; }
header { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; padding:10px 14px; border-bottom:1px solid var(--agui-c-border); }
header strong { font-size:13px; }
.header-actions { display:flex; align-items:center; gap:6px; }
select { max-width:150px; font-size:12px; }
.project-heading { padding:12px 14px 10px; }
h1 { margin:0; font-size:17px; font-weight:600; overflow-wrap:anywhere; }
h2 { margin:0 0 8px; font-size:15px; font-weight:600; }
h3 { margin:14px 0 7px; font-size:13px; font-weight:600; }
p { margin:5px 0; }
.muted,.project-meta { color:var(--agui-c-text-2); }
.project-meta { display:flex; flex-wrap:wrap; gap:4px 12px; font-size:12px; }
.project-meta span:empty { display:none; }
.error { color:var(--agui-c-danger-text); }
.warning { color:var(--agui-c-warning-text); }
#stats { display:flex; flex-wrap:wrap; gap:4px 18px; margin-top:7px; font-size:12px; }
#stats b { font-size:13px; font-weight:600; margin-right:4px; }
code,pre,textarea { font-family:var(--font-mono,ui-monospace,SFMono-Regular,Consolas,monospace); font-size:11px; }
code { overflow-wrap:anywhere; white-space:pre-wrap; }
#root { display:block; margin:5px 0; }
nav { display:flex; gap:2px; padding:0 10px; border-bottom:1px solid var(--agui-c-border); background:var(--agui-c-bg-panel-title); }
nav button { border:0; border-radius:0; border-bottom:2px solid transparent; padding:8px 10px; }
nav button[aria-selected="true"] { border-bottom-color:var(--agui-c-link); color:var(--agui-c-link); background:var(--agui-c-bg-panel); }
.overview { padding:12px 14px; }
.section { border-bottom:1px solid var(--agui-c-border); padding:0 0 12px; margin-bottom:12px; }
.section:last-child { border:0; margin-bottom:0; padding-bottom:0; }
.section-title { font-weight:600; }
summary { cursor:pointer; color:var(--agui-c-text-2); width:fit-content; }
details { margin-top:8px; }
ul { padding:0; margin:7px 0 0; list-style:none; }
li { overflow-wrap:anywhere; }
#files { max-height:180px; overflow:auto; }
#files li { padding:2px 0; }
.issue { border-left:2px solid var(--agui-c-border); padding:5px 0 5px 9px; margin:8px 0; }
.issue.error { border-color:var(--agui-c-danger-text); }
.issue.warning { border-color:var(--agui-c-warning-text); }
.issue p { color:var(--agui-c-text-1); margin:2px 0; }
#command { display:block; background:var(--agui-c-bg-panel-title); border-radius:3px; padding:8px; margin-top:8px; }
.browser { display:grid; grid-template-columns:180px minmax(0,1fr); min-height:270px; }
aside { padding:10px 8px; background:var(--agui-c-bg-panel-title); border-right:1px solid var(--agui-c-border); }
#search { width:100%; min-width:0; border:1px solid var(--agui-c-border); border-radius:3px; padding:5px 7px; background:var(--agui-c-bg-panel); }
#item-list { max-height:420px; overflow:auto; }
#item-list button { display:block; width:100%; text-align:left; padding:6px 8px; border:0; border-radius:3px; }
#item-list button[aria-current="true"] { color:var(--agui-c-link); background:var(--agui-c-selection); }
.item-id { display:block; font-size:11px; color:var(--agui-c-text-2); overflow-wrap:anywhere; }
.detail { padding:14px; min-width:0; }
#detail-paths { display:block; color:var(--agui-c-text-2); }
.detail-heading { display:flex; flex-wrap:wrap; align-items:start; justify-content:space-between; gap:8px; }
#copy { font-size:12px; }
.portraits { display:flex; flex-wrap:wrap; gap:8px; }
figure { margin:0; }
.portrait { max-width:120px; padding:6px; background:var(--agui-c-bg-panel-title); border:1px solid var(--agui-c-border); border-radius:3px; }
.portrait img { display:block; width:76px; height:76px; object-fit:cover; border-radius:2px; margin:auto; }
.portrait figcaption { text-align:center; font-size:12px; margin-top:5px; }
.portrait code { display:block; color:var(--agui-c-text-2); }
.image-note { font-size:11px; max-width:110px; color:var(--agui-c-warning-text); }
.reference { margin:8px 0; }
.reference img { display:block; max-width:100%; max-height:300px; object-fit:contain; border:1px solid var(--agui-c-border); }
.reference figcaption { font-size:12px; color:var(--agui-c-text-2); margin-top:5px; }
.traits li { padding-left:10px; border-left:2px solid var(--agui-c-border); margin:5px 0; }
.body-text { white-space:pre-wrap; overflow-wrap:anywhere; }
pre,textarea { margin:8px 0; white-space:pre-wrap; overflow-wrap:anywhere; background:var(--agui-c-bg-panel-title); padding:10px; border:1px solid var(--agui-c-border); border-radius:3px; max-height:360px; overflow:auto; width:100%; line-height:1.65; }
textarea { resize:vertical; min-height:120px; }
footer { display:flex; align-items:center; flex-wrap:wrap; gap:10px; padding:10px 14px; border-top:1px solid var(--agui-c-border); }
.primary { color:var(--agui-c-link); border-color:var(--agui-c-link); font-weight:600; }
#loading,#error { margin:10px 14px; }
[hidden] { display:none!important; }
@media(max-width:520px) { .browser { grid-template-columns:minmax(0,1fr); } aside { border-right:0; border-bottom:1px solid var(--agui-c-border); } #item-list { display:flex; gap:4px; overflow-x:auto; max-height:130px; } #item-list li { min-width:110px; max-width:160px; flex-shrink:0; } nav { padding:0 6px; } nav button { flex:1; padding:8px 6px; } .detail { padding:12px; } }
@media(pointer:coarse) { button,select { min-height:44px; } #search { min-height:44px; } input,select,textarea { font-size:16px; } }
@media(prefers-reduced-motion:reduce) { *,*::before,*::after { scroll-behavior:auto!important; } }
`
