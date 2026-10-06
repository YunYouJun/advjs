/** Compact Editor-style chrome for inline and expanded MCP Apps. */
export const ADV_WORKSPACE_STYLES = String.raw`
:root { color-scheme:light; --bg:#fff; --text:#303034; --muted:#686870; --line:#dedee3; --soft:#f5f5f7; --accent:#326fbd; --selected:#eaf1fa; --error:#b72c38; --warn:#88631d; font-family:var(--font-sans,system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif); }
:root[data-theme="dark"] { color-scheme:dark; --bg:#292929; --text:#e8e8eb; --muted:#b4b4bd; --line:#47474d; --soft:#343434; --accent:#94bff3; --selected:#34465e; --error:#ff9ba3; --warn:#edc778; }
@media(prefers-color-scheme:dark) { :root:not([data-theme]) { color-scheme:dark; --bg:#292929; --text:#e8e8eb; --muted:#b4b4bd; --line:#47474d; --soft:#343434; --accent:#94bff3; --selected:#34465e; --error:#ff9ba3; --warn:#edc778; } }
* { box-sizing:border-box; }
body { margin:0; color:var(--text); background:var(--color-background-primary,var(--bg)); font-size:13px; line-height:1.6; }
main { max-width:960px; margin:auto; }
button,input,select,textarea { font:inherit; color:inherit; }
button,select { border:1px solid var(--line); border-radius:4px; background:transparent; padding:4px 9px; min-height:30px; }
button { cursor:pointer; }
button:hover,select:hover { background:var(--soft); }
button:disabled { opacity:.5; cursor:default; }
button:focus-visible,input:focus-visible,select:focus-visible,summary:focus-visible,textarea:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
header { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px; padding:10px 14px; border-bottom:1px solid var(--line); }
header strong { font-size:13px; }
.header-actions { display:flex; align-items:center; gap:6px; }
select { max-width:150px; font-size:12px; }
.project-heading { padding:12px 14px 10px; }
h1 { margin:0; font-size:17px; font-weight:600; overflow-wrap:anywhere; }
h2 { margin:0 0 8px; font-size:15px; font-weight:600; }
h3 { margin:14px 0 7px; font-size:13px; font-weight:600; }
p { margin:5px 0; }
.muted,.project-meta { color:var(--muted); }
.project-meta { display:flex; flex-wrap:wrap; gap:4px 12px; font-size:12px; }
.project-meta span:empty { display:none; }
.error { color:var(--error); }
.warning { color:var(--warn); }
#stats { display:flex; flex-wrap:wrap; gap:4px 18px; margin-top:7px; font-size:12px; }
#stats b { font-size:13px; font-weight:600; margin-right:4px; }
code,pre,textarea { font-family:var(--font-mono,ui-monospace,SFMono-Regular,Consolas,monospace); font-size:11px; }
code { overflow-wrap:anywhere; white-space:pre-wrap; }
#root { display:block; margin:5px 0; }
nav { display:flex; gap:2px; padding:0 10px; border-bottom:1px solid var(--line); background:var(--soft); }
nav button { border:0; border-radius:0; border-bottom:2px solid transparent; padding:8px 10px; }
nav button[aria-selected="true"] { border-bottom-color:var(--accent); color:var(--accent); background:var(--bg); }
.overview { padding:12px 14px; }
.section { border-bottom:1px solid var(--line); padding:0 0 12px; margin-bottom:12px; }
.section:last-child { border:0; margin-bottom:0; padding-bottom:0; }
.section-title { font-weight:600; }
summary { cursor:pointer; color:var(--muted); width:fit-content; }
details { margin-top:8px; }
ul { padding:0; margin:7px 0 0; list-style:none; }
li { overflow-wrap:anywhere; }
#files { max-height:180px; overflow:auto; }
#files li { padding:2px 0; }
.issue { border-left:2px solid var(--line); padding:5px 0 5px 9px; margin:8px 0; }
.issue.error { border-color:var(--error); }
.issue.warning { border-color:var(--warn); }
.issue p { color:var(--text); margin:2px 0; }
#command { display:block; background:var(--soft); border-radius:3px; padding:8px; margin-top:8px; }
.browser { display:grid; grid-template-columns:180px minmax(0,1fr); min-height:270px; }
aside { padding:10px 8px; background:var(--soft); border-right:1px solid var(--line); }
#search { width:100%; min-width:0; border:1px solid var(--line); border-radius:3px; padding:5px 7px; background:var(--bg); }
#item-list { max-height:420px; overflow:auto; }
#item-list button { display:block; width:100%; text-align:left; padding:6px 8px; border:0; border-radius:3px; }
#item-list button[aria-current="true"] { color:var(--accent); background:var(--selected); }
.item-id { display:block; font-size:11px; color:var(--muted); overflow-wrap:anywhere; }
.detail { padding:14px; min-width:0; }
#detail-paths { display:block; color:var(--muted); }
.detail-heading { display:flex; flex-wrap:wrap; align-items:start; justify-content:space-between; gap:8px; }
#copy { font-size:12px; }
.portraits { display:flex; flex-wrap:wrap; gap:8px; }
figure { margin:0; }
.portrait { max-width:120px; padding:6px; background:var(--soft); border:1px solid var(--line); border-radius:3px; }
.portrait img { display:block; width:76px; height:76px; object-fit:cover; border-radius:2px; margin:auto; }
.portrait figcaption { text-align:center; font-size:12px; margin-top:5px; }
.portrait code { display:block; color:var(--muted); }
.image-note { font-size:11px; max-width:110px; color:var(--warn); }
.reference { margin:8px 0; }
.reference img { display:block; max-width:100%; max-height:300px; object-fit:contain; border:1px solid var(--line); }
.reference figcaption { font-size:12px; color:var(--muted); margin-top:5px; }
.traits li { padding-left:10px; border-left:2px solid var(--line); margin:5px 0; }
.body-text { white-space:pre-wrap; overflow-wrap:anywhere; }
pre,textarea { margin:8px 0; white-space:pre-wrap; overflow-wrap:anywhere; background:var(--soft); padding:10px; border:1px solid var(--line); border-radius:3px; max-height:360px; overflow:auto; width:100%; line-height:1.65; }
textarea { resize:vertical; min-height:120px; }
footer { display:flex; align-items:center; flex-wrap:wrap; gap:10px; padding:10px 14px; border-top:1px solid var(--line); }
.primary { color:var(--accent); border-color:var(--accent); font-weight:600; }
#loading,#error { margin:10px 14px; }
[hidden] { display:none!important; }
@media(max-width:520px) { .browser { grid-template-columns:minmax(0,1fr); } aside { border-right:0; border-bottom:1px solid var(--line); } #item-list { display:flex; gap:4px; overflow-x:auto; max-height:130px; } #item-list li { min-width:110px; max-width:160px; flex-shrink:0; } nav { padding:0 6px; } nav button { flex:1; padding:8px 6px; } .detail { padding:12px; } }
@media(pointer:coarse) { button,select { min-height:44px; } #search { min-height:44px; } input,select,textarea { font-size:16px; } }
@media(prefers-reduced-motion:reduce) { *,*::before,*::after { scroll-behavior:auto!important; } }
`
