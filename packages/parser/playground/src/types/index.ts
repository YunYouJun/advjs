import type { App } from 'vue-demi'
import type { Router } from 'vue-router'

export type UserModule = (ctx: { app: App, isClient: boolean, router: Router }) => void
