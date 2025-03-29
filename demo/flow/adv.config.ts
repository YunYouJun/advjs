import { defineAdvConfig } from 'advjs'
import { LogLevels } from 'consola'

export default defineAdvConfig({
  logLevel: LogLevels.debug,
  root: './adv',

  format: 'flow',
  theme: 'default',

  features: {
    babylon: false,
  },

  gameConfig: {
    title: 'Your Name',
  },
})
