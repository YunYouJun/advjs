import type { Plugin } from 'vue'
import cloudbase from '@cloudbase/js-sdk'
import { cloudbaseAppInjectionKey, cloudbaseAuthInjectionKey } from '../composables/useCloudbase'
import { configureManagedCloudSync } from './cloudSync'

/**
 * CloudBase Vue Plugin
 *
 * Initializes CloudBase JS SDK and provides app/auth instances
 * via Vue's dependency injection system.
 *
 * Shares the same CloudBase environment as 云乐坊 (yunle.fun).
 */
export const cloudbasePlugin: Plugin = {
  install(app) {
    const envId = import.meta.env.VITE_TCB_ENV_ID
    if (!envId) {
      console.warn('[CloudBase] VITE_TCB_ENV_ID is not defined, auth features will be unavailable')
      return
    }

    const region = import.meta.env.VITE_TCB_REGION || 'ap-shanghai'
    const accessKey = import.meta.env.VITE_TCB_ACCESS_KEY
    const cloudApp = cloudbase.init({
      env: envId,
      region,
      auth: { detectSessionInUrl: false },
      ...(accessKey ? { accessKey } : {}),
    })
    const auth = cloudApp.auth({ persistence: 'local' })
    configureManagedCloudSync(cloudApp)

    app.provide(cloudbaseAppInjectionKey, cloudApp)
    app.provide(cloudbaseAuthInjectionKey, auth)
  },
}
