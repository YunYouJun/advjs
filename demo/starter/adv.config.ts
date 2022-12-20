import { defineAdvConfig } from 'advjs'
import * as assets from './assets'

export default defineAdvConfig({
  theme: 'default',

  features: {
    babylon: true,
  },

  assets: {
    images: assets.images,
    audios: assets.audios,
  },
})
