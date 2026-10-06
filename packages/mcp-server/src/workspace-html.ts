import { ADV_WORKSPACE_SCRIPT } from './workspace-script'
import { ADV_WORKSPACE_STYLES } from './workspace-styles'

/** Self-contained Studio for MCP Apps hosts, including ChatGPT and Codex. */
export const ADV_WORKSPACE_HTML = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>ADV.JS Studio</title><style>${ADV_WORKSPACE_STYLES}</style></head>
<body><main>
<header><strong>ADV.JS Studio</strong><div class="header-actions"><button id="expand" hidden></button><button id="refresh" disabled></button><select id="language" aria-label="Language / 语言"><option value="auto">Follow host</option><option value="zh-CN">中文</option><option value="en">English</option></select></div></header>
<p id="loading" class="muted" role="status">Loading project…</p><p id="error" class="error" role="alert" hidden></p>
<div id="project" hidden>
  <div class="project-heading"><h1 id="name"></h1><div class="project-meta"><span id="repository"></span><span id="branch"></span><span id="dirty" class="warning"></span></div><div id="stats"></div></div>
  <nav role="tablist" aria-label="ADV.JS"><button role="tab" data-tab="overview" aria-selected="true" aria-controls="overview"></button><button role="tab" data-tab="characters" aria-selected="false" aria-controls="browser"></button><button role="tab" data-tab="chapters" aria-selected="false" aria-controls="browser"></button><button role="tab" data-tab="scenes" aria-selected="false" aria-controls="browser"></button></nav>
  <div id="overview" class="overview" role="tabpanel">
    <section class="section"><div id="diagnostic-summary"></div><ul id="diagnostics"></ul><details><summary id="directory-label"></summary><code id="root"></code></details><details><summary id="files-label"></summary><ul id="files"></ul></details></section>
    <section class="section"><div id="validation-status" class="section-title" role="status"></div><p id="validation-meta" class="muted"></p><ul id="validation-issues"></ul><details><summary id="command-label"></summary><code id="command"></code><p id="impact" class="muted"></p><p><span id="cwd-label"></span><code id="cwd"></code></p></details></section>
  </div>
  <div id="browser" class="browser" role="tabpanel" hidden>
    <aside><input id="search" type="search"><ul id="item-list"></ul><p id="list-empty" class="muted" hidden></p></aside>
    <section class="detail"><p id="item-status" class="muted" role="status"></p><button id="item-retry" hidden></button>
      <div id="detail-content" hidden><div class="detail-heading"><div><h2 id="detail-title"></h2><code id="detail-paths"></code></div><button id="copy"></button></div><p id="copy-status" class="muted" role="status"></p><div id="detail-body"></div>
        <details id="context-details"><summary id="context-label"></summary><textarea id="context" readonly aria-label="Authoring context / 创作上下文"></textarea></details>
        <details id="source-details"><summary id="source-label"></summary><div id="source"></div></details>
      </div>
    </section>
  </div>
</div>
<footer><button id="run" class="primary" disabled></button></footer>
</main><script type="module">${ADV_WORKSPACE_SCRIPT}</script></body></html>`
