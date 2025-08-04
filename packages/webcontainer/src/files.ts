import type { FileSystemTree } from '@webcontainer/api'
import { version as pluginPominisVersion } from '../../../plugins/plugin-pominis/package.json'
import { version as themePominisVersion } from '../../../themes/theme-pominis/package.json'
import { version as advjsVersion } from '../../advjs/package.json'

const storyId = '6c91aa92-3f4a-462e-89e8-05040602e768'

export const advProjectFiles: FileSystemTree = {
  'adv.config.ts': {
    file: {
      contents: `
import { defineAdvConfig } from 'advjs'
import { pluginPominis } from '@advjs/plugin-pominis'

export default defineAdvConfig({
  theme: 'pominis',

  plugins: [
    pluginPominis({
      storyId: '${storyId}', // example storyId, replace with actual
    }),
  ]
})
`,
    },
  },
  'package.json': {
    file: {
      contents: `
{
  "name": "advjs-singlefile",
  "type": "module",
  "version": "0.0.1",
  "scripts": {
    "dev": "adv dev",
    "build": "npm run build:singlefile",
    "build:singlefile": "adv build --singlefile"
  },
  "devDependencies": {
    "@advjs/plugin-pominis": "${pluginPominisVersion}",
    "@advjs/theme-pominis": "${themePominisVersion}",
    "advjs": "${advjsVersion}"
  }
}`,
    },
  },
}
