import { dirname, join, resolve } from 'path'
import type { InlineConfig, Plugin } from 'vite'
import { mergeConfig } from 'vite'
import isInstalledGlobally from 'is-installed-globally'
import { uniq } from '@antfu/utils'
import { dependencies } from '../../../client/package.json'
import { getIndexHtml } from '../common'
import type { ResolvedAdvOptions } from '../options'
import { resolveGlobalImportPath, resolveImportPath, toAtFS } from '../utils'
import { searchForWorkspaceRoot } from '../vite/searchRoot'

// import { commonAlias } from '../../../shared/config/vite'

const EXCLUDE = [
  // avoid css parse by vite
  'animate.css',

  '@advjs/shared',
  '@advjs/types',
  '@vueuse/core',
  '@vueuse/shared',
  'vue-demi',
]

const babylonDeps = [
  'babylon-vrm-loader',

  '@babylonjs/core',
  '@babylonjs/loaders',
  '@babylonjs/materials',
  '@babylonjs/materials/grid',
  '@babylonjs/loaders/glTF',
]

let INCLUDE = [
  '@advjs/theme-default',
  // ...Object.keys(dependencies),
  ...Object.keys(dependencies).filter(i => !EXCLUDE.includes(i)),
]

export function createConfigPlugin(options: ResolvedAdvOptions): Plugin {
  if (options.data.features.babylon)
    INCLUDE = INCLUDE.concat(babylonDeps)

  return {
    name: 'advjs:config',
    config(config) {
      const injection: InlineConfig = {
        define: getDefine(options),
        resolve: {
          alias: {
            '@advjs/core': `${toAtFS(resolve(__dirname, '../../core/src'))}/index.ts`,
            // '@advjs/parser': `${toAtFS(resolve(__dirname, '../../parser/src'))}/core.ts`,
            '@advjs/shared/': `${toAtFS(resolve(__dirname, '../../shared/src'))}/`,
            '~/': `${toAtFS(options.clientRoot)}/`,
            '@advjs/client/': `${toAtFS(options.clientRoot)}/`,
          },
        },
        optimizeDeps: {

          include: INCLUDE,
          exclude: EXCLUDE,
        },
        server: {
          fs: {
            strict: true,
            allow: uniq([
              searchForWorkspaceRoot(options.userRoot),
              searchForWorkspaceRoot(options.cliRoot),
              searchForWorkspaceRoot(options.themeRoot),
              ...(
                isInstalledGlobally
                  ? [dirname(resolveGlobalImportPath('@advjs/client/package.json'))]
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
        injection.resolve.alias.vue = `${resolveImportPath('vue/dist/vue.esm-browser.js', true)}`
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
