import { IonicVue } from '@ionic/vue'
import { createPinia } from 'pinia'
import { createApp } from 'vue'
import App from './App.vue'
import i18n from './i18n'

import router from './router'

/* Capacitor native plugin initialization */
import { initCapacitorPlugins } from './utils/capacitor'

/* Ensure IndexedDB is open (with auto-recovery) before mounting */
import { dbReady } from './utils/db'

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
  .use(IonicVue)
  .use(pinia)
  .use(i18n)
  .use(router)

Promise.all([router.isReady(), dbReady]).then(() => {
  app.mount('#app')
  initCapacitorPlugins()
})
