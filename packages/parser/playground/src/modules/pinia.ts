import type { UserModule } from '../types'
import { createPinia } from 'pinia'

// Setup Pinia
// https://pinia.esm.dev/
export const install: UserModule = ({ app }) => {
  const pinia = createPinia()
  app.use(pinia)
}
