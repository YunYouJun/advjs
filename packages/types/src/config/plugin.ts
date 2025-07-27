import type { ResolvedAdvOptions } from './options'

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
