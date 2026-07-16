import type { JsonObject } from '../runtime'
import type { ResolvedAdvOptions } from './options'

export interface AdvRuntimeActivityRendererReference {
  module: string
  export?: string
}

export interface AdvRuntimePluginClientReference {
  module: string
  export?: string
  options?: JsonObject
  activities?: Record<string, AdvRuntimeActivityRendererReference>
}

export interface AdvRuntimePluginReference {
  name: string
  version: string
  client?: AdvRuntimePluginClientReference
}

/**
 * official: @advjs/plugin-
 * third: advjs-plugin-
 */
export interface AdvPlugin {
  name: string
  optionsResolved?: (options: ResolvedAdvOptions) => Promise<void> | void
}

/**
 * resolved with package.json
 */
export interface ResolvedAdvPlugin extends AdvPlugin {
  /**
   * root path of the plugin
   */
  root: string
  pkg: Record<string, any>
}
