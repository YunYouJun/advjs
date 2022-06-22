import fs from 'fs'
import { join } from 'path'
import { uniq } from '@antfu/utils'
import { loadConfigFromFile, mergeConfig } from 'vite'
import type { ConfigEnv, InlineConfig } from 'vite'
import type { ResolvedAdvOptions } from './options'
import { toAtFS } from './utils'

export async function getIndexHtml({ clientRoot, themeRoot, data, userRoot }: ResolvedAdvOptions): Promise<string> {
  let main = fs.readFileSync(join(clientRoot, 'index.html'), 'utf-8')
  let head = ''
  let body = ''

  head += `<link rel="icon" href="${data.config.favicon}">`

  const roots = uniq([
    themeRoot,
    userRoot,
  ])

  for (const root of roots) {
    const path = join(root, 'index.html')
    if (!fs.existsSync(path))
      continue

    const index = fs.readFileSync(path, 'utf-8')

    head += `\n${(index.match(/<head>([\s\S]*?)<\/head>/im)?.[1] || '').trim()}`
    body += `\n${(index.match(/<body>([\s\S]*?)<\/body>/im)?.[1] || '').trim()}`
  }

  main = main
    .replace('__ENTRY__', toAtFS(join(clientRoot, 'main.ts')))
    .replace('<!-- head -->', head)
    .replace('<!-- body -->', body)

  return main
}

export async function mergeViteConfigs({ themeRoot }: ResolvedAdvOptions, viteConfig: InlineConfig, config: InlineConfig, command: 'serve' | 'build') {
  const configEnv: ConfigEnv = {
    mode: 'development',
    command,
  }

  const files = uniq([
    themeRoot,
  ]).map(i => join(i, 'vite.config.ts'))

  for await (const file of files) {
    if (!fs.existsSync(file))
      continue
    const viteConfig = await loadConfigFromFile(configEnv, file)
    if (!viteConfig?.config)
      continue
    config = mergeConfig(config, viteConfig.config)
  }

  return mergeConfig(viteConfig, config)
}
