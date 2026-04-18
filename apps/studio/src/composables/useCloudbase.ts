import type cloudbase from '@cloudbase/js-sdk'
import type { InjectionKey } from 'vue'
import { inject } from 'vue'

export const cloudbaseAppInjectionKey: InjectionKey<cloudbase.app.App> = Symbol('cloudbase:app')
export const cloudbaseAuthInjectionKey: InjectionKey<cloudbase.auth.App> = Symbol('cloudbase:auth')

export function useCloudbaseApp() {
  const $cloudbase = inject(cloudbaseAppInjectionKey)
  if (!$cloudbase)
    throw new Error('cloudbase is not provided')
  return $cloudbase
}

export function useCloudbaseAuth() {
  const $cloudbaseAuth = inject(cloudbaseAuthInjectionKey)
  if (!$cloudbaseAuth)
    throw new Error('cloudbaseAuth is not provided')
  return $cloudbaseAuth
}

export function useCloudbase() {
  const app = useCloudbaseApp()
  const auth = useCloudbaseAuth()
  return { app, auth }
}
