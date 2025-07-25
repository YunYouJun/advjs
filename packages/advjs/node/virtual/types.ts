import type { ResolvedAdvOptions } from '@advjs/types'
import type { Awaitable } from '@antfu/utils'
import type { PluginContext } from 'rollup'

export interface VirtualModuleTemplate {
  id: string
  getContent: (this: PluginContext, options: ResolvedAdvOptions) => Awaitable<string>
}
