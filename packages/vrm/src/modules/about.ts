import type { UserModule } from '@advjs/client/types'
import * as pkg from '~/../package.json'

export const install: UserModule = () => {
  // eslint-disable-next-line no-console
  console.log(
    `%c @advjs/vrm v${pkg.version} %c ${pkg.repository.url} `,
    'background-color:dodgerblue;color:white;padding:2px;',
    'border: 1px solid dodgerblue;padding:1px;',
  )
}
