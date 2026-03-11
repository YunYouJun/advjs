// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    unocss: true,
    formatters: true,
  },
  {
    ignores: [
      '**/.adv/**',
      '**/cache/**',
    ],
  },
  {
    files: ['packages/create-adv/templates/**/*'],
    rules: {
      // Disable catalog enforcement for template files
      'pnpm/json-enforce-catalog': 'off',
    },
  },
)
