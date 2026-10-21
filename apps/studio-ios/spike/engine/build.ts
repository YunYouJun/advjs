/* eslint-disable no-console, antfu/no-top-level-await -- SPIKE CLI script: top-level steps report to stdout. */
/**
 * SPIKE: bundle the engine facade into one classic script for JavaScriptCore.
 *
 * Usage: pnpm exec tsx apps/studio-ios/spike/engine/build.ts
 * Output: apps/studio-ios/spike/out/engine.js and engine.meta.json
 */
import type { Plugin } from 'esbuild'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import { build } from 'esbuild'

const here = import.meta.dirname
const repoRoot = resolve(here, '../../../..')
const outDir = resolve(here, '../out')

/** Mirror the root tsconfig path aliases so the spike measures current sources, not stale dist builds. */
const workspaceSources: Plugin = {
  name: 'advjs-workspace-sources',
  setup(context) {
    context.onResolve({ filter: /^@advjs\// }, (args) => {
      const [, name, ...rest] = args.path.split('/')
      const subpath = rest.join('/')
      const candidates = subpath
        ? [`packages/${name}/src/${subpath}.ts`, `packages/${name}/src/${subpath}/index.ts`]
        : [`packages/${name}/src/index.ts`]
      for (const candidate of candidates) {
        const path = resolve(repoRoot, candidate)
        if (existsSync(path))
          return { path }
      }
      return undefined
    })
  },
}

/** Fail the spike build if Node or DOM-only modules enter the engine closure. */
const forbiddenModules: Plugin = {
  name: 'forbid-host-modules',
  setup(context) {
    context.onResolve({ filter: /^(?:node:|fs$|path$|vue$|pixi|@vue\/)/ }, args => ({
      errors: [{ text: `Engine closure must not import ${args.path} (from ${args.importer})` }],
    }))
  },
}

const started = performance.now()
// Host shims must run before any module body, so they ship as a banner rather than an import.
const prelude = await build({
  entryPoints: [resolve(here, 'src/host-prelude.ts')],
  bundle: true,
  format: 'iife',
  platform: 'neutral',
  target: 'es2022',
  minify: process.argv.includes('--minify'),
  legalComments: 'none',
  write: false,
  logLevel: 'warning',
})
const result = await build({
  banner: { js: new TextDecoder().decode(prelude.outputFiles[0].contents) },
  entryPoints: [resolve(here, 'src/index.ts')],
  bundle: true,
  format: 'iife',
  globalName: 'AdvEngine',
  platform: 'neutral',
  mainFields: ['module', 'main'],
  conditions: ['import', 'default'],
  target: 'es2022',
  minify: process.argv.includes('--minify'),
  legalComments: 'none',
  metafile: true,
  write: false,
  define: {
    'process.env.NODE_ENV': '"production"',
    'import.meta.env.DEV': 'false',
  },
  plugins: [workspaceSources, forbiddenModules],
  logLevel: 'warning',
})

await mkdir(outDir, { recursive: true })
const file = result.outputFiles[0]
const name = process.argv.includes('--minify') ? 'engine.min.js' : 'engine.js'
await writeFile(resolve(outDir, name), file.contents)
await writeFile(resolve(outDir, `${name}.meta.json`), JSON.stringify(result.metafile))

const inputs = Object.entries(result.metafile.outputs[Object.keys(result.metafile.outputs)[0]].inputs)
const packages = new Map<string, number>()
for (const [path, info] of inputs) {
  const match = path.match(/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/u)
  const key = match ? match[1] : path.startsWith('packages/') || path.includes('/packages/') ? `workspace:${path.split('packages/')[1].split('/')[0]}` : dirname(path)
  packages.set(key, (packages.get(key) ?? 0) + info.bytesInOutput)
}
const ranked = [...packages.entries()].sort((left, right) => right[1] - left[1])
console.log(`${name}: ${(file.contents.byteLength / 1024).toFixed(1)} KiB in ${(performance.now() - started).toFixed(0)} ms`)
for (const [key, bytes] of ranked.slice(0, 25))
  console.log(`  ${(bytes / 1024).toFixed(1).padStart(8)} KiB  ${key}`)
