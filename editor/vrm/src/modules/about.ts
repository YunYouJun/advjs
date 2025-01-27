import type { UserModule } from '../types'
import { isClient } from '@vueuse/core'
import * as pkg from '../../package.json'

export const install: UserModule = () => {
  if (isClient) {
    // eslint-disable-next-line no-console
    console.log(
      `%c @advjs/vrm v${pkg.version} %c ${pkg.repository.url} `,
      'background-color:dodgerblue;color:white;padding:2px;',
      'border: 1px solid dodgerblue;padding:1px;',
    )
  }
}
