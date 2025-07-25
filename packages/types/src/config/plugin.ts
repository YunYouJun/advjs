import type { ResolvedAdvOptions } from './options'

/**
 * adv-plugin-
 */
export interface AdvPlugin {
  optionsResolved?: (options: ResolvedAdvOptions) => Promise<void> | void
}
