import type { Awaitable } from '@antfu/utils'
import type { PluginContext } from 'rollup'
import type { ResolvedAdvOptions } from '../../options'

export interface VirtualModuleTemplate {
  id: string
  getContent: (this: PluginContext, options: ResolvedAdvOptions) => Awaitable<string>
}
