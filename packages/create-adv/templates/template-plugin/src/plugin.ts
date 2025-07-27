import type { AdvPlugin } from '@advjs/types'
import { name } from '../package.json'

export function pluginTemplate(): AdvPlugin {
  return {
    name,
  }
}
