import type { UserModule } from '../types'
import FloatingVue from 'floating-vue'

export const install: UserModule = ({ app }) => {
  app.use(FloatingVue)
}
