// @ts-ignore
// eslint-disable-next-line import/no-named-as-default
import VTooltip from 'v-tooltip'
import type { UserModule } from '~/types'

import 'v-tooltip/dist/v-tooltip.css'

export const install: UserModule = ({ app }) => {
  app.use(VTooltip)
}
