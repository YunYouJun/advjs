import type { UserModule } from '@advjs/client/types'
import { createPinia } from 'pinia'

// Setup Pinia
// https://pinia.esm.dev/
export const install: UserModule = ({ app }) => {
  const pinia = createPinia()
  app.use(pinia)
  // Refer to
  // https://github.com/antfu/vite-ssg/blob/main/README.md#state-serialization
  // for other serialization strategies.
  // if (isClient)
  //   pinia.state.value = initialState.pinia || {}
  // else initialState.pinia = pinia.state.value
}
