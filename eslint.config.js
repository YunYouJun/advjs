// @ts-check
import process from 'node:process'
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
  {
    files: ['apps/studio/**/*'],
    rules: {
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'no-debugger': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'vue/no-deprecated-slot-attribute': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
