import type { Alias, InlineConfig, Plugin } from 'vite'
import type { ResolvedAdvOptions } from '../options'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { uniq } from '@antfu/utils'
import { createResolve } from 'mlly'

import { mergeConfig } from 'vite'

import { ADV_VIRTUAL_MODULES } from '../config'
import { isInstalledGlobally, resolveImportPath, toAtFS } from '../resolver'
import setupIndexHtml from '../setups/indexHtml'

const vueRuntimePath = 'vue/dist/vue.runtime.esm-bundler.js'
const EXCLUDE_GLOBAL = [
  // avoid css parse by vite
  'animate.css',

  '@antfu/utils',
  '@unhead/vue',

  '@vueuse/core',
  '@vueuse/shared',
  '@vueuse/shared',
  'vue-demi',
  'vue-router',
  'vue',

  '@types/mdast',

  // internal
  ...ADV_VIRTUAL_MODULES,

  '@advjs/client',
  '@advjs/client/types',
  '@advjs/types',

  'floating-vue',
]
const EXCLUDE_LOCAL = EXCLUDE_GLOBAL

const babylonDeps = [
  'babylon-vrm-loader',

  '@babylonjs/core',
  '@babylonjs/loaders',
  '@babylonjs/materials',
  '@babylonjs/materials/grid',
  '@babylonjs/loaders/glTF',
]

// function filterDeps(deps: Record<string, string>) {
//   return Object.keys(deps).filter(i => !EXCLUDE.includes(i) && !i.startsWith('@advjs/') && !i.startsWith('#advjs') && !i.startsWith('@types'))
// }

const INCLUDE_GLOBAL: string[] = []
const INCLUDE_LOCAL = [
  'typescript',
  // 合并请求
  '@vueuse/motion',
  'pixi.js',
]

// const parserDeps = 'dependencies' in parserPkg ? parserPkg.dependencies : {}
// const clientDeps = 'dependencies' in clientPkg ? clientPkg.dependencies : {}
// const coreDeps = 'dependencies' in corePkg ? corePkg.dependencies : {}

/**
 * get dynamic alias by config
 * @param options
 */
export async function getAlias(options: ResolvedAdvOptions): Promise<Alias[]> {
  const resolveClientDep = createResolve({
    // Same as Vite's default resolve conditions
    conditions: ['import', 'module', 'browser', 'default', options.mode === 'build' ? 'production' : 'development'],
    url: pathToFileURL(options.clientRoot),
  })

  const alias: Alias[] = [
    /**
     * `/` 开头无法 declare module 类型
     */
    { find: /^#advjs\/(.*)/, replacement: '/@advjs/$1' },

    { find: '@advjs/client/modules/i18n', replacement: resolve(options.clientRoot, 'modules/i18n.ts') },
    { find: '@advjs/client/compiler', replacement: resolve(options.clientRoot, 'compiler/index.ts') },
    { find: '@advjs/client/runtime', replacement: resolve(options.clientRoot, 'runtime/index.ts') },
    { find: /^@advjs\/client$/, replacement: `${toAtFS(options.clientRoot)}/index.ts` },
    { find: /^@advjs\/client\/(.*)/, replacement: `${toAtFS(options.clientRoot)}/$1` },
  ]

  // themes
  const themeName = options.data.config.theme || 'default'
  alias.push(
    { find: 'virtual:advjs-theme', replacement: `${toAtFS(options.themeRoot)}/client/index.ts` },
    { find: `@advjs/theme-${themeName}/client`, replacement: `${toAtFS(resolve(options.themeRoot))}/client/index.ts` },
    {
      // strict match
      find: new RegExp(`^@advjs/theme-${themeName}$`),
      replacement: `${toAtFS(resolve(options.themeRoot))}/index.ts`,
    },
    { find: `@advjs/theme-${themeName}/`, replacement: `${toAtFS(resolve(options.themeRoot))}/` },
  )

  // for dev
  // if (options.mode === 'dev') {
  //   alias.push(
  //     ...commonAlias.map(({ find, replacement }) => {
  //       return {
  //         find,
  //         replacement: toAtFS(replacement),
  //       }
  //     }),
  //   )
  // }

  alias.push(
    {
      // avoid vue/compiler-sfc in unplugin-vue-i18n
      find: /^vue$/,
      replacement: await resolveImportPath(vueRuntimePath, true),
    },
  )
  alias.push(
    ...(isInstalledGlobally.value
      ? await Promise.all(INCLUDE_GLOBAL.map(async dep => ({
          find: dep,
          replacement: fileURLToPath(await resolveClientDep(dep)),
        })))
      : []
    ),
  )

  return alias
}

export async function createConfigPlugin(options: ResolvedAdvOptions): Promise<Plugin> {
  if (options.data.config.features.babylon) {
    INCLUDE_LOCAL.push(...babylonDeps)
  }

  return {
    name: 'advjs:config',
    // before devtools
    enforce: 'pre',
    async config(config) {
      const injection: InlineConfig = {
        cacheDir: isInstalledGlobally.value ? join(options.cliRoot, 'node_modules/.vite') : undefined,
        publicDir: join(options.userRoot, 'public'),

        define: getDefine(options),
        resolve: {
          alias: await getAlias(options),
          dedupe: ['vue'],
        },
        optimizeDeps: {
          include: INCLUDE_LOCAL,
          exclude: EXCLUDE_LOCAL,
        },
        server: {
          fs: {
            strict: true,
            allow: uniq([
              options.userWorkspaceRoot,
              options.clientRoot,
              options.themeRoot,
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
          if (req.url === '/index.html') {
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
