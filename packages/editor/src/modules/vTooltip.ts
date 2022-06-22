// @ts-expect-error v-tooltip is not ts

import VTooltip from 'v-tooltip'
import type { UserModule } from '@advjs/client/types'

import 'v-tooltip/dist/v-tooltip.css'

export const install: UserModule = ({ app }) => {
  app.use(VTooltip)
}
