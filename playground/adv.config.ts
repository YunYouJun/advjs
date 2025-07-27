import pluginPominis from '@advjs/plugin-pominis'
import { defineAdvConfig } from 'advjs'

export default defineAdvConfig({
  theme: 'pominis',

  plugins: [
    pluginPominis({}),
  ],
})
