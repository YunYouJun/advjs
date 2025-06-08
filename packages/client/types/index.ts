// import type { ViteSSGContext } from 'vite-ssg'
// export type UserModule = (ctx: ViteSSGContext) => void
import type { App } from 'vue'
import type { Router } from 'vue-router'

export type UserModule = (ctx: { app: App, isClient: boolean, router: Router }) => void | Promise<void>

export * from './context'
export * from './menu'
export * from './runtime'
