import { defineAdvConfig } from 'advjs'
import * as assets from './assets'

export default defineAdvConfig({
  theme: 'default',

  features: {
    babylon: false,
  },

  assets,
})
