import type { ResolvedAdvOptions } from '@advjs/types'
import type { InlineConfig } from 'vite'
import type { AdvServerOptions } from '../options'
import { join } from 'node:path'
import process from 'node:process'

import { createServer as createViteServer } from 'vite'
import { resolveViteConfigs } from './shared'

export async function createServer(
  options: ResolvedAdvOptions,
  viteConfig: InlineConfig = {},
  serverOptions: AdvServerOptions = {},
) {
  // default open editor to code, #312
  process.env.EDITOR = process.env.EDITOR || 'code'

  const inlineConfig = await resolveViteConfigs(
    options,
    <InlineConfig>({
      optimizeDeps: {
        entries: [
          join(options.clientRoot, 'main.ts'),
        ],
      },
    }),
    viteConfig,
    'serve',
    serverOptions,
  )

  const server = await createViteServer(inlineConfig)
  return server
}
