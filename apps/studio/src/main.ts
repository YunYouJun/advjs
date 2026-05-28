import { IonicVue } from '@ionic/vue'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
/* CloudBase auth restore */
import { useCloudbaseApp, useCloudbaseAuth } from './composables/useCloudbase'
import i18n from './i18n'

import router from './router'

import { useAuthStore } from './stores/useAuthStore'

/* Capacitor native plugin initialization */
import { initCapacitorPlugins } from './utils/capacitor'

/* CloudBase SDK Vue Plugin */
import { cloudbasePlugin } from './utils/cloudbase'

/* Ensure IndexedDB is open (with auto-recovery) before mounting */
import { dbReady } from './utils/db'

/* Telemetry (opt-in, default OFF) */
import { attachCloudbase, startTelemetry, track } from './utils/telemetry'

/* Core CSS required for Ionic components to work properly */
import '@ionic/vue/css/core.css'
/* Basic CSS for apps built with Ionic */
import '@ionic/vue/css/normalize.css'
import '@ionic/vue/css/structure.css'

import '@ionic/vue/css/typography.css'
/* Optional CSS utils that can be commented out */
import '@ionic/vue/css/padding.css'
import '@ionic/vue/css/float-elements.css'
import '@ionic/vue/css/text-alignment.css'
import '@ionic/vue/css/text-transformation.css'
import '@ionic/vue/css/flex-utils.css'

/**
 * Ionic Dark Mode
 * -----------------------------------------------------
 * For more info, please see:
 * https://ionicframework.com/docs/theming/dark-mode
 */

import '@ionic/vue/css/display.css'

/* @import '@ionic/vue/css/palettes/dark.always.css'; */
/* @import '@ionic/vue/css/palettes/dark.system.css'; */
import '@ionic/vue/css/palettes/dark.class.css'
/* Theme variables */
import './theme/variables.css'
import './theme/global.css'

import './theme/shared.css'

/* UnoCSS (icons via @iconify-json/vscode-icons) */
import 'virtual:uno.css'

/* AGUI Assets Explorer dependency */
import 'splitpanes/dist/splitpanes.css'

const pinia = createPinia()

const app = createApp(App)
  .use(IonicVue, {
    mode: 'ios',
  })
  .use(pinia)
  .use(cloudbasePlugin)
  .use(i18n)
  .use(router)

/* Global error handler — catches uncaught errors from components */
app.config.errorHandler = (err, _instance, info) => {
  console.error(`[Vue Error] ${info}:`, err)
  track('error.vue', {
    info,
    msg: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? (err.stack || '').slice(0, 800) : undefined,
  })
}

/* Catch unhandled promise rejections globally */
window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Rejection]', event.reason)
  track('error.promise', {
    msg: event.reason instanceof Error ? event.reason.message : String(event.reason),
    stack: event.reason instanceof Error ? (event.reason.stack || '').slice(0, 800) : undefined,
  })
})

Promise.all([router.isReady(), dbReady]).then(() => {
  app.mount('#app')
  initCapacitorPlugins()

  // Restore CloudBase login session on app startup
  try {
    const auth = app.runWithContext(() => useCloudbaseAuth())
    const authStore = useAuthStore()
    authStore.refreshLoginState(auth)
  }
  catch {
    // CloudBase not configured — skip auth restore
  }

  // Wire telemetry — opt-in dialog is shown by `TelemetryOptInPrompt.vue`.
  try {
    const cloudApp = app.runWithContext(() => useCloudbaseApp())
    attachCloudbase(cloudApp)
  }
  catch {
    // CloudBase not configured — telemetry stays in queue-only mode
  }
  startTelemetry()
})
