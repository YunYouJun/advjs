export const LAUNCH_VERSION = '0.1.4'
export const PACKAGE_REPOSITORY = 'https://github.com/YunYouJun/advjs'
export const ENTRY_PACKAGES = Object.freeze(['advjs', '@advjs/editor', '@advjs/mcp-server'])

export const PACKAGE_SPECS = Object.freeze([
  { name: '@advjs/types', path: 'packages/types', build: true, requiredFiles: ['dist/index.mjs', 'client.d.ts'] },
  { name: '@advjs/audio', path: 'packages/audio', build: true, requiredFiles: ['dist/index.mjs'] },
  { name: '@advjs/assets', path: 'packages/assets', build: true, requiredFiles: ['dist/index.mjs'] },
  { name: '@advjs/unocss', path: 'packages/unocss', build: true, requiredFiles: ['dist/index.mjs'] },
  { name: '@advjs/parser', path: 'packages/parser', build: true, requiredFiles: ['dist/index.mjs'] },
  { name: '@advjs/core', path: 'packages/core', build: true, requiredFiles: ['dist/index.mjs'] },
  { name: '@advjs/devtools', path: 'packages/devtools', build: true, requiredFiles: ['dist/vite.mjs'] },
  { name: '@advjs/client', path: 'packages/client', requiredFiles: ['index.ts'] },
  { name: '@advjs/gui', path: 'packages/gui', build: true, requiredFiles: ['dist/agui.js', 'nuxt.mjs'] },
  { name: '@advjs/theme-default', path: 'themes/theme-default', requiredFiles: ['index.ts'] },
  { name: '@advjs/editor', path: 'editor/core', build: true, requiredFiles: ['bin/adv-editor.mjs', 'dist/index.html'] },
  { name: 'advjs', path: 'packages/advjs', build: true, requiredFiles: ['bin/adv.mjs', 'dist/node/index.mjs', 'skills/catalog.json'] },
  { name: '@advjs/mcp-server', path: 'packages/mcp-server', build: true, requiredFiles: ['bin/mcp-server.mjs', 'dist/index.mjs'] },
  {
    name: 'create-adv',
    path: 'packages/create-adv',
    build: true,
    requiredFiles: [
      'bin/index.mjs',
      'dist/index.mjs',
      'templates/template-adv/package.json',
      'templates/template-adv/adv.config.json',
      'templates/template-adv/adv/chapters/01-introduction.adv.md',
      'templates/template-adv/_gitignore',
      'templates/template-plugin/package.json',
      'templates/template-plugin/src/index.ts',
      'templates/template-plugin/tsconfig.json',
      'templates/template-plugin/_gitignore',
    ],
  },
])
