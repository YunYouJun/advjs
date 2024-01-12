import type { InjectionKey } from 'vue'
import type { FSItem } from './types'

export * from './types'

export const AGUIAssetsExplorerSymbol: InjectionKey<{
  onDblClick?: (item: FSItem) => void | Promise<void>
}> = Symbol('AGUIAssetsExplorer')
