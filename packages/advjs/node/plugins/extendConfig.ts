import type { Alias, InlineConfig, Plugin } from 'vite'
import type { ResolvedAdvOptions } from '../options'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { uniq } from '@antfu/utils'

import { mergeConfig } from 'vite'

import { ADV_VIRTUAL_MODULES } from '../config'

import { require } from '../env'

import { resolveImportPath, toAtFS } from '../resolver'
import setupIndexHtml from '../setups/indexHtml'
import { searchForWorkspaceRoot } from '../vite/searchRoot'

// import { commonAlias } from '../../../shared/config/vite'
const __dirname = dirname(fileURLToPath(import.meta.url))

const EXCLUDE = [
  // avoid css parse by vite
  'animate.css',

  '@vueuse/core',
  '@vueuse/shared',
  'vue-demi',

  '@types/mdast',

  // internal
  ...ADV_VIRTUAL_MODULES,
]

const babylonDeps = [
  'babylon-vrm-loader',

  '@babylonjs/core',
  '@babylonjs/loaders',
  '@babylonjs/materials',
  '@babylonjs/materials/grid',
  '@babylonjs/loaders/glTF',
]

function filterDeps(deps: Record<string, string>) {
  return Object.keys(deps).filter(i => !EXCLUDE.includes(i) && !i.startsWith('@advjs/') && !i.startsWith('#advjs') && !i.startsWith('@types'))
}

export async function createConfigPlugin(options: ResolvedAdvOptions): Promise<Plugin> {
  const clientPkg = require('@advjs/client/package.json')
  const corePkg = require('@advjs/core/package.json')
  // const { dependencies: parserDeps } = await import('@advjs/parser/package.json', { assert: { type: 'json' } })
  // const { dependencies: clientDeps } = await import('@advjs/client/package.json', { assert: { type: 'json' } })
  // const { dependencies: coreDeps } = await import('@advjs/core/package.json', { assert: { type: 'json' } })
  const parserPkg = require('@advjs/parser/package.json')

  const parserDeps = 'dependencies' in parserPkg ? parserPkg.dependencies : {}
  const clientDeps = 'dependencies' in clientPkg ? clientPkg.dependencies : {}
  const coreDeps = 'dependencies' in corePkg ? corePkg.dependencies : {}

  let INCLUDE = [
    ...filterDeps(parserDeps),
    ...filterDeps(clientDeps),
    ...filterDeps(coreDeps),
  ]

  if (options.data.config.features.babylon)
    INCLUDE = INCLUDE.concat(babylonDeps)

  const themeDefaultRoot = resolve(__dirname, '../../../theme-default')
  const alias: Alias[] = [
    { find: '~/', replacement: `${toAtFS(options.clientRoot)}/` },
    { find: '@advjs/client', replacement: `${toAtFS(options.clientRoot)}/index.ts` },
    { find: '@advjs/client/', replacement: `${toAtFS(options.clientRoot)}/` },
    { find: '@advjs/core', replacement: `${resolve(__dirname, '../../../core/src')}/index.ts` },
    { find: '@advjs/parser', replacement: `${toAtFS(resolve(__dirname, '../../../parser/src', 'index.ts'))}` },
    { find: '@advjs/shared', replacement: `${toAtFS(resolve(__dirname, '../../../shared/src', 'index.ts'))}` },
    { find: '@advjs/theme-default', replacement: `${toAtFS(themeDefaultRoot)}/index.ts` },
  ]

  return {
    name: 'advjs:config',
    // before devtools
    enforce: 'pre',
    async config(config) {
      const injection: InlineConfig = {
        // cacheDir: join(options.userRoot, 'node_modules/.vite'),
        cacheDir: join(options.userRoot, 'node_modules/.valaxy/cache'),
        publicDir: join(options.userRoot, 'public'),

        define: getDefine(options),
        resolve: {
          alias: [
            ...alias,

            {
              find: 'vue',
              replacement: await resolveImportPath('vue/dist/vue.esm-bundler.js', true),
            },
          ],
          dedupe: ['vue'],
        },
        optimizeDeps: {
          entries: [resolve(options.clientRoot, 'main.ts')],

          include: INCLUDE,
          exclude: EXCLUDE,
        },
        server: {
          fs: {
            strict: true,
            allow: uniq([
              searchForWorkspaceRoot(options.clientRoot),
              searchForWorkspaceRoot(options.themeRoot),
              searchForWorkspaceRoot(options.userRoot),
              searchForWorkspaceRoot(options.cliRoot),
              ...options.roots,
            ]),
          },
        },
      }

      return mergeConfig(config, injection)
    },

    configureServer(server) {
      const indexHtml = setupIndexHtml(options)
      // console.log('config plugin configure server')
      // serve our index.html after vite history fallback
      return () => {
        server.middlewares.use(async (req, res, next) => {
          if (req.url!.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html')
            res.statusCode = 200
            res.end(indexHtml)
            return
          }
          next()
        })
      }
    },

    transformIndexHtml(html) {
      // todo: adapt user/theme index.html by transformIndexHtml
      return {
        html,
        tags: [
          // {
          //   tag: 'script',
          //   attrs: {
          //     type: 'module',
          //     src: `${toAtFS(options.clientRoot)}/main.ts`,
          //   },
          //   injectTo: 'head-prepend',
          // },
        ],
      }
    },
  }
}

export function getDefine(options: ResolvedAdvOptions): Record<string, string> {
  return {
    __ADV_CLIENT_ROOT__: JSON.stringify(toAtFS(options.clientRoot)),
    __DEV__: options.mode === 'dev' ? 'true' : 'false',
    // __DEV__: options.mode === 'development' ? 'true' : 'false',
  }
}
