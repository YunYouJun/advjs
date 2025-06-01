import { defineConfig } from 'tsdown'
import { ADV_VIRTUAL_MODULES } from './node/config'

import pkg from './package.json'

export default defineConfig({
  dts: true,
  entry: [
    './node/index.ts',
    './node/cli/index.ts',
  ],
  clean: true,
  external: [
    '@advjs/core',

    '@playwright/test',

    'mdast',

    ...Object.keys(pkg.dependencies),
    ...ADV_VIRTUAL_MODULES,
  ],
})
