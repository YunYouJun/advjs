/// <reference types="vite/client" />

// `@advjs/client` / `@advjs/parser` reference `__DEV__` as a build-time global.
// The constant is wired up via Vite's `define` in this app's `vite.config.ts`.
declare const __DEV__: boolean
