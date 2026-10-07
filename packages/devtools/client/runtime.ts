import type { DevToolsContext } from './snapshot'
import tokens from '@advjs/gui/client/styles/css-vars.scss?inline'
import { DEVTOOLS_EVENT, DEVTOOLS_RUNTIME_EVENT } from '../src/types'
import { attachDevToolsRuntime } from './snapshot'
// The launcher is built separately, then served by the host Vite dev server.
// @ts-expect-error Vite's browser entry is served by URL rather than a package export.
import { createHotContext } from '/@vite/client'

const hot = createHotContext('/__advjs_devtools/runtime')
const base = new URL(/* @vite-ignore */ '.', import.meta.url)
const host = document.createElement('div')
host.id = '__advjs-devtools-container__'
host.setAttribute('data-v-inspector-ignore', 'true')
const shadow = host.attachShadow({ mode: 'open' })
const style = document.createElement('style')
style.textContent = `${tokens.replaceAll(':root', ':host').replaceAll('.dark', ':host(.dark)')}
:host { position: fixed; inset: 0; z-index: 2147483000; pointer-events: none; font: 12px system-ui; }
button { font: inherit; color: var(--agui-c-text-1); background: var(--agui-c-control); border: 1px solid var(--agui-c-button-border); border-radius: 2px; padding: 4px 8px; cursor: pointer; pointer-events: auto; }
button:focus-visible { outline: 2px solid var(--agui-c-blue); outline-offset: 2px; }
.launcher { position: absolute; right: 12px; bottom: 12px; }
.panel { position: absolute; right: 12px; bottom: 48px; width: min(920px, calc(100% - 24px)); height: min(620px, calc(100% - 72px)); background: var(--agui-c-bg-panel); border: 1px solid var(--agui-c-divider); pointer-events: auto; display: flex; flex-direction: column; }
.panel[hidden] { display: none; }
header { display: flex; align-items: center; justify-content: space-between; padding: 3px 6px; color: var(--agui-c-text-1); background: var(--agui-c-bg-panel-title); border-bottom: 1px solid var(--agui-c-divider); }
iframe { border: 0; flex: 1; width: 100%; min-height: 0; }
`
const launcher = document.createElement('button')
launcher.className = 'launcher'
launcher.textContent = 'ADV.JS DevTools'
launcher.setAttribute('aria-controls', 'advjs-devtools-panel')
launcher.setAttribute('aria-expanded', 'false')
const panel = document.createElement('section')
panel.id = 'advjs-devtools-panel'
panel.className = 'panel'
panel.hidden = true
panel.setAttribute('aria-label', 'ADV.JS 调试面板')
const header = document.createElement('header')
const title = document.createElement('span')
title.textContent = 'ADV.JS DevTools'
const close = document.createElement('button')
close.textContent = '关闭'
close.setAttribute('aria-label', '关闭调试面板')
header.append(title, close)
panel.append(header)
shadow.append(style, panel, launcher)
let frame: HTMLIFrameElement | undefined
function setOpen(open: boolean, returnFocus = true) {
  panel.hidden = !open
  launcher.setAttribute('aria-expanded', String(open))
  if (open && !frame) {
    frame = document.createElement('iframe')
    frame.title = 'ADV.JS DevTools'
    frame.src = base.href
    panel.append(frame)
  }
  if (!open && returnFocus)
    launcher.focus()
}
launcher.addEventListener('click', () => setOpen(panel.hidden))
close.addEventListener('click', () => setOpen(false))
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape' && !panel.hidden)
    setOpen(false)
}
function onMessage(event: MessageEvent) {
  if (event.origin !== location.origin || event.source !== frame?.contentWindow)
    return
  if (event.data === 'advjs-devtools:close')
    setOpen(false)
  else if (event.data === 'advjs-devtools:detach')
    setOpen(false, false)
}
window.addEventListener('keydown', onKey)
window.addEventListener('message', onMessage)
const media = matchMedia('(prefers-color-scheme: dark)')
const syncTheme = () => host.classList.toggle('dark', media.matches)
syncTheme()
media.addEventListener('change', syncTheme)
let subscription: ReturnType<typeof attachDevToolsRuntime> | undefined
function attach(context: DevToolsContext) {
  subscription?.dispose()
  subscription = attachDevToolsRuntime(context, snapshot => hot.send(DEVTOOLS_EVENT, snapshot), () => location.href)
}
const onRuntime = (event: Event) => attach((event as CustomEvent<DevToolsContext>).detail)
window.addEventListener(DEVTOOLS_RUNTIME_EVENT, onRuntime)
const context = (window as Window & { __ADV_DEVTOOLS_CONTEXT__?: DevToolsContext }).__ADV_DEVTOOLS_CONTEXT__
if (context)
  attach(context)
hot.on('vite:ws:connect', () => subscription?.refresh())
const mount = () => document.body.append(host)
if (document.body)
  mount()
else
  document.addEventListener('DOMContentLoaded', mount, { once: true })
hot.dispose(() => {
  subscription?.dispose()
  host.remove()
  window.removeEventListener(DEVTOOLS_RUNTIME_EVENT, onRuntime)
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('message', onMessage)
  media.removeEventListener('change', syncTheme)
})
