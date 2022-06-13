import type { AdvPluginOptions } from './options'
// extend vite.config.ts
declare module 'vite' {
  interface UserConfig {
    /**
     * custom internal plugin
     */
    advjs?: AdvPluginOptions
  }
}
