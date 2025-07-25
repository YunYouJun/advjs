import type { AdvData, AdvEntryOptions } from '@advjs/types'
// import type RemoteAssets from 'vite-plugin-remote-assets'
// import type ServerRef from 'vite-plugin-vue-server-ref'
import type { ArgumentsType } from '@antfu/utils'
import type Vue from '@vitejs/plugin-vue'
import type { VitePluginConfig as UnoCSSConfig } from 'unocss/vite'
import type Components from 'unplugin-vue-components/vite'
import type Markdown from 'unplugin-vue-markdown'
import type { HmrContext } from 'vite'

export interface AdvPluginOptions extends AdvEntryOptions {
  vue?: ArgumentsType<typeof Vue>[0]
  markdown?: ArgumentsType<typeof Markdown>[0]
  components?: ArgumentsType<typeof Components>[0]
  unocss?: UnoCSSConfig
  // remoteAssets?: ArgumentsType<typeof RemoteAssets>[0]
  // serverRef?: ArgumentsType<typeof ServerRef>[0]
}

export interface AdvServerOptions {
  /**
   * @returns `false` if server should be restarted
   */
  loadData?: (ctx: HmrContext, loadedSource: Record<string, string>) => Promise<AdvData | false>
}
