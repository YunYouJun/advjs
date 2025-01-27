import type { UserModule } from '../types'
// @ts-expect-error v-tooltip is not ts
import VTooltip from 'v-tooltip'

import 'v-tooltip/dist/v-tooltip.css'

export const install: UserModule = ({ app }) => {
  app.use(VTooltip)
}
