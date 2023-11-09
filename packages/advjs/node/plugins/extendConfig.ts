import { dirname, join, resolve } from 'node:path'
import type { Alias, InlineConfig, Plugin } from 'vite'
import { mergeConfig } from 'vite'
import isInstalledGlobally from 'is-installed-globally'

import { uniq } from '@antfu/utils'

import { dependencies as parserDeps } from '@advjs/parser/package.json'
import { dependencies as clientDeps } from '@advjs/client/package.json'
import { dependencies as coreDeps } from '@advjs/core/package.json'

import { getIndexHtml } from '../common'
import type { ResolvedAdvOptions } from '../options'

import { resolveGlobalImportPath, resolveImportPath, toAtFS } from '../utils'

import { searchForWorkspaceRoot } from '../vite/searchRoot'
import { ADV_VIRTUAL_MODULES } from '../config'

// import { commonAlias } from '../../../shared/config/vite'

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

let INCLUDE = [
  ...filterDeps(parserDeps),
  ...filterDeps(clientDeps),
  ...filterDeps(coreDeps),
]

export function createConfigPlugin(options: ResolvedAdvOptions): Plugin {
  if (options.data.features.babylon)
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
    async config(config) {
      const injection: InlineConfig = {
        define: getDefine(options),
        resolve: {
          alias,
        },
        optimizeDeps: {
          entries: [resolve(options.clientRoot, 'main.ts')],

          include: INCLUDE,
          exclude: EXCLUDE,
        },
        server: {
          fs: {
            // strict: false,
            allow: uniq([
              searchForWorkspaceRoot(options.userRoot),
              searchForWorkspaceRoot(options.cliRoot),
              searchForWorkspaceRoot(options.themeRoot),
              ...(
                isInstalledGlobally
                  ? [dirname(await resolveGlobalImportPath('@advjs/client/package.json'))]
                  : []
              ),
            ]),
          },
        },
      }

      if (isInstalledGlobally) {
        injection.cacheDir = join(options.cliRoot, 'node_modules/.vite')
        injection.publicDir = join(options.userRoot, 'public')
        injection.root = options.cliRoot
        // @ts-expect-error type cast
        injection.resolve.alias.vue = `${await resolveImportPath('vue/dist/vue.esm-browser.js', true)}`
      }

      return mergeConfig(config, injection)
    },
    configureServer(server) {
      // serve our index.html after vite history fallback
      return () => {
        server.middlewares.use(async (req, res, next) => {
          if (req.url!.endsWith('.html')) {
            res.setHeader('Content-Type', 'text/html')
            res.statusCode = 200
            res.end(await getIndexHtml(options))
            return
          }
          next()
        })
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
