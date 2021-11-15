import VTooltip from 'v-tooltip'
import { UserModule } from '~/types'

import 'v-tooltip/dist/v-tooltip.css'

export const install: UserModule = ({ app }) => {
  app.use(VTooltip)
}
