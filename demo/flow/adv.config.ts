import { defineAdvConfig } from 'advjs'

export default defineAdvConfig({
  root: './adv',

  format: 'flow',
  theme: 'default',

  features: {
    babylon: false,
  },
})
