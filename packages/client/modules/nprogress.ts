import type { UserModule } from '../types'
import NProgress from 'nprogress'

export const install: UserModule = ({ isClient, router }) => {
  if (isClient) {
    NProgress.configure({
      showSpinner: false,
    })
    router.beforeEach(() => {
      NProgress.start()
    })
    router.afterEach(() => {
      // setTimeout(() => {
      NProgress.done()
      // }, 5000000)
    })
  }
}
