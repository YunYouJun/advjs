import type { ResolvedAdvOptions } from '../options'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { uniq } from '@antfu/utils'
import { escapeHtml } from 'markdown-it/lib/common/utils.mjs'
import { toAtFS } from '../resolver'

export function toAttrValue(unsafe: unknown) {
  return JSON.stringify(escapeHtml(String(unsafe)))
}

export default function setupIndexHtml({ mode, data, themeRoot, userRoot, clientRoot, base }: ResolvedAdvOptions): string {
  let main = readFileSync(join(clientRoot, 'index.html'), 'utf-8')
  let head = ''
  let body = ''

  head += `<link rel="icon" href="${data.gameConfig.favicon}">`

  const roots = uniq([
    themeRoot,
    userRoot,
  ])

  for (const root of roots) {
    const path = join(root, 'index.html')
    if (!existsSync(path))
      continue

    const index = readFileSync(path, 'utf-8')

    head += `\n${(index.match(/<head>([\s\S]*?)<\/head>/i)?.[1] || '').trim()}`
    body += `\n${(index.match(/<body>([\s\S]*?)<\/body>/i)?.[1] || '').trim()}`
  }

  const baseInDev = mode === 'dev' && base ? base.slice(0, -1) : ''
  main = main
    .replace('__ENTRY__', baseInDev + toAtFS(join(clientRoot, 'main.ts')))
    .replace('<!-- head -->', head)
    .replace('<!-- body -->', body)

  return main
}
