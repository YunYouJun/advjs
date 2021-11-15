import { createPinia } from 'pinia'
import { UserModule } from '../types'

// Setup Pinia
// https://pinia.esm.dev/
export const install: UserModule = ({ app }) => {
  const pinia = createPinia()
  app.use(pinia)
}
