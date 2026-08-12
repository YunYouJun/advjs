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
      '**/.codex/**',
      '**/cache/**',
      '**/test-results/**',
      '**/CAPACITOR.md',
      '**/*.svg',
      // Capacitor native projects are generated/native code — never lint them.
      // Without this, `eslint .` floods the stylish formatter and crashes with
      // `RangeError: Invalid string length`.
      'apps/studio/ios/**',
      'apps/studio/android/**',
      'apps/studio/ios-templates/**/*.xml',
      'MATERIAL_*.md',
      'MISSING_*.md',
      'TEMPLATE_*.md',
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
    files: [
      'apps/studio/cloud/functions/**/package.json',
      'apps/studio/cloudbase/functions/**/package.json',
    ],
    rules: {
      // CloudBase functions are not workspace packages; catalog is unavailable
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
