/// <reference types="vite/client" />

// `@advjs/client` / `@advjs/parser` reference `__DEV__` as a build-time global.
// The constant is wired up via Vite's `define` in this app's `vite.config.ts`.
declare const __DEV__: boolean

// Engine dictionaries supplied by Studio's game-locales Vite plugin.
declare module 'virtual:advjs-game-locales' {
  import type { LocaleMessage, VueMessageType } from 'vue-i18n'

  const messages: Record<string, LocaleMessage<VueMessageType>>
  export default messages
}
