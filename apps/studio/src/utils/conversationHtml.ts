/**
 * Generate a standalone HTML page from conversation messages.
 * The HTML is self-contained (inline CSS, no external dependencies)
 * and can be opened directly in any browser for reading.
 */

import type { CharacterChatMessage } from '../stores/useCharacterChatStore'
import type { GroupChatMessage } from '../stores/useGroupChatStore'

export type ConversationTheme = 'light' | 'dark' | 'sepia'

interface ConversationHtmlOptions {
  title: string
  characterName: string
  characterAvatar?: string
  theme?: ConversationTheme
  projectName?: string
}

const THEMES: Record<ConversationTheme, { bg: string, text: string, userBg: string, aiBg: string, accent: string, muted: string }> = {
  light: { bg: '#ffffff', text: '#1a1a2e', userBg: '#ede9fe', aiBg: '#f1f5f9', accent: '#8b5cf6', muted: '#94a3b8' },
  dark: { bg: '#0f172a', text: '#e2e8f0', userBg: '#1e1b4b', aiBg: '#1e293b', accent: '#a78bfa', muted: '#64748b' },
  sepia: { bg: '#fdf6e3', text: '#3b2e1a', userBg: '#f5e6c8', aiBg: '#fef3dc', accent: '#b45309', muted: '#92742a' },
}

const RE_AMP = /&/g
const RE_LT = /</g
const RE_GT = />/g
const RE_QUOT = /"/g
const RE_NL = /\n/g

function escapeHtml(text: string): string {
  return text
    .replace(RE_AMP, '&amp;')
    .replace(RE_LT, '&lt;')
    .replace(RE_GT, '&gt;')
    .replace(RE_QUOT, '&quot;')
    .replace(RE_NL, '<br>')
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * Convert character chat messages to a standalone HTML page.
 */
export function characterChatToHtml(
  messages: CharacterChatMessage[],
  options: ConversationHtmlOptions,
): string {
  const theme = THEMES[options.theme || 'dark']
  const date = new Date().toLocaleDateString()

  const messagesHtml = messages.map((msg) => {
    const isUser = msg.role === 'user'
    const speaker = isUser ? 'You' : options.characterName
    const bg = isUser ? theme.userBg : theme.aiBg
    const align = isUser ? 'flex-end' : 'flex-start'

    return `<div style="display:flex;justify-content:${align};margin:8px 0">
  <div style="max-width:80%;padding:12px 16px;border-radius:16px;background:${bg};line-height:1.6;font-size:15px">
    <div style="font-size:12px;font-weight:700;color:${theme.accent};margin-bottom:4px">${escapeHtml(speaker)} <span style="color:${theme.muted};font-weight:400;margin-left:8px">${formatTime(msg.timestamp)}</span></div>
    ${escapeHtml(msg.content)}
  </div>
</div>`
  }).join('\n')

  return buildHtmlPage(options, theme, messagesHtml, date)
}

/**
 * Convert group chat messages to a standalone HTML page.
 */
export function groupChatToHtml(
  messages: GroupChatMessage[],
  roomName: string,
  options: Omit<ConversationHtmlOptions, 'characterName'>,
): string {
  const theme = THEMES[options.theme || 'dark']
  const date = new Date().toLocaleDateString()

  // Color palette for different speakers
  const speakerColors = ['#8b5cf6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444', '#ec4899']
  const colorMap = new Map<string, string>()
  let colorIdx = 0

  const messagesHtml = messages.map((msg) => {
    const isUser = msg.role === 'user'
    const speaker = isUser ? 'You' : (msg.characterName || '???')
    const bg = isUser ? theme.userBg : theme.aiBg
    const align = isUser ? 'flex-end' : 'flex-start'

    let speakerColor = theme.accent
    if (!isUser) {
      if (!colorMap.has(speaker)) {
        colorMap.set(speaker, speakerColors[colorIdx % speakerColors.length])
        colorIdx++
      }
      speakerColor = colorMap.get(speaker)!
    }

    return `<div style="display:flex;justify-content:${align};margin:8px 0">
  <div style="max-width:80%;padding:12px 16px;border-radius:16px;background:${bg};line-height:1.6;font-size:15px">
    <div style="font-size:12px;font-weight:700;color:${speakerColor};margin-bottom:4px">${escapeHtml(speaker)} <span style="color:${theme.muted};font-weight:400;margin-left:8px">${formatTime(msg.timestamp)}</span></div>
    ${escapeHtml(msg.content)}
  </div>
</div>`
  }).join('\n')

  return buildHtmlPage({ ...options, characterName: roomName, title: roomName }, theme, messagesHtml, date)
}

function buildHtmlPage(
  options: ConversationHtmlOptions,
  theme: typeof THEMES[ConversationTheme],
  messagesHtml: string,
  date: string,
): string {
  return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(options.title)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:${theme.bg};color:${theme.text};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:24px 16px;max-width:640px;margin:0 auto}
.header{text-align:center;padding:32px 0 24px;border-bottom:1px solid ${theme.muted}33}
.header h1{font-size:24px;font-weight:800;margin-bottom:4px}
.header .meta{font-size:13px;color:${theme.muted}}
.messages{padding:16px 0}
.footer{text-align:center;padding:24px 0;border-top:1px solid ${theme.muted}33;font-size:12px;color:${theme.muted}}
</style>
</head>
<body>
<div class="header">
<h1>${escapeHtml(options.title)}</h1>
<div class="meta">${escapeHtml(options.projectName || 'ADV.JS Studio')} · ${date}</div>
</div>
<div class="messages">
${messagesHtml}
</div>
<div class="footer">Created with ADV.JS Studio · advjs.org</div>
</body>
</html>`
}
